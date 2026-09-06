# Track B data

## `btc_usdt_1m.csv` (preferred)

Public Binance `BTCUSDT` 1-minute klines pulled with

```
python3 -m camase --fetch-btc --pages 3 --csv data/btc_usdt_1m.csv
```

No API key. SHA-256 is next to the file. This **is** exchange data,
but only a short recent window (a few thousand bars), not a multi-year
dump.

Header: `timestamp,open,high,low,close,volume`

## `btc_sample.csv`

Synthetic BTC-like path from `camase.trackb.synthetic_btc` (seed=7,
n=1500). Kept so tests and offline demos do not depend on the network.

Replace / extend `btc_usdt_1m.csv` with a longer dump before any paper
sentence that needs months of history.
