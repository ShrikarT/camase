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
- Track A: Heston A1/A2/A3 plus generators A/B/C (same 1m clock) with latent truth → RMSE, SNR, NIS.
- Statistics: 50 seeds × 3 generators × 3 lengths; paired Wilcoxon M6 vs M2/M8/M10/M11 on SNR and MSPE.
- Identification: E_short/Ebar and E_long/Ebar, D1–D2 vs residual coherence, clip fraction at 10×, inert fraction.
- Gate ROC: FAR/day on A1 vs hit rate on A3 across (persist_k, cusum_h, chi2_alpha).
- Track B: public Binance 1m, BTC+ETH Mar–Aug 2026 (264,960 bars each) → MSPE / Sharpe / time-in-market only.
- Walk-forward: purge = warmup, embargo = L4, score test slice after running the prefix.
- DSR on the trial log of **per-bar** Sharpe.

## What the code actually found
- Audits A/B pass. C fails the circular twin (as designed).
- 50-seed table: M6 beats M2 only on generator B (bounce+jumps); loses on A and C. M8 (IMM) wins the covariance family on Heston-1m.
- Gate: 0 false alarms on A1, but already HOLD before 100% of A3 jumps (false-hold 0.91). Panic button, not detector.
- Track B 2×6-month window: best MSPE is M2 on both symbols; costed Sharpe negative everywhere. Do not claim alpha.

## Reproduce
```
python3 -m pytest tests/ -q
python3 -m camase --audits
python3 scripts/reproduce_results.py          # full, ~25 min (50-seed table)
python3 scripts/reproduce_results.py --light  # CI-fast tables
```
