# CAMASE

Causality-Audited Multiscale Adaptive State Estimation for high-frequency
financial time series.

Paper v2.1 · ECE Batch 118 · T. Shrikar, K. Sri Deepshikha, M. Mohith Srinivasa.

Repo: https://github.com/ShrikarT/major-project

## What lives here

- `camase/` — Python research package (NumPy / SciPy). The paper artefact.
- `tests/` — Audits A/B plus IMM, UKF, Track B, walk-forward contracts.
- `src/lib/camase/` — Browser-faithful TypeScript port used by the lab.
- `src/routes/` — Lab, ablation, audits, results, paper.
- `results/` — committed Chapter-7 style tables from the Python engine.
- `data/btc_sample.csv` — hashed *synthetic* BTC-like 1m OHLCV. Not Binance.
- `plan.md` — architecture.
- `claude.md` — agent contract (done vs left).
- `agen_hanoff.md` — work log.

## Python

```bash
python3 -m pytest tests/ -q
python3 -m camase --audits
python3 -m camase --ablation --track A2 --n 2000
python3 -m camase --track A2 --models M1,M2,M6,M7,M8,M9 --n 2000
python3 -m camase --walkforward --n 2800
python3 -m camase --pareto --n 1600
python3 -m camase --fetch-btc --pages 3 --csv data/btc_usdt_1m.csv
python3 scripts/reproduce_results.py
```

## Lab

Dashboard on `0.0.0.0:8080`. Live traces use synthetic Heston paths.
The `/results` page renders the committed Python tables.

## Causality

Live path: causal FIR à trous, db4, J=4. No periodic extension.
Warm-up = L_4 + k − 1 = 169 samples. Audits A/B are bitwise.

## Status

Engine M0–M9 + leaky twins + audits + purged walk-forward + Track B loader
are implemented. Replace `data/btc_sample.csv` with a real BTC/USDT dump
(same header) before claiming Track B as market data.
