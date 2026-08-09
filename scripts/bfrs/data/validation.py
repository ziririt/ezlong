from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import pandas as pd


@dataclass(frozen=True)
class Finding:
    code: str
    severity: str
    message: str
    count: int = 1


@dataclass
class ValidationReport:
    dataset: str
    generated_at: str
    row_count: int
    findings: list[Finding]

    @property
    def ok(self) -> bool:
        return not any(item.severity == "error" for item in self.findings)

    def to_dict(self) -> dict:
        return {
            "dataset": self.dataset,
            "generated_at": self.generated_at,
            "row_count": self.row_count,
            "ok": self.ok,
            "findings": [asdict(item) for item in self.findings],
        }


def _finding(code: str, message: str, mask: pd.Series, severity: str = "error") -> Finding | None:
    count = int(mask.fillna(False).sum())
    return Finding(code, severity, message, count) if count else None


def validate_market_data(
    frame: pd.DataFrame,
    dataset: str,
    maximum_gap_days: int = 10,
    stale_after_days: int = 7,
    now: pd.Timestamp | None = None,
) -> ValidationReport:
    findings: list[Finding] = []
    required = {"date", "symbol", "open", "high", "low", "close", "adjusted_close", "volume", "source", "downloaded_at"}
    missing_columns = sorted(required - set(frame.columns))
    if missing_columns:
        findings.append(Finding("missing_columns", "필수 컬럼 누락: " + ", ".join(missing_columns), len(missing_columns)))
        return _report(dataset, len(frame), findings)

    dates = pd.to_datetime(frame["date"], errors="coerce")
    checks = [
        _finding("invalid_date", "해석할 수 없는 날짜", dates.isna()),
        _finding("duplicate_date", "심볼별 중복 날짜", frame.assign(_date=dates).duplicated(["symbol", "_date"], keep=False)),
        _finding("reverse_order", "날짜가 오름차순이 아님", dates.diff().dropna().lt(pd.Timedelta(0)).reindex(frame.index, fill_value=False)),
        _finding("missing_value", "필수 가격/거래량 결측", frame[["open", "high", "low", "close", "adjusted_close", "volume"]].isna().any(axis=1)),
        _finding("negative_price", "0 이하 가격", frame[["open", "high", "low", "close", "adjusted_close"]].le(0).any(axis=1)),
        _finding("negative_volume", "음수 거래량", pd.to_numeric(frame["volume"], errors="coerce").lt(0)),
        _finding("ohlc_logic", "고가/저가가 OHLC 범위를 위반", (frame["high"] < frame[["open", "close", "low"]].max(axis=1)) | (frame["low"] > frame[["open", "close", "high"]].min(axis=1))),
    ]
    findings.extend(item for item in checks if item)

    gaps = dates.sort_values().diff().dt.days.gt(maximum_gap_days)
    gap_finding = _finding("long_gap", f"{maximum_gap_days}일을 넘는 데이터 공백", gaps, "warning")
    if gap_finding:
        findings.append(gap_finding)

    source_count = frame["source"].dropna().nunique()
    if source_count > 1:
        findings.append(Finding("mixed_source", "한 데이터셋에 여러 소스가 혼용됨", source_count))

    downloaded = pd.to_datetime(frame["downloaded_at"], errors="coerce")
    if getattr(downloaded.dt, "tz", None) is None:
        findings.append(Finding("timezone_missing", "downloaded_at timezone이 없음"))

    current = now or pd.Timestamp(datetime.now(timezone.utc))
    latest = dates.max()
    if pd.notna(latest) and (current.tz_localize(None) - latest.tz_localize(None)).days > stale_after_days:
        findings.append(Finding("stale_data", "warning", f"최신 데이터가 {stale_after_days}일보다 오래됨"))

    return _report(dataset, len(frame), findings)


def validate_economic_data(frame: pd.DataFrame, dataset: str) -> ValidationReport:
    findings: list[Finding] = []
    required = {"date", "series_id", "value", "source", "downloaded_at", "release_date", "available_at"}
    missing = sorted(required - set(frame.columns))
    if missing:
        findings.append(Finding("missing_columns", "필수 컬럼 누락: " + ", ".join(missing), len(missing)))
        return _report(dataset, len(frame), findings)
    dates = pd.to_datetime(frame["date"], errors="coerce")
    available = pd.to_datetime(frame["available_at"], errors="coerce")
    checks = [
        _finding("invalid_date", "해석할 수 없는 날짜", dates.isna()),
        _finding("duplicate_date", "시계열별 중복 날짜", frame.assign(_date=dates).duplicated(["series_id", "_date"], keep=False)),
        _finding("reverse_order", "날짜가 오름차순이 아님", dates.diff().dropna().lt(pd.Timedelta(0)).reindex(frame.index, fill_value=False)),
        _finding("missing_value", "경제지표 값이 결측이며 자동 보간하지 않음", pd.to_numeric(frame["value"], errors="coerce").isna(), "warning"),
        _finding("missing_available_at", "공표 가능 시점 누락", available.isna()),
        _finding("available_before_observation", "공표 가능 시점이 관측일보다 빠름", available < dates),
    ]
    findings.extend(item for item in checks if item)
    return _report(dataset, len(frame), findings)


def _report(dataset: str, row_count: int, findings: Iterable[Finding]) -> ValidationReport:
    return ValidationReport(dataset, datetime.now(timezone.utc).isoformat(), row_count, list(findings))


def write_report(report: ValidationReport, directory: Path) -> tuple[Path, Path]:
    directory.mkdir(parents=True, exist_ok=True)
    safe_name = report.dataset.replace("/", "_").replace(" ", "_")
    json_path = directory / f"{safe_name}.quality.json"
    md_path = directory / f"{safe_name}.quality.md"
    json_path.write_text(json.dumps(report.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    lines = [
        f"# 데이터 품질 보고서: {report.dataset}", "", f"- 결과: {'통과' if report.ok else '오류 있음'}",
        f"- 행 수: {report.row_count}", f"- 생성: {report.generated_at}", "", "## 발견 사항", "",
    ]
    if report.findings:
        lines.extend(f"- [{item.severity.upper()}] `{item.code}`: {item.message} ({item.count}건)" for item in report.findings)
    else:
        lines.append("- 발견된 문제가 없습니다.")
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return json_path, md_path
