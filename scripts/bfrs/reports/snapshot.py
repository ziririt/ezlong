from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

from bfrs.config import project_path
from bfrs.engine.regime import REGIME_LABELS, tactical_weight_for_regime
from bfrs.engine.scores import ScoreColumns


RISK_SEVERITY = {
    "TECH_LEADING_WARNING": 1,
    "GROWTH_WARNING": 2,
    "FRAGILE_BUBBLE": 2,
    "DISTRIBUTION": 2,
    "BREAKDOWN": 3,
    "PANIC": 4,
}

RISK_LEVELS = {1: "선행 경고", 2: "경계", 3: "추세 붕괴", 4: "투매"}

SIGNAL_COLUMNS = [
    ("soxx_leading_alert", "SOXX 반도체 선행 경고"),
    ("growth_warning", "QQQ·SOXX 성장주 동반 약화"),
    ("b_below_sma50", "SPY 50일 평균선 이탈"),
    ("b_below_sma200", "SPY 200일 평균선 이탈"),
    ("b_death_cross", "SPY 50일선이 200일선 아래"),
    ("b_drawdown_10", "SPY 최근 고점 대비 10% 이상 하락"),
    ("b_credit_break", "고위험 회사채 시장 약화"),
    ("b_vix_25", "시장 공포지수 25 이상"),
]


def _clean_number(value, digits: int = 2):
    return None if pd.isna(value) else round(float(value), digits)


def _health_label(value: float, warnings: int) -> str:
    if warnings >= 3:
        return "약함"
    if warnings >= 2:
        return "주의"
    if warnings == 1:
        return "관찰"
    if value >= 80:
        return "강함"
    if value >= 60:
        return "건강"
    if value >= 40:
        return "주의"
    return "약함"


def _role_payload(latest: pd.Series, prefix: str, name: str, role: str) -> dict:
    health = float(latest[f"{prefix}_health_score"])
    warnings = int(latest[f"{prefix}_warning_count"])
    above_50 = bool(latest[f"{prefix}_above_sma50"])
    above_200 = bool(latest[f"{prefix}_above_sma200"])
    if prefix == "spy":
        interpretation = "미국 전체 시장의 방향이 유지되는지 확인합니다."
    elif prefix == "qqq":
        interpretation = "대형 기술·성장주가 전체 시장보다 먼저 약해지는지 확인합니다."
    else:
        interpretation = "반도체가 기술 경기의 변화를 먼저 경고하는지 확인합니다."
    return {
        "symbol": prefix.upper(),
        "name": name,
        "role": role,
        "price": _clean_number(latest[f"{prefix}_price"]),
        "health": _clean_number(health, 1),
        "state": _health_label(health, warnings),
        "above_50d": above_50,
        "above_200d": above_200,
        "return_3m": _clean_number(latest[f"{prefix}_return3m"] * 100, 1),
        "return_6m": _clean_number(latest[f"{prefix}_return6m"] * 100, 1),
        "drawdown": _clean_number(latest[f"{prefix}_drawdown252"] * 100, 1),
        "warnings": warnings,
        "interpretation": interpretation,
    }


def _risk_signals(row: pd.Series) -> list[str]:
    return [label for column, label in SIGNAL_COLUMNS if bool(row[column])]


def _risk_episodes(frame: pd.DataFrame) -> list[dict]:
    """Build retrospective clusters of important historical warning periods."""
    source = frame.reset_index(drop=True).copy()
    source["risk_severity"] = source["regime"].map(RISK_SEVERITY).fillna(0).astype(int)
    risk_positions = source.index[source["risk_severity"] > 0].tolist()
    clusters: list[list[int]] = []
    for position in risk_positions:
        if not clusters or position - clusters[-1][-1] > 10:
            clusters.append([position])
        else:
            clusters[-1].append(position)

    episodes: list[dict] = []
    for cluster in clusters:
        period = source.iloc[cluster[0]:cluster[-1] + 1]
        risk_days = period.loc[period["risk_severity"] > 0]
        severity = int(risk_days["risk_severity"].max())
        worst_drawdown = float(period["spy_drawdown252"].min())
        if severity < 3 or (len(period) < 5 and worst_drawdown > -0.10):
            continue

        peak = risk_days.sort_values(
            ["risk_severity", "breakdown_count", "vix"], ascending=False
        ).iloc[0]
        signals = [
            label for column, label in SIGNAL_COLUMNS
            if bool(risk_days[column].any())
        ]
        start = period.iloc[0]
        end = period.iloc[-1]
        episodes.append({
            "start": pd.Timestamp(start["date"]).date().isoformat(),
            "end": pd.Timestamp(end["date"]).date().isoformat(),
            "level": RISK_LEVELS[severity],
            "severity": severity,
            "regime": str(peak["regime"]),
            "regime_ko": REGIME_LABELS[str(peak["regime"])],
            "risk_days": int(len(risk_days)),
            "signals": signals,
            "max_breakdown_count": int(risk_days["breakdown_count"].max()),
            "max_vix": _clean_number(risk_days["vix"].max(), 1),
            "spy_drawdown": _clean_number(worst_drawdown * 100, 1),
            "changes": {
                prefix: _clean_number((float(end[f"{prefix}_price"]) / float(start[f"{prefix}_price"]) - 1) * 100, 1)
                for prefix in ("spy", "qqq", "soxx")
            },
        })
    return episodes


def build_snapshot(
    frame: pd.DataFrame,
    score_columns: ScoreColumns,
    backtest: pd.DataFrame,
    metrics: dict,
    config: dict,
    output: Path | None = None,
) -> dict:
    complete = frame.dropna(subset=["exuberance_score", "fragility_score", "repair_score"])
    latest = complete.iloc[-1]
    changes = complete.loc[complete["regime"].ne(complete["regime"].shift(1)), ["date", "regime", "regime_ko"]].tail(12)
    core = float(config["portfolio"]["core_weight"])
    tactical = float(config["portfolio"]["tactical_weight"])
    regime = str(latest["regime"])

    components = {
        "exuberance": {column.removeprefix("e_"): _clean_number(latest[column]) for column in score_columns.exuberance},
        "fragility": {column.removeprefix("f_"): _clean_number(latest[column]) for column in score_columns.fragility},
        "repair": {column.removeprefix("r_"): _clean_number(latest[column]) for column in score_columns.repair},
    }
    # Keep real daily observations in the snapshot. The browser derives weekly
    # closing points from these rows so daily/weekly views share the exact same
    # dates, prices, and risk signals.
    role_complete = complete.dropna(subset=[
        "spy_sma200", "qqq_sma200", "soxx_sma200",
        "spy_return6m", "qqq_return6m", "soxx_return6m",
    ])
    price_history = role_complete
    price_baseline = price_history.iloc[0]
    payload = {
        "system": "BFRS v0.3",
        "as_of": pd.Timestamp(latest["date"]).date().isoformat(),
        "symbol": "SPY",
        "regime": regime,
        "regime_ko": REGIME_LABELS[regime],
        "scores": {
            "exuberance": _clean_number(latest["exuberance_score"]),
            "fragility": _clean_number(latest["fragility_score"]),
            "breakdown": int(latest["breakdown_count"]),
            "repair": _clean_number(latest["repair_score"]),
        },
        "components": components,
        "market": {
            "spy": _clean_number(latest["spy_price"]),
            "qqq": _clean_number(latest["qqq_price"]),
            "soxx": _clean_number(latest["soxx_price"]),
            "vix": _clean_number(latest["vix"]),
            "vix3m": _clean_number(latest["vix3m"]),
            "drawdown": _clean_number(latest["spy_drawdown252"] * 100),
            "real_yield_10y": _clean_number(latest["real_yield_10y"]),
            "hy_oas": _clean_number(latest["hy_oas"]),
        },
        "market_roles": {
            "spy": _role_payload(latest, "spy", "미국 전체 시장", "최종 기준"),
            "qqq": _role_payload(latest, "qqq", "대형 기술·성장주", "확인 신호"),
            "soxx": _role_payload(latest, "soxx", "반도체 산업", "선행 경보"),
        },
        "cross_market": {
            "weak_count": int(latest["cross_market_weak_count"]),
            "soxx_leading_alert": bool(latest["soxx_leading_alert"]),
            "growth_warning": bool(latest["growth_warning"]),
            "soxx_vs_spy_3m": _clean_number(latest["soxx_spy_momentum63"] * 100, 1),
            "qqq_vs_spy_3m": _clean_number(latest["qqq_spy_momentum63"] * 100, 1),
        },
        "exposure": round(tactical_weight_for_regime(regime, core, tactical) * 100, 1),
        "next_conditions": [
            "SPY의 붕괴 신호 3개 이상이면 시장 전체 방어 국면으로 전환",
            "SOXX가 먼저 약해지면 반도체 선행 경고로 전술 비중을 축소",
            "QQQ와 SOXX가 함께 약해지면 성장주 동반 약화로 경고 강화",
            "복구 점수 65 이상이면 전술 비중을 단계적으로 복원",
            "과열 70·취약성 60 이상이 함께 나타나면 취약한 버블로 판정",
        ],
        "transitions": [
            {"date": pd.Timestamp(row.date).date().isoformat(), "regime": row.regime, "label": row.regime_ko}
            for row in changes.itertuples()
        ],
        "market_risk_history": [
            {
                "date": pd.Timestamp(row.date).date().isoformat(),
                "spy": _clean_number(float(row.spy_price) / float(price_baseline["spy_price"]) * 100, 1),
                "qqq": _clean_number(float(row.qqq_price) / float(price_baseline["qqq_price"]) * 100, 1),
                "soxx": _clean_number(float(row.soxx_price) / float(price_baseline["soxx_price"]) * 100, 1),
                "spy_price": _clean_number(row.spy_price),
                "qqq_price": _clean_number(row.qqq_price),
                "soxx_price": _clean_number(row.soxx_price),
                "severity": int(RISK_SEVERITY.get(str(row.regime), 0)),
                "level": RISK_LEVELS.get(RISK_SEVERITY.get(str(row.regime), 0), "정상"),
                "regime": str(row.regime),
                "regime_ko": str(row.regime_ko),
                "signals": _risk_signals(pd.Series(row._asdict())),
            }
            for row in price_history.itertuples()
        ],
        "market_risk_history_frequency": "daily",
        "risk_episodes": _risk_episodes(role_complete),
        "backtest": {
            "start": pd.Timestamp(backtest["date"].iloc[0]).date().isoformat(),
            "end": pd.Timestamp(backtest["date"].iloc[-1]).date().isoformat(),
            "metrics": metrics,
        },
        "data_quality": {
            "market_series": 12,
            "fred_series": 4,
            "future_data_rule": "신호 다음 거래일 실행, 경제지표 공표 지연 적용",
            "limitations": [
                "무료 시장 데이터는 유료 데이터와 대조 전 연구용으로만 사용",
                "FRED 공표 시차는 일별 1일·주별 7일의 보수적 근사치",
                "SPY는 전체 시장, QQQ는 성장주, SOXX는 반도체 선행 경보로 역할을 분리",
                "과거 구성 종목 대신 동일가중 ETF 비율을 사용",
            ],
        },
    }
    target = output or project_path("outputs/reports/bfrs-snapshot.json")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload
