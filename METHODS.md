# Methods card (viva)

One page. Numbers live in `results/*.json`.

## Estimator
- Observation: `y_t = log π_t`.
- Causal à trous db4, J=4, ring N=512, variance window k=64, warmup 169.
- High scales (1,2) scale `R_t`. Low scales (3,4) scale `σ²_a,t`.
- Joseph-form IRW Kalman. Shadow filter frozen at `(R0, σ²_a0)`.
- Gate: window NIS M=60 vs χ², 3-of-5 persistence, CUSUM (κ=1.6, H=36).

## Locked defaults
R0 = 1.2e-7, σ_a0 = 2.5e-7, λ=0.995, α=β=1, clip 10×, cost 20 bp.

`review2` (λ=0.97, α=0.5, β=1.5) is comparison only.

## Evaluation
- Track A: Heston A1/A2/A3 with latent truth → RMSE, SNR, NIS.
- Track B: real BTCUSDT 1m → MSPE / Sharpe / time-in-market only.
- Walk-forward: purge = warmup, embargo = L4, score test slice after running the prefix.
- DSR on the trial log of **per-bar** Sharpe.

## What the code actually found
- Audits A/B pass. C fails the circular twin (as designed).
- M6 does not reliably beat M2 on this generator. M8 often does.
- A1 FAR ≈ 0 holds / day on 2500 bars.
- Track B 6000-bar window: costed Sharpe negative. Do not claim alpha.

## Reproduce
```
python3 -m pytest tests/ -q
python3 -m camase --audits
python3 scripts/reproduce_results.py
```
