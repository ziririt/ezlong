from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd

MARKET_COLUMNS = [
    "date", "symbol", "open", "high", "low", "close", "adjusted_close",
    "volume", "source", "downloaded_at",
]
ECONOMIC_COLUMNS = [
    "date", "series_id", "value", "source", "downloaded_at", "release_date", "available_at",
]


def utc_now() -> pd.Timestamp:
    return pd.Timestamp(datetime.now(timezone.utc))


def normalize_market_frame(frame: pd.DataFrame, symbol: str, source: str) -> pd.DataFrame:
    rename = {column: column.strip().lower().replace(" ", "_") for column in frame.columns}
    result = frame.rename(columns=rename).copy()
    result["date"] = pd.to_datetime(result["date"], errors="coerce").dt.tz_localize(None).dt.normalize()
    for column in ("open", "high", "low", "close", "volume"):
        result[column] = pd.to_numeric(result[column], errors="coerce")
    result["adjusted_close"] = pd.to_numeric(
        result.get("adjusted_close", result["close"]), errors="coerce"
    )
    result["symbol"] = symbol.upper()
    result["source"] = source
    result["downloaded_at"] = utc_now()
    return result[MARKET_COLUMNS].sort_values("date", kind="stable").reset_index(drop=True)


def as_known_on(frame: pd.DataFrame, as_of: str | pd.Timestamp) -> pd.DataFrame:
    """Return only observations that were actually available by *as_of*."""
    if "available_at" not in frame.columns:
        raise ValueError("available_at 컬럼이 없어 미래 데이터 차단을 보장할 수 없습니다.")
    cutoff = pd.Timestamp(as_of)
    available = pd.to_datetime(frame["available_at"], errors="coerce")
    if cutoff.tzinfo is None and getattr(available.dt, "tz", None) is not None:
        cutoff = cutoff.tz_localize("UTC")
    return frame.loc[available <= cutoff].copy()
