# Track B data

## `trackb_BTCUSDT_1m.csv.gz` / `trackb_ETHUSDT_1m.csv.gz` (preferred)

Public Binance 1-minute klines from the official archive (`data.binance.vision`, no API key), Mar–Aug 2026: **264,960 bars each**, no gaps. Downloaded with

```
python3 -m camase.fetch_archive "BTCUSDT,ETHUSDT" "" data
```

Each `.gz` has a `.sha256` sidecar. Header: `timestamp,open,high,low,close,volume` (UTC ISO-8601).

## `btc_usdt_1m.csv` (superseded pilot)

The original 6,000-bar BTCUSDT window (hours, not months). Kept for provenance; no longer used by `scripts/reproduce_results.py`. Do not cite market claims from it.

## `btc_sample.csv`

Synthetic BTC-like path from `camase.trackb.synthetic_btc` (seed=7,
n=1500). Kept so tests and offline demos do not depend on the network.
