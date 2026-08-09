from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd


def clamp_score(value: pd.Series | float) -> pd.Series | float:
    return np.clip(value, 0, 100)


def linear_score(value: pd.Series, low: float, high: float, inverse: bool = False) -> pd.Series:
    score = (value - low) / (high - low) * 100
    score = clamp_score(score)
    return 100 - score if inverse else score


def neutral_if_missing(series: pd.Series) -> pd.Series:
    """Missing optional proxy data contributes a neutral 50, never an invented observation."""
    return series.fillna(50.0)


def weighted_score(components: dict[str, pd.Series], weights: dict[str, float]) -> pd.Series:
    frame = pd.DataFrame(components)
    if len(components) != len(weights):
        raise ValueError("점수 구성요소와 가중치 개수가 다릅니다.")
    weighted = sum(frame[name] * float(weight) for name, weight in zip(components, weights.values()))
    return weighted.where(frame.notna().any(axis=1))


@dataclass(frozen=True)
class ScoreColumns:
    exuberance: list[str]
    fragility: list[str]
    repair: list[str]


def calculate_scores(frame: pd.DataFrame, config: dict) -> tuple[pd.DataFrame, ScoreColumns]:
    result = frame.copy()

    exuberance = {
        "e_price_explosiveness": (
            neutral_if_missing(linear_score(result["distance_sma200_atr"], 0, 8)) * 0.65
            + neutral_if_missing(linear_score(result["return_12m"], 0.05, 0.60)) * 0.35
        ),
        "e_momentum": (
            neutral_if_missing(linear_score(result["return_6m"], -0.05, 0.35)) * 0.65
            + neutral_if_missing(linear_score(result["rsi_14"], 50, 80)) * 0.35
        ),
        "e_concentration": (
            neutral_if_missing(linear_score(result["qqq_qew_momentum63"], -0.03, 0.12)) * 0.55
            + neutral_if_missing(linear_score(result["spy_rsp_momentum63"], -0.03, 0.10)) * 0.45
        ),
        "e_speculation": (
            neutral_if_missing(linear_score(result["tqqq_qqq_momentum63"], -0.10, 0.25)) * 0.55
            + neutral_if_missing(linear_score(result["soxl_soxx_momentum63"], -0.15, 0.35)) * 0.45
        ),
    }
    result = result.assign(**exuberance)
    result["exuberance_score"] = weighted_score(
        exuberance, config["scoring"]["exuberance"]
    )

    fragility = {
        "f_breadth_divergence": (
            neutral_if_missing(linear_score(result["qqq_qew_momentum63"], 0, 0.12)) * 0.55
            + neutral_if_missing(linear_score(result["spy_rsp_momentum63"], 0, 0.10)) * 0.45
        ),
        "f_credit_stress": (
            neutral_if_missing(linear_score(result["hyg_lqd_momentum63"], -0.08, 0.03, inverse=True)) * 0.45
            + neutral_if_missing(linear_score(result["hy_oas"], 2.5, 7.0)) * 0.35
            + neutral_if_missing(linear_score(result["bbb_oas"], 0.8, 3.0)) * 0.20
        ),
        "f_volatility_stress": (
            neutral_if_missing(linear_score(result["vix"], 14, 35)) * 0.60
            + neutral_if_missing(linear_score(result["vix_vix3m"], 0.85, 1.20)) * 0.25
            + neutral_if_missing(linear_score(result["financial_stress"], -1.0, 2.0)) * 0.15
        ),
        "f_liquidity_tightening": (
            neutral_if_missing(linear_score(result["real_yield_10y"], 0, 3.0)) * 0.60
            + neutral_if_missing(linear_score(result["hyg_ief_momentum63"], -0.10, 0.05, inverse=True)) * 0.40
        ),
    }
    result = result.assign(**fragility)
    result["fragility_score"] = weighted_score(
        fragility, config["scoring"]["fragility"]
    )

    result["b_below_sma50"] = (result["adjusted_close"] < result["sma_50"]).astype(int)
    result["b_below_sma200"] = (result["adjusted_close"] < result["sma_200"]).astype(int)
    result["b_death_cross"] = (result["sma_50"] < result["sma_200"]).astype(int)
    result["b_drawdown_10"] = (result["drawdown_252"] <= -0.10).astype(int)
    result["b_credit_break"] = (result["hyg_lqd"] < result["hyg_lqd_sma50"]).astype(int)
    result["b_vix_25"] = (result["vix"] >= 25).astype(int)
    breakdown_cols = [column for column in result if column.startswith("b_")]
    result["breakdown_count"] = result[breakdown_cols].sum(axis=1)

    repair = {
        "r_price_reclaim": neutral_if_missing(linear_score(
            (result["adjusted_close"] / result["sma_20"] - 1), -0.04, 0.05
        )),
        "r_momentum_repair": neutral_if_missing(linear_score(result["rsi_14"], 35, 65)),
        "r_volatility_relief": neutral_if_missing(linear_score(result["vix"].pct_change(10, fill_method=None), -0.30, 0.15, inverse=True)),
        "r_credit_repair": neutral_if_missing(linear_score(result["hyg_lqd_momentum63"], -0.08, 0.04)),
    }
    result = result.assign(**repair)
    result["repair_score"] = sum(repair.values()) / len(repair)
    return result, ScoreColumns(list(exuberance), list(fragility), list(repair))
