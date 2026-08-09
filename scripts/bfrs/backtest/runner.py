from __future__ import annotations

import math

import numpy as np
import pandas as pd

from bfrs.engine.regime import tactical_weight_for_regime


def _metrics(returns: pd.Series, turnover: pd.Series, annual_days: int = 252) -> dict[str, float]:
    clean = returns.fillna(0)
    equity = (1 + clean).cumprod()
    years = max(len(clean) / annual_days, 1 / annual_days)
    total_return = float(equity.iloc[-1] - 1)
    cagr = float(equity.iloc[-1] ** (1 / years) - 1)
    drawdown = equity / equity.cummax() - 1
    volatility = float(clean.std() * math.sqrt(annual_days))
    sharpe = float(clean.mean() / clean.std() * math.sqrt(annual_days)) if clean.std() else 0.0
    return {
        "total_return": total_return,
        "cagr": cagr,
        "max_drawdown": float(drawdown.min()),
        "annual_volatility": volatility,
        "sharpe": sharpe,
        "turnover": float(turnover.abs().sum()),
    }


def _plan_b_positions(usable: pd.DataFrame, base_positions: pd.Series, config: dict) -> pd.Series:
    """Keep BFRS evacuation, but restore full exposure on an early recovery.

    The state prevents a still-active warning from repeatedly selling immediately
    after an early re-entry. A new warning episode or a severe breakdown can arm
    the defensive mode again. All inputs are same-day closing data; execution is
    shifted to the next trading day by ``run_backtests``.
    """
    settings = config["backtest"]["plan_b"]
    evacuation = set(settings["evacuation_regimes"])
    severe = set(settings["severe_regimes"])
    repair_threshold = float(settings["early_reentry_repair"])
    moving_average = str(settings["early_reentry_moving_average"])

    if moving_average not in usable:
        raise ValueError(f"플랜 B 재진입 평균선 열이 없습니다: {moving_average}")

    risk_on = True
    previous_was_evacuation = False
    positions: list[float] = []
    for row, base_position in zip(usable.itertuples(), base_positions, strict=True):
        regime = str(row.regime)
        is_evacuation = regime in evacuation
        entered_evacuation = is_evacuation and not previous_was_evacuation
        if regime in severe or entered_evacuation:
            risk_on = False

        early_reentry = (
            regime not in severe
            and not entered_evacuation
            and float(row.repair_score) >= repair_threshold
            and float(row.adjusted_close) >= float(getattr(row, moving_average))
        )
        if not risk_on and early_reentry:
            risk_on = True

        positions.append(1.0 if risk_on else float(base_position))
        previous_was_evacuation = is_evacuation
    return pd.Series(positions, index=usable.index, dtype=float)


def run_backtests(frame: pd.DataFrame, config: dict) -> tuple[pd.DataFrame, dict[str, dict[str, float]]]:
    usable = frame.dropna(subset=["sma_200", "exuberance_score", "fragility_score", "repair_score"]).copy()
    if usable.empty:
        raise ValueError("백테스트에 필요한 200거래일 이상의 데이터가 없습니다.")
    asset_return = usable["adjusted_close"].pct_change(fill_method=None).fillna(0)
    core = float(config["portfolio"]["core_weight"])
    tactical = float(config["portfolio"]["tactical_weight"])
    costs = (float(config["costs"]["transaction_cost_bps"]) + float(config["costs"]["slippage_bps"])) / 10000

    positions = pd.DataFrame(index=usable.index)
    positions["Buy & Hold"] = 1.0
    positions["200일선"] = (usable["adjusted_close"] >= usable["sma_200"]).astype(float)
    positions["40주선"] = (usable["adjusted_close"] >= usable["sma_40w"]).astype(float)
    positions["기존 BDS"] = np.select(
        [usable["breakdown_count"] >= 3, usable["exuberance_score"] >= 75],
        [core, core + tactical * 0.5],
        default=1.0,
    )
    positions["BFRS"] = usable["regime"].map(lambda regime: tactical_weight_for_regime(regime, core, tactical))
    positions["플랜 B 공격 재진입"] = _plan_b_positions(usable, positions["BFRS"], config)

    results = usable[["date", "adjusted_close", "regime", "exuberance_score", "fragility_score", "breakdown_count", "repair_score"]].copy()
    metrics: dict[str, dict[str, float]] = {}
    for strategy in positions:
        executed_position = positions[strategy].shift(1).fillna(0)
        turnover = executed_position.diff().fillna(executed_position)
        strategy_return = executed_position * asset_return - turnover.abs() * costs
        results[f"{strategy}_position"] = executed_position
        results[f"{strategy}_equity"] = (1 + strategy_return).cumprod()
        metrics[strategy] = _metrics(strategy_return, turnover, int(config["backtest"]["annual_trading_days"]))
    return results, metrics
