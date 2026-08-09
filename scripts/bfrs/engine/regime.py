from __future__ import annotations

import pandas as pd

REGIME_LABELS = {
    "NORMAL_UPTREND": "정상 상승",
    "EXUBERANT_HEALTHY": "과열됐지만 건강함",
    "FRAGILE_BUBBLE": "취약한 버블",
    "DISTRIBUTION": "분배·경계",
    "BREAKDOWN": "추세 붕괴",
    "PANIC": "투매",
    "REPAIR": "복구 중",
    "RESTORED_UPTREND": "상승 추세 복원",
    "TECH_LEADING_WARNING": "반도체 선행 경고",
    "GROWTH_WARNING": "성장주 동반 약화",
}


def classify_regimes(frame: pd.DataFrame, config: dict) -> pd.DataFrame:
    result = frame.copy()
    thresholds = config["regime"]
    regimes: list[str] = []
    previous = "NORMAL_UPTREND"
    for row in result.itertuples():
        e = float(row.exuberance_score) if pd.notna(row.exuberance_score) else 0
        f = float(row.fragility_score) if pd.notna(row.fragility_score) else 0
        r = float(row.repair_score) if pd.notna(row.repair_score) else 0
        b = int(row.breakdown_count)
        vix = float(row.vix) if pd.notna(row.vix) else 0
        weak_count = int(getattr(row, "cross_market_weak_count", 0))
        soxx_alert = bool(getattr(row, "soxx_leading_alert", False))
        growth_warning = bool(getattr(row, "growth_warning", False))
        spy_health = float(getattr(row, "spy_health_score", 100))
        if b >= 4 and vix >= thresholds["panic_vix"]:
            regime = "PANIC"
        elif b >= 3 or (b >= 2 and weak_count >= 2):
            regime = "BREAKDOWN"
        elif previous in {"PANIC", "BREAKDOWN"} and r >= thresholds["repair"]:
            regime = "REPAIR"
        elif previous == "REPAIR" and row.adjusted_close >= row.sma_200 and r >= 60:
            regime = "RESTORED_UPTREND"
        elif growth_warning:
            regime = "GROWTH_WARNING"
        elif soxx_alert and spy_health >= config["market_roles"]["spy_healthy_floor"]:
            regime = "TECH_LEADING_WARNING"
        elif e >= thresholds["exuberant"] and f >= thresholds["fragile"]:
            regime = "FRAGILE_BUBBLE"
        elif f >= thresholds["fragile"] and row.distribution_days_25 >= 5:
            regime = "DISTRIBUTION"
        elif e >= thresholds["exuberant"]:
            regime = "EXUBERANT_HEALTHY"
        else:
            regime = "NORMAL_UPTREND"
        regimes.append(regime)
        previous = regime
    result["regime"] = regimes
    result["regime_ko"] = result["regime"].map(REGIME_LABELS)
    return result


def tactical_weight_for_regime(regime: str, core_weight: float, tactical_weight: float) -> float:
    multipliers = {
        "NORMAL_UPTREND": 1.0,
        "EXUBERANT_HEALTHY": 1.0,
        "FRAGILE_BUBBLE": 0.65,
        "DISTRIBUTION": 0.35,
        "BREAKDOWN": 0.0,
        "PANIC": 0.0,
        "REPAIR": 0.50,
        "RESTORED_UPTREND": 1.0,
        "TECH_LEADING_WARNING": 0.60,
        "GROWTH_WARNING": 0.40,
    }
    return core_weight + tactical_weight * multipliers[regime]
