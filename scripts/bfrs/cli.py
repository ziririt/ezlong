from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

from bfrs.config import load_config, project_path
from bfrs.data.cache import dataset_metadata, write_parquet
from bfrs.data.fred import FredClient
from bfrs.data.market import get_market_provider
from bfrs.data.validation import validate_economic_data, validate_market_data, write_report
from bfrs.engine.state import StateStore
from bfrs.engine.analysis import build_analysis
from bfrs.backtest.runner import run_backtests
from bfrs.reports.snapshot import build_snapshot
from bfrs.errors import BFRSError


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="bfrs", description="BFRS 0단계 데이터·상태 연구 시스템")
    parser.add_argument("--config", default="default", help="config/<이름>.yaml")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("init", help="데이터 폴더와 SQLite 스키마 초기화")

    fred = sub.add_parser("fetch-fred", help="공식 FRED 경제 데이터를 Parquet로 저장")
    fred.add_argument("--series", nargs="+")
    fred.add_argument("--start")
    fred.add_argument("--end")

    market = sub.add_parser("fetch-market", help="시장 OHLCV 데이터를 Parquet로 저장")
    market.add_argument("--symbols", nargs="+")
    market.add_argument("--start", default=(date.today() - timedelta(days=365 * 5)).isoformat())
    market.add_argument("--end", default=date.today().isoformat())

    validate = sub.add_parser("validate-data", help="저장된 Parquet 전체를 검사하고 JSON/Markdown 보고서 생성")
    validate.add_argument("--strict", action="store_true", help="오류가 하나라도 있으면 종료코드 1")

    show = sub.add_parser("show-state", help="심볼의 최신 저장 상태 표시")
    show.add_argument("--symbol", required=True)
    export = sub.add_parser("export-state", help="심볼의 최신 상태를 JSON으로 내보내기")
    export.add_argument("--symbol", required=True)
    export.add_argument("--output")
    import_state = sub.add_parser("import-state", help="JSON 상태를 검증해 SQLite에 복원")
    import_state.add_argument("--file", required=True)
    sub.add_parser("analyze", help="기술지표와 E/F/B/R 점수·국면 계산")
    sub.add_parser("backtest", help="6개 전략 백테스트 실행")
    snapshot = sub.add_parser("build-snapshot", help="웹 대시보드용 분석 JSON 생성")
    snapshot.add_argument("--output")
    return parser


def _store(config: dict) -> StateStore:
    return StateStore(project_path(config["paths"]["database"]))


def command_init(config: dict) -> None:
    for key in ("raw", "processed", "reports"):
        project_path(config["paths"][key]).mkdir(parents=True, exist_ok=True)
    _store(config).initialize()
    print(f"초기화 완료: {project_path(config['paths']['database'])}")


def command_fetch_fred(config: dict, args: argparse.Namespace) -> None:
    client = FredClient()
    series_ids = args.series or config["data"]["fred_series"]
    raw = project_path(config["paths"]["raw"])
    for series_id in series_ids:
        frame = client.fetch(series_id, args.start, args.end)
        path = raw / "fred" / f"{series_id}.parquet"
        write_parquet(frame, path, dataset_metadata(frame, "fred", False, "UTC", "index"))
        print(f"저장: {series_id} {len(frame):,}행 → {path}")


def command_fetch_market(config: dict, args: argparse.Namespace) -> None:
    provider = get_market_provider(config["data"]["market_provider"])
    symbols = args.symbols or config["data"]["market_symbols"]
    raw = project_path(config["paths"]["raw"])
    for symbol in symbols:
        frame = provider.get_ohlcv(symbol, args.start, args.end)
        path = raw / "market" / f"{symbol.upper()}.parquet"
        write_parquet(frame, path, dataset_metadata(frame, provider.name, True, "exchange-local", "USD"))
        if frame.attrs.get("source_rows_without_close_dropped"):
            print(f"주의: {symbol.upper()}의 종가가 없는 공급원 행 {frame.attrs['source_rows_without_close_dropped']}개를 기록 후 제외")
        print(f"저장: {symbol.upper()} {len(frame):,}행 → {path}")


def command_validate(config: dict, strict: bool) -> None:
    raw = project_path(config["paths"]["raw"])
    reports = project_path(config["paths"]["reports"])
    files = sorted(raw.rglob("*.parquet"))
    if not files:
        raise BFRSError("검사할 Parquet 파일이 없습니다. 먼저 fetch-fred 또는 fetch-market을 실행하세요.")
    failures = 0
    store = _store(config)
    for path in files:
        frame = pd.read_parquet(path)
        dataset = str(path.relative_to(raw))
        if "available_at" in frame.columns:
            report = validate_economic_data(frame, dataset)
        else:
            report = validate_market_data(
                frame, dataset,
                config["data"]["maximum_gap_days"],
                config["data"]["stale_after_days"],
            )
        json_path, _ = write_report(report, reports)
        store.log_quality(dataset, report.to_dict())
        failures += int(not report.ok)
        print(f"{'통과' if report.ok else '오류'}: {dataset} → {json_path}")
    if strict and failures:
        raise BFRSError(f"{failures}개 데이터셋에서 오류가 발견됐습니다. 품질 보고서를 확인하세요.")


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        config = load_config(args.config)
        store = _store(config)
        if args.command == "init":
            command_init(config)
        elif args.command == "fetch-fred":
            command_fetch_fred(config, args)
        elif args.command == "fetch-market":
            command_fetch_market(config, args)
        elif args.command == "validate-data":
            command_validate(config, args.strict)
        elif args.command == "show-state":
            state = store.latest(args.symbol)
            if state is None:
                raise BFRSError(f"{args.symbol.upper()}의 저장된 상태가 없습니다.")
            print(state.model_dump_json(indent=2))
        elif args.command == "export-state":
            output = Path(args.output) if args.output else project_path(f"data/state/{args.symbol.upper()}-state.json")
            print(f"내보내기 완료: {store.export_json(args.symbol, output)}")
        elif args.command == "import-state":
            state = store.import_json(Path(args.file))
            print(f"복원 완료: {state.symbol} / {state.as_of}")
        elif args.command == "analyze":
            analyzed, _ = build_analysis(config)
            latest = analyzed.dropna(subset=["exuberance_score", "fragility_score", "repair_score"]).iloc[-1]
            print(
                f"{latest['date'].date()} SPY 기준 | {latest['regime_ko']} | "
                f"E {latest['exuberance_score']:.1f} / F {latest['fragility_score']:.1f} / "
                f"B {int(latest['breakdown_count'])} / R {latest['repair_score']:.1f}"
            )
        elif args.command == "backtest":
            analyzed, _ = build_analysis(config)
            results, metrics = run_backtests(analyzed, config)
            output_dir = project_path("outputs/backtests")
            output_dir.mkdir(parents=True, exist_ok=True)
            results.to_csv(output_dir / "bfrs-backtest.csv", index=False)
            (output_dir / "metrics.json").write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
            print(json.dumps(metrics, ensure_ascii=False, indent=2))
        elif args.command == "build-snapshot":
            analyzed, columns = build_analysis(config)
            results, metrics = run_backtests(analyzed, config)
            output = Path(args.output) if args.output else project_path("outputs/reports/bfrs-snapshot.json")
            snapshot_payload = build_snapshot(analyzed, columns, results, metrics, config, output)
            print(f"웹 스냅샷 생성: {output} / {snapshot_payload['as_of']} / {snapshot_payload['regime_ko']}")
        return 0
    except (BFRSError, FileNotFoundError, LookupError, ValueError) as exc:
        print(f"오류: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
