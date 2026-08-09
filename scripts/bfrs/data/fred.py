from __future__ import annotations

import os
from typing import Any

import httpx
import pandas as pd
from dotenv import load_dotenv

from bfrs.data.contracts import ECONOMIC_COLUMNS, utc_now
from bfrs.errors import ConfigurationError, DataDownloadError

FRED_URL = "https://api.stlouisfed.org/fred/series/observations"


def require_api_key(api_key: str | None = None) -> str:
    load_dotenv()
    key = api_key or os.getenv("FRED_API_KEY")
    if not key:
        raise ConfigurationError(
            "FRED_API_KEY가 없습니다. https://fred.stlouisfed.org/docs/api/api_key.html 에서 "
            "키를 발급받아 프로젝트의 .env에 FRED_API_KEY=... 형식으로 저장하세요."
        )
    return key


def parse_observations(payload: dict[str, Any], series_id: str) -> pd.DataFrame:
    downloaded_at = utc_now()
    rows: list[dict[str, Any]] = []
    for item in payload.get("observations", []):
        realtime_start = item.get("realtime_start")
        rows.append(
            {
                "date": pd.to_datetime(item.get("date"), errors="coerce"),
                "series_id": series_id,
                "value": pd.to_numeric(item.get("value"), errors="coerce"),
                "source": "fred",
                "downloaded_at": downloaded_at,
                "release_date": pd.to_datetime(realtime_start, errors="coerce"),
                "available_at": pd.to_datetime(realtime_start, errors="coerce"),
            }
        )
    return pd.DataFrame(rows, columns=ECONOMIC_COLUMNS).sort_values("date").reset_index(drop=True)


class FredClient:
    def __init__(self, api_key: str | None = None, client: httpx.Client | None = None) -> None:
        self.api_key = require_api_key(api_key)
        self.client = client or httpx.Client(timeout=30, follow_redirects=True)

    def fetch(self, series_id: str, start: str | None = None, end: str | None = None) -> pd.DataFrame:
        params = {
            "series_id": series_id,
            "api_key": self.api_key,
            "file_type": "json",
            "observation_start": start or "1776-07-04",
        }
        if end:
            params["observation_end"] = end
        try:
            response = self.client.get(FRED_URL, params=params)
            response.raise_for_status()
            return parse_observations(response.json(), series_id)
        except (httpx.HTTPError, ValueError) as exc:
            raise DataDownloadError(f"FRED {series_id} 다운로드 실패: {exc}") from exc
