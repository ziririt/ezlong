from __future__ import annotations

from pathlib import Path

import pandas as pd

from bfrs.config import project_path
from bfrs.engine.regime import classify_regimes
from bfrs.engine.scores import ScoreColumns, calculate_scores
from bfrs.indicators.technical import add_technical_indicators, relative_series

MARKET_REQUIRED = ["QQQ", "SPY", "RSP", "QQQE", "TQQQ", "SOXX", "SOXL", "HYG", "LQD", "IEF", "VIX", "VIX3M"]
FRED_MAP = {
    "DFII10": ("real_yield_10y", 1),
    "BAMLH0A0HYM2": ("hy_oas", 1),
    "BAMLC0A4CBBB": ("bbb_oas", 1),
    "STLFSI4": ("financial_stress", 7),
}

ROLE_SYMBOLS = {
    "spy": "SPY",
    "qqq": "QQQ",
    "soxx": "SOXX",
}


def _read_market(raw: Path, symbol: str) -> pd.DataFrame:
    path = raw / "market" / f"{symbol}.parquet"
    if not path.exists():
        raise FileNotFoundError(f"{symbol} 시장 데이터가 없습니다. fetch-market을 먼저 실행하세요: {path}")
    frame = pd.read_parquet(path).sort_values("date")
    frame["date"] = pd.to_datetime(frame["date"]).astype("datetime64[ns]")
    return frame


def _merge_market_column(base: pd.DataFrame, frame: pd.DataFrame, name: str) -> pd.DataFrame:
    column = frame.dropna(subset=["adjusted_close"])[["date", "adjusted_close"]].rename(columns={"adjusted_close": name})
    return pd.merge_asof(
        base.sort_values("date"), column.sort_values("date"), on="date", direction="backward", tolerance=pd.Timedelta(days=20)
    )


def _merge_role_indicators(base: pd.DataFrame, frame: pd.DataFrame, prefix: str) -> pd.DataFrame:
    """Attach a small, explainable trend panel for one market role."""
    technical = add_technical_indicators(frame)
    source_columns = {
        "adjusted_close": f"{prefix}_price",
        "sma_50": f"{prefix}_sma50",
        "sma_200": f"{prefix}_sma200",
        "return_3m": f"{prefix}_return3m",
        "return_6m": f"{prefix}_return6m",
        "drawdown_252": f"{prefix}_drawdown252",
        "rsi_14": f"{prefix}_rsi14",
    }
    role = technical[["date", *source_columns]].rename(columns=source_columns)
    return pd.merge_asof(
        base.sort_values("date"), role.sort_values("date"), on="date",
        direction="backward", tolerance=pd.Timedelta(days=14),
    )


def _add_market_role_signals(base: pd.DataFrame, config: dict) -> pd.DataFrame:
    """Score SPY, QQQ and SOXX independently instead of averaging them."""
    result = base.copy()
    for prefix in ROLE_SYMBOLS:
        result[f"{prefix}_above_sma50"] = result[f"{prefix}_price"] >= result[f"{prefix}_sma50"]
        result[f"{prefix}_above_sma200"] = result[f"{prefix}_price"] >= result[f"{prefix}_sma200"]
        result[f"{prefix}_golden_cross"] = result[f"{prefix}_sma50"] >= result[f"{prefix}_sma200"]
        result[f"{prefix}_health_score"] = (
            result[f"{prefix}_above_sma50"].astype(int) * 20
            + result[f"{prefix}_above_sma200"].astype(int) * 30
            + result[f"{prefix}_golden_cross"].astype(int) * 20
            + (result[f"{prefix}_return3m"] >= 0).astype(int) * 15
            + (result[f"{prefix}_return6m"] >= 0).astype(int) * 15
        )
        result[f"{prefix}_warning_count"] = (
            (~result[f"{prefix}_above_sma50"]).astype(int)
            + (~result[f"{prefix}_above_sma200"]).astype(int)
            + (~result[f"{prefix}_golden_cross"]).astype(int)
            + (result[f"{prefix}_drawdown252"] <= -0.10).astype(int)
        )

    thresholds = config["market_roles"]
    raw_soxx_alert = (
        (result["soxx_warning_count"] >= thresholds["warning_count_trigger"])
        | (result["soxx_spy_momentum63"] <= thresholds["soxx_relative_warning_63d"])
    )
    result["soxx_leading_alert"] = (
        raw_soxx_alert.astype(int)
        .rolling(thresholds["confirmation_window"], min_periods=thresholds["confirmation_window"])
        .sum()
        >= thresholds["confirmation_hits"]
    )
    raw_growth_warning = (
        (result["qqq_warning_count"] >= thresholds["warning_count_trigger"])
        & result["soxx_leading_alert"]
        & (result["spy_health_score"] >= thresholds["spy_healthy_floor"])
    )
    result["growth_warning"] = (
        raw_growth_warning.astype(int)
        .rolling(thresholds["confirmation_window"], min_periods=thresholds["confirmation_window"])
        .sum()
        >= thresholds["confirmation_hits"]
    )
    result["cross_market_weak_count"] = sum(
        (result[f"{prefix}_warning_count"] >= thresholds["warning_count_trigger"]).astype(int)
        for prefix in ROLE_SYMBOLS
    )
    return result


def _merge_economic_as_known(base: pd.DataFrame, raw: Path, series_id: str, name: str, lag_days: int) -> pd.DataFrame:
    path = raw / "fred" / f"{series_id}.parquet"
    if not path.exists():
        raise FileNotFoundError(f"{series_id} FRED 데이터가 없습니다. fetch-fred를 먼저 실행하세요: {path}")
    economic = pd.read_parquet(path)[["date", "value"]].copy()
    economic["known_at"] = (pd.to_datetime(economic["date"]) + pd.Timedelta(days=lag_days)).astype("datetime64[ns]")
    economic = economic.dropna(subset=["value", "known_at"]).sort_values("known_at")
    economic = economic[["known_at", "value"]].rename(columns={"value": name})
    return pd.merge_asof(base.sort_values("date"), economic, left_on="date", right_on="known_at", direction="backward").drop(columns="known_at")


def build_analysis(config: dict) -> tuple[pd.DataFrame, ScoreColumns]:
    raw = project_path(config["paths"]["raw"])
    market = {symbol: _read_market(raw, symbol) for symbol in MARKET_REQUIRED}
    # SPY is the primary market clock. QQQ and SOXX are attached as role-specific
    # confirmation and leading-warning layers.
    base = add_technical_indicators(market["SPY"])
    for prefix, symbol in ROLE_SYMBOLS.items():
        base = _merge_role_indicators(base, market[symbol], prefix)
    for symbol, name in (("VIX", "vix"), ("VIX3M", "vix3m")):
        base = _merge_market_column(base, market[symbol], name)
    base["vix_vix3m"] = base["vix"] / base["vix3m"]

    relative_specs = [
        ("QQQ", "QQQE", "qqq_qew"),
        ("SPY", "RSP", "spy_rsp"),
        ("TQQQ", "QQQ", "tqqq_qqq"),
        ("SOXL", "SOXX", "soxl_soxx"),
        ("HYG", "LQD", "hyg_lqd"),
        ("HYG", "IEF", "hyg_ief"),
        ("QQQ", "SPY", "qqq_spy"),
        ("SOXX", "SPY", "soxx_spy"),
    ]
    for left, right, name in relative_specs:
        relative = relative_series(market[left], market[right], name).sort_values("date")
        base = pd.merge_asof(
            base.sort_values("date"), relative, on="date", direction="backward", tolerance=pd.Timedelta(days=14)
        )

    for series_id, (name, lag_days) in FRED_MAP.items():
        base = _merge_economic_as_known(base, raw, series_id, name, lag_days)

    base = _add_market_role_signals(base, config)
    scored, columns = calculate_scores(base, config)
    analyzed = classify_regimes(scored, config)
    processed = project_path(config["paths"]["processed"]) / "bfrs_daily.parquet"
    processed.parent.mkdir(parents=True, exist_ok=True)
    analyzed.to_parquet(processed, index=False)
    return analyzed, columns
