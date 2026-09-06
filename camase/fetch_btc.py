"""Public BTC/USDT 1m klines via Binance REST. No API key.

Endpoint: GET https://api.binance.com/api/v3/klines
Falls back to api.binance.us if .com is blocked.
The CSV is written with the Track B header and hashed.
"""

from __future__ import annotations

import csv
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

from .trackb import REQUIRED, file_sha256

ENDPOINTS = (
    "https://api.binance.com/api/v3/klines",
    "https://api.binance.us/api/v3/klines",
)


def _get(url: str, timeout: float = 20.0) -> list:
    req = urllib.request.Request(url, headers={"User-Agent": "camase/0.3"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_klines(symbol: str = "BTCUSDT", interval: str = "1m", limit: int = 1000, pages: int = 2) -> list[list]:
    """Newest-first pages concatenated, then sorted oldest→newest."""
    rows: list[list] = []
    end_ms: int | None = None
    last_err: Exception | None = None
    for _ in range(pages):
        qs = f"symbol={symbol}&interval={interval}&limit={min(limit, 1000)}"
        if end_ms is not None:
            qs += f"&endTime={end_ms}"
        page = None
        for base in ENDPOINTS:
            try:
                page = _get(f"{base}?{qs}")
                last_err = None
                break
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
                last_err = exc
                continue
        if page is None:
            break
        if not page:
            break
        rows.extend(page)
        end_ms = int(page[0][0]) - 1
        time.sleep(0.15)
    if not rows:
        raise RuntimeError(f"Binance klines unavailable ({last_err})")
    # unique by open time
    by_t = {int(r[0]): r for r in rows}
    return [by_t[t] for t in sorted(by_t)]


def write_klines_csv(rows: list[list], path: str | Path) -> Path:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as f:
        w = csv.writer(f)
        w.writerow(list(REQUIRED))
        for r in rows:
            # kline: 0 open time, 1 open, 2 high, 3 low, 4 close, 5 volume
            w.writerow([int(r[0]), r[1], r[2], r[3], r[4], r[5]])
    digest = file_sha256(path)
    path.with_suffix(path.suffix + ".sha256").write_text(f"{digest}  {path.name}\n")
    return path
