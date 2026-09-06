"""Track B data plane: BTC/USDT 1m CSV loader + labelled synthetic fallback.

A file is "real" only when it is loaded from disk and hashed. The
fallback path is explicitly tagged synthetic so the dashboard cannot
claim live Binance.
"""

from __future__ import annotations

import csv
import hashlib
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np


REQUIRED = ("timestamp", "open", "high", "low", "close", "volume")


@dataclass
class TrackBPath:
    timestamp: np.ndarray
    open: np.ndarray
    high: np.ndarray
    low: np.ndarray
    close: np.ndarray
    volume: np.ndarray
    source: str
    sha256: Optional[str]
    synthetic: bool

    @property
    def price(self) -> np.ndarray:
        return self.close

    @property
    def log_price(self) -> np.ndarray:
        return np.log(np.maximum(self.close, 1e-12))


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()


def load_ohlcv_csv(path: str | Path) -> TrackBPath:
    path = Path(path)
    if not path.is_file():
        raise FileNotFoundError(path)
    rows = []
    with path.open(newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            raise ValueError("CSV has no header")
        cols = [c.strip().lower() for c in reader.fieldnames]
        missing = [c for c in REQUIRED if c not in cols]
        if missing:
            raise ValueError(f"CSV missing columns {missing}; have {cols}")
        remap = {c.strip().lower(): c for c in reader.fieldnames}
        for raw in reader:
            rows.append({k: raw[remap[k]] for k in REQUIRED})
    if len(rows) < 2:
        raise ValueError("CSV too short")
    ts = np.array([r["timestamp"] for r in rows])
    def col(name: str) -> np.ndarray:
        return np.array([float(r[name]) for r in rows], dtype=np.float64)
    digest = file_sha256(path)
    return TrackBPath(
        timestamp=ts,
        open=col("open"),
        high=col("high"),
        low=col("low"),
        close=col("close"),
        volume=col("volume"),
        source=str(path),
        sha256=digest,
        synthetic=False,
    )


def synthetic_btc(n: int = 3000, seed: int = 7, start: float = 65000.0) -> TrackBPath:
    """BTC-like 1m path: Heston-ish vol + jumps + bid-ask microstructure.

    Tagged synthetic. Not a Binance dump.
    """
    rng = np.random.default_rng(seed)
    dt = 1.0 / (365 * 24 * 60)
    mu = 0.0
    kappa, theta, xi = 1.8, 0.55, 0.35
    v = theta
    logp = np.log(start)
    close = np.empty(n)
    jump = rng.random(n) < 0.004
    for t in range(n):
        v = abs(v + kappa * (theta - v) * dt + xi * np.sqrt(max(v, 1e-8) * dt) * rng.normal())
        jump_sz = rng.normal(0, 0.004) if jump[t] else 0.0
        micro = rng.normal(0, 0.00012)
        logp = logp + (mu - 0.5 * v) * dt + np.sqrt(max(v, 1e-8) * dt) * rng.normal() + jump_sz
        close[t] = np.exp(logp + micro)
    open_ = np.concatenate([[close[0]], close[:-1]])
    spread = 0.0002 * close
    high = np.maximum(open_, close) + np.abs(rng.normal(0, 1, n)) * spread
    low = np.minimum(open_, close) - np.abs(rng.normal(0, 1, n)) * spread
    vol = rng.lognormal(mean=2.2, sigma=0.6, size=n)
    ts = np.arange(n).astype(str)
    return TrackBPath(
        timestamp=ts,
        open=open_,
        high=high,
        low=low,
        close=close,
        volume=vol,
        source="synthetic_btc",
        sha256=None,
        synthetic=True,
    )


def load_track_b(csv_path: Optional[str] = None, n: int = 3000, seed: int = 7) -> TrackBPath:
    if csv_path:
        return load_ohlcv_csv(csv_path)
    return synthetic_btc(n=n, seed=seed)


def write_sample_csv(path: str | Path, n: int = 1500, seed: int = 7) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    bars = synthetic_btc(n=n, seed=seed)
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(list(REQUIRED))
        for i in range(n):
            w.writerow(
                [
                    bars.timestamp[i],
                    f"{bars.open[i]:.4f}",
                    f"{bars.high[i]:.4f}",
                    f"{bars.low[i]:.4f}",
                    f"{bars.close[i]:.4f}",
                    f"{bars.volume[i]:.6f}",
                ]
            )
    return path
