from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone
from io import StringIO

import httpx
import pandas as pd

from bfrs.data.contracts import normalize_market_frame
from bfrs.errors import DataDownloadError


class MarketDataProvider(ABC):
    name: str

    @abstractmethod
    def get_ohlcv(self, symbol: str, start: str, end: str) -> pd.DataFrame:
        raise NotImplementedError


class StooqProvider(MarketDataProvider):
    """Free daily OHLCV adapter. Stooq prices are treated as source-adjusted."""

    name = "stooq"

    def __init__(self, client: httpx.Client | None = None) -> None:
        self.client = client or httpx.Client(timeout=30, follow_redirects=True)

    @staticmethod
    def source_symbol(symbol: str) -> str:
        mapping = {"VIX": "^VIX"}
        return mapping.get(symbol.upper(), f"{symbol.lower()}.us")

    def get_ohlcv(self, symbol: str, start: str, end: str) -> pd.DataFrame:
        params = {
            "s": self.source_symbol(symbol),
            "d1": start.replace("-", ""),
            "d2": end.replace("-", ""),
            "i": "d",
        }
        try:
            response = self.client.get("https://stooq.com/q/d/l/", params=params)
            response.raise_for_status()
            if "No data" in response.text or not response.text.strip():
                raise DataDownloadError(
                    f"Stooq에 {symbol} 데이터가 없습니다. 심볼 또는 기간을 확인하거나 다른 공급자를 구현하세요."
                )
            frame = pd.read_csv(StringIO(response.text))
            return normalize_market_frame(frame, symbol, self.name)
        except (httpx.HTTPError, pd.errors.ParserError, KeyError) as exc:
            raise DataDownloadError(f"Stooq {symbol} 다운로드 실패: {exc}") from exc


class YahooChartProvider(MarketDataProvider):
    """Yahoo public chart endpoint adapter; no strategy logic depends on it."""

    name = "yahoo_chart"

    def __init__(self, client: httpx.Client | None = None) -> None:
        self.client = client or httpx.Client(
            timeout=30,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 BFRS/0.1 research"},
        )

    @staticmethod
    def _epoch(value: str, end_of_day: bool = False) -> int:
        parsed = datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
        if end_of_day:
            parsed += pd.Timedelta(days=1)
        return int(parsed.timestamp())

    def get_ohlcv(self, symbol: str, start: str, end: str) -> pd.DataFrame:
        if symbol.upper() == "VIX3M":
            return self._get_cboe_vix3m(start, end)

        yahoo_symbol = {"VIX": "^VIX", "VIX3M": "^VIX3M"}.get(symbol.upper(), symbol.upper())
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_symbol}"
        params = {
            "period1": self._epoch(start),
            "period2": self._epoch(end, end_of_day=True),
            "interval": "1d",
            "events": "history",
        }
        try:
            response = self.client.get(url, params=params)
            response.raise_for_status()
            chart = response.json()["chart"]
            if chart.get("error") or not chart.get("result"):
                raise DataDownloadError(f"Yahoo Chart에 {symbol} 데이터가 없습니다: {chart.get('error')}")
            result = chart["result"][0]
            quote = result["indicators"]["quote"][0]
            adjusted = result["indicators"].get("adjclose", [{}])[0].get("adjclose", quote["close"])
            frame = pd.DataFrame(
                {
                    "date": pd.to_datetime(result["timestamp"], unit="s", utc=True).tz_convert(None),
                    "open": quote["open"],
                    "high": quote["high"],
                    "low": quote["low"],
                    "close": quote["close"],
                    "adjusted_close": adjusted,
                    "volume": quote["volume"],
                }
            )
            dropped_count = int(frame["close"].isna().sum())
            frame = frame.loc[frame["close"].notna()].copy()
            normalized = normalize_market_frame(frame, symbol, self.name)
            normalized.attrs["source_rows_without_close_dropped"] = dropped_count
            return normalized
        except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError) as exc:
            raise DataDownloadError(
                f"Yahoo Chart {symbol} 다운로드 실패: {exc}. 잠시 후 재시도하거나 config의 market_provider를 교체하세요."
            ) from exc

    def _get_cboe_vix3m(self, start: str, end: str) -> pd.DataFrame:
        """Load VIX3M from its official Cboe history after Yahoo retired the symbol."""
        url = "https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX3M_History.csv"
        try:
            response = self.client.get(url)
            response.raise_for_status()
            frame = pd.read_csv(StringIO(response.text))
            dates = pd.to_datetime(frame["DATE"], errors="coerce")
            frame = frame.loc[(dates >= pd.Timestamp(start)) & (dates <= pd.Timestamp(end))].copy()
            if frame.empty:
                raise DataDownloadError(f"Cboe에 {start}~{end} VIX3M 데이터가 없습니다.")
            frame["VOLUME"] = 0
            return normalize_market_frame(frame, "VIX3M", "cboe")
        except (httpx.HTTPError, pd.errors.ParserError, KeyError, ValueError) as exc:
            raise DataDownloadError(f"Cboe VIX3M 다운로드 실패: {exc}") from exc


def get_market_provider(name: str) -> MarketDataProvider:
    if name.lower() == "yahoo_chart":
        return YahooChartProvider()
    if name.lower() == "stooq":
        return StooqProvider()
    raise ValueError(f"지원하지 않는 시장 데이터 공급자입니다: {name}. 현재 지원: yahoo_chart, stooq")
