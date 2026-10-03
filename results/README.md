# Published tables

Regenerate with `python3 scripts/reproduce_results.py` (full, ~25 min: includes the 50-seed multi-generator table) or `python3 scripts/reproduce_results.py --light` (CI-fast tables).

## How to read them

- **Track A / ablation** — RMSE and SNR need latent truth. Only valid on simulated paths (generators A/B/C, Heston A1/A2/A3).
- **multigen.json** — 50 seeds × 3 generators × 3 lengths; paired Wilcoxon M6 vs M2/M8/M10/M11 on SNR and MSPE. M6 beats M2 only on generator B.
- **identification.json** — is the adaptor actually adaptive? Energy ratios, clip/inert fractions, D1–D2 vs residual coherence. Plots in `results/plots/`.
- **gate_roc.json** — FAR/day on A1 vs hit rate on A3 across (persist_k, cusum_h, chi2_alpha). The gate was already HOLD before 100% of A3 jumps.
- **Walk-forward** — `sharpe_net` is **per bar**. `deflated_sharpe` is a probability
  that the mean trial Sharpe survives the trial count. Tiny DSR means “not
  distinguishable from selection bias,” not “the filter is broken.”
- **Track B** — `data/trackb_{BTC,ETH}USDT_1m.csv.gz`: public Binance 1m klines from the official archive, Mar–Aug 2026, 264,960 bars each, no gaps. `data/btc_usdt_1m.csv` is the superseded 6,000-bar pilot. No RMSE/SNR here.
- **Calibration** — paper defaults vs `review2` (λ=0.97, α=0.5, β=1.5).
  The paper lock is unchanged. On the current generator **M8 often beats M6**,
  and **M6 does not reliably beat M2** under paper defaults. That is a result.

## Commands

```
python3 -m camase --audits
python3 -m camase --calibrate --out results/calibration.json
python3 -m camase --far --out results/far_a1.json
python3 -m camase.fetch_archive "BTCUSDT,ETHUSDT" "" data
python3 -m camase --fetch-btc --pages 8 --csv data/btc_usdt_1m.csv
python3 scripts/reproduce_results.py
```
