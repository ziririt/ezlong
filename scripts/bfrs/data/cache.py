from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


def write_parquet(frame: pd.DataFrame, path: Path, metadata: dict | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(path, index=False)
    if metadata is not None:
        path.with_suffix(path.suffix + ".meta.json").write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2, default=str), encoding="utf-8"
        )


def read_parquet(path: Path) -> pd.DataFrame:
    return pd.read_parquet(path)


def dataset_metadata(frame: pd.DataFrame, source: str, adjusted: bool, timezone: str, currency: str) -> dict:
    dates = pd.to_datetime(frame["date"], errors="coerce")
    numeric = frame.select_dtypes(include="number")
    return {
        "source": source,
        "downloaded_at": str(frame["downloaded_at"].max()) if "downloaded_at" in frame else None,
        "adjusted": adjusted,
        "timezone": timezone,
        "currency": currency,
        "first_date": str(dates.min().date()) if dates.notna().any() else None,
        "last_date": str(dates.max().date()) if dates.notna().any() else None,
        "missing_count": int(numeric.isna().sum().sum()),
        "source_rows_without_close_dropped": int(frame.attrs.get("source_rows_without_close_dropped", 0)),
    }
