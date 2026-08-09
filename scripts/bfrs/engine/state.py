from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class MarketState(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cycle_id: str
    symbol: str
    as_of: str
    current_regime: str = "UNINITIALIZED"
    previous_regime: str | None = None
    exuberance_score: float | None = None
    fragility_score: float | None = None
    breakdown_count: int = 0
    repair_score: float | None = None
    buy_tranches_used: int = Field(default=0, ge=0)
    sell_tranches_used: int = Field(default=0, ge=0)
    last_action: str | None = None
    last_action_date: str | None = None
    last_action_price: float | None = None
    cooldown_until: str | None = None
    high_water_mark: float | None = None
    low_water_mark: float | None = None
    created_at: str | None = None
    updated_at: str | None = None


SCHEMA = """
CREATE TABLE IF NOT EXISTS market_states (
  cycle_id TEXT NOT NULL, symbol TEXT NOT NULL, as_of TEXT NOT NULL,
  current_regime TEXT NOT NULL, previous_regime TEXT,
  exuberance_score REAL, fragility_score REAL, breakdown_count INTEGER NOT NULL,
  repair_score REAL, buy_tranches_used INTEGER NOT NULL, sell_tranches_used INTEGER NOT NULL,
  last_action TEXT, last_action_date TEXT, last_action_price REAL, cooldown_until TEXT,
  high_water_mark REAL, low_water_mark REAL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  PRIMARY KEY (cycle_id, symbol, as_of)
);
CREATE TABLE IF NOT EXISTS score_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, as_of TEXT NOT NULL,
  score_type TEXT NOT NULL, score REAL, components_json TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS regime_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, cycle_id TEXT NOT NULL, symbol TEXT NOT NULL,
  as_of TEXT NOT NULL, from_regime TEXT, to_regime TEXT NOT NULL, reason_json TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS execution_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT, cycle_id TEXT NOT NULL, symbol TEXT NOT NULL,
  signal_date TEXT NOT NULL, execution_date TEXT, action TEXT NOT NULL, quantity REAL,
  price REAL, cost REAL, status TEXT NOT NULL, metadata_json TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS data_quality_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, dataset TEXT NOT NULL, checked_at TEXT NOT NULL,
  ok INTEGER NOT NULL, report_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS system_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, run_type TEXT NOT NULL, started_at TEXT NOT NULL,
  finished_at TEXT, status TEXT NOT NULL, details_json TEXT
);
"""


class StateStore:
    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)

    def connect(self) -> sqlite3.Connection:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        return connection

    def initialize(self) -> None:
        with closing(self.connect()) as connection:
            with connection:
                connection.executescript(SCHEMA)

    def save(self, state: MarketState) -> MarketState:
        self.initialize()
        now = datetime.now(timezone.utc).isoformat()
        payload = state.model_copy(update={
            "created_at": state.created_at or now,
            "updated_at": now,
            "symbol": state.symbol.upper(),
        })
        columns = list(type(payload).model_fields)
        values = [getattr(payload, column) for column in columns]
        update_columns = [column for column in columns if column not in {"cycle_id", "symbol", "as_of", "created_at"}]
        sql = (
            f"INSERT INTO market_states ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)}) "
            f"ON CONFLICT(cycle_id,symbol,as_of) DO UPDATE SET "
            + ",".join(f"{column}=excluded.{column}" for column in update_columns)
        )
        with closing(self.connect()) as connection:
            with connection:
                connection.execute(sql, values)
        return payload

    def latest(self, symbol: str) -> MarketState | None:
        self.initialize()
        with closing(self.connect()) as connection:
            row = connection.execute(
                "SELECT * FROM market_states WHERE symbol=? ORDER BY as_of DESC, updated_at DESC LIMIT 1",
                (symbol.upper(),),
            ).fetchone()
        return MarketState(**dict(row)) if row else None

    def export_json(self, symbol: str, path: Path) -> Path:
        state = self.latest(symbol)
        if state is None:
            raise LookupError(f"{symbol.upper()}의 저장된 상태가 없습니다.")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(state.model_dump_json(indent=2), encoding="utf-8")
        return path

    def import_json(self, path: Path) -> MarketState:
        state = MarketState.model_validate_json(path.read_text(encoding="utf-8"))
        return self.save(state)

    def log_quality(self, dataset: str, report: dict[str, Any]) -> None:
        self.initialize()
        with closing(self.connect()) as connection:
            with connection:
                connection.execute(
                    "INSERT INTO data_quality_log(dataset,checked_at,ok,report_json) VALUES(?,?,?,?)",
                    (dataset, datetime.now(timezone.utc).isoformat(), int(bool(report["ok"])), json.dumps(report, ensure_ascii=False)),
                )
