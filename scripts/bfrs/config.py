from __future__ import annotations

from copy import deepcopy
from pathlib import Path
from typing import Any

import yaml


def _discover_project_root() -> Path:
    """작업 뿌리 — 데이터·산출물이 놓이는 자리.

    이식 메모(2026-08-09): 원래는 저장소 루트에 config/ 가 있는 곳을 찾았다.
    ezlong 저장소에는 다른 용도의 config/ 가 이미 있어서, 설정은 패키지 안
    (scripts/bfrs/config/)으로 옮기고 여기서는 '저장소 루트'만 정한다.
    """
    return Path(__file__).resolve().parents[2]


PROJECT_ROOT = _discover_project_root()
# 설정 파일은 엔진과 같이 다닌다 — 저장소의 다른 config/ 와 섞이지 않게.
CONFIG_DIR = Path(__file__).resolve().parent / "config"


def _merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    result = deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _merge(result[key], value)
        else:
            result[key] = value
    return result


def load_config(name: str = "default") -> dict[str, Any]:
    path = CONFIG_DIR / f"{name}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"설정 파일이 없습니다: {path}")
    with path.open(encoding="utf-8") as handle:
        config = yaml.safe_load(handle) or {}
    parent = config.pop("extends", None)
    return _merge(load_config(Path(parent).stem), config) if parent else config


def project_path(value: str | Path) -> Path:
    path = Path(value)
    return path if path.is_absolute() else PROJECT_ROOT / path
