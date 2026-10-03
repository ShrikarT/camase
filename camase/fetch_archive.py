"""Download public Binance monthly 1m klines from the data archive.

Source: https://data.binance.vision (official public archive, no API key).
Each month is a ZIP of one CSV; months are concatenated oldest-first into a
single gzipped OHLCV file with the Track B header plus a .sha256 sidecar.

SPOT klines are used. Columns kept: timestamp (UTC ISO-8601), open, high,
low, close, volume.
"""

from __future__ import annotations

import csv
import gzip
import hashlib
import io
import sys
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

BASE = "https://data.binance.vision/data/spot/monthly/klines/{sym}/1m/{sym}-1m-{ym}.zip"


def download_month(symbol: str, ym: str) -> list[list[str]]:
    url = BASE.format(sym=symbol, ym=ym)
    req = urllib.request.Request(url, headers={"User-Agent": "camase/0.4"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        blob = resp.read()
    zf = zipfile.ZipFile(io.BytesIO(blob))
    name = zf.namelist()[0]
    rows = []
    with zf.open(name) as f:
        reader = csv.reader(io.TextIOWrapper(f))
        for r in reader:
            rows.append(r)
    return rows


def write_merged(symbol: str, months: list[str], dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    all_rows: list[tuple[str, str, str, str, str, str]] = []
    for ym in months:
        for r in download_month(symbol, ym):
            ts = datetime.fromtimestamp(int(r[0]) / 1e6, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
            all_rows.append((ts, r[1], r[2], r[3], r[4], r[5]))
    all_rows.sort(key=lambda x: x[0])
    # Drop any duplicate bar (month boundaries can overlap by one row).
    seen: set[str] = set()
    uniq = [row for row in all_rows if not (row[0] in seen or seen.add(row[0]))]
    with gzip.open(dest, "wt", newline="") as f:
        w = csv.writer(f)
        w.writerow(["timestamp", "open", "high", "low", "close", "volume"])
        w.writerows(uniq)
    h = hashlib.sha256()
    with dest.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    sidecar = dest.with_suffix(dest.suffix + ".sha256")
    sidecar.write_text(f"{h.hexdigest()}  {dest.name}\n")
    return dest


def main(argv: list[str] | None = None) -> int:
    argv = argv or sys.argv[1:]
    symbols = [s.upper() for s in (argv[0].split(",") if argv and argv[0].strip() else ["BTCUSDT"])]
    months = [m for m in (argv[1].split(",") if len(argv) > 1 else []) if m.strip()]
    if not months:
        months = [f"2026-{m:02d}" for m in range(3, 9)]  # Mar..Aug 2026: latest published
    dest_dir = Path(argv[2]) if len(argv) > 2 else Path("data")
    for sym in symbols:
        base = sym.replace("USDT", "")
        dest = dest_dir / f"trackb_{base}USDT_1m.csv.gz"
        print(f"fetching {sym} {months[0]}..{months[-1]} -> {dest}", flush=True)
        write_merged(sym, months, dest)
        print(f"wrote {dest}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
