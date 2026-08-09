from __future__ import annotations

import numpy as np
import pandas as pd


def rsi(series: pd.Series, window: int) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / window, adjust=False, min_periods=window).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / window, adjust=False, min_periods=window).mean()
    relative = gain / loss.replace(0, np.nan)
    result = 100 - (100 / (1 + relative))
    return result.where(loss.ne(0), 100.0).where(gain.ne(0), 0.0)


def atr(frame: pd.DataFrame, window: int = 14) -> pd.Series:
    previous_close = frame["close"].shift(1)
    true_range = pd.concat(
        [
            frame["high"] - frame["low"],
            (frame["high"] - previous_close).abs(),
            (frame["low"] - previous_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return true_range.rolling(window, min_periods=window).mean()


def add_technical_indicators(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.sort_values("date").copy()
    price = result["adjusted_close"].astype(float)
    raw_close = result["close"].astype(float)
    for window in (20, 50, 200):
        result[f"sma_{window}"] = price.rolling(window, min_periods=window).mean()
    for weeks, days in ((10, 50), (20, 100), (40, 200)):
        result[f"sma_{weeks}w"] = price.rolling(days, min_periods=days).mean()
    result["atr_14"] = atr(result, 14)
    result["rsi_5"] = rsi(price, 5)
    result["rsi_14"] = rsi(price, 14)
    for label, days in (("3m", 63), ("6m", 126), ("12m", 252)):
        result[f"return_{label}"] = price.pct_change(days, fill_method=None)
    result["momentum_acceleration_26w"] = result["return_6m"] - result["return_6m"].shift(126)
    result["distance_sma200_atr"] = (raw_close - result["sma_200"]) / result["atr_14"].replace(0, np.nan)
    result["drawdown_252"] = price / price.rolling(252, min_periods=20).max() - 1
    distribution = (price < price.shift(1)) & (result["volume"] > result["volume"].shift(1))
    result["distribution_days_25"] = distribution.astype(int).rolling(25, min_periods=1).sum()
    result["realized_vol_20"] = price.pct_change(fill_method=None).rolling(20, min_periods=20).std() * np.sqrt(252)
    return result


def relative_series(left: pd.DataFrame, right: pd.DataFrame, name: str) -> pd.DataFrame:
    joined = left[["date", "adjusted_close"]].merge(
        right[["date", "adjusted_close"]], on="date", suffixes=("_left", "_right"), how="inner"
    )
    joined[name] = joined["adjusted_close_left"] / joined["adjusted_close_right"]
    joined[f"{name}_sma50"] = joined[name].rolling(50, min_periods=50).mean()
    joined[f"{name}_momentum63"] = joined[name].pct_change(63, fill_method=None)
    return joined[["date", name, f"{name}_sma50", f"{name}_momentum63"]]
