# CAMASE

Causality-Audited Multiscale Adaptive State Estimation for high-frequency
financial time series.

Paper v2.1 · ECE Batch 118 · T. Shrikar, K. Sri Deepshikha, M. Mohith Srinivasa.

## What lives here

- `camase/` — Python research package (NumPy / SciPy). The paper artefact.
- `tests/` — Audits A and B as unit tests. A failure blocks the claim.
- `src/lib/camase/` — Browser-faithful TypeScript port used by the lab.
- `src/routes/` — Lab console, ablation, audits, paper notes.
- `plan.md` — architecture.
- `claude.md` — agent contract.
- `agen_hanoff.md` — work log.

## Python

```bash
python3 -m pytest tests/ -q
python3 -m camase --audits
python3 -m camase --ablation --track A2 --n 2000
python3 -m camase --track A2 --models M1,M2,M6,M7 --n 2000
```

## Lab

The dashboard runs the estimator in the browser on synthetic Heston-with-jumps
paths (Track A). Real BTC CSV can be passed to the Python CLI when available.

## Causality

Live path: causal FIR à trous, db4, J=4. No periodic extension.
Warm-up = L_4 + k − 1 = 169 samples. Audits A/B are bitwise.
