# Published tables

Regenerate with `python3 scripts/reproduce_results.py`.

## How to read them

- **Track A / ablation** — RMSE and SNR need latent truth. Only valid on Heston paths.
- **Walk-forward** — `sharpe_net` is **per bar**. `deflated_sharpe` is a probability
  that the mean trial Sharpe survives the trial count. Tiny DSR means “not
  distinguishable from selection bias,” not “the filter is broken.”
- **Track B** — `data/btc_usdt_1m.csv` is a real Binance 1m window when
  `synthetic` is false. No RMSE/SNR here.
- **Calibration** — paper defaults vs `review2` (λ=0.97, α=0.5, β=1.5).
  The paper lock is unchanged. On the current generator **M8 often beats M6**,
  and **M6 does not reliably beat M2** under paper defaults. That is a result.

## Commands

```
python3 -m camase --audits
python3 -m camase --calibrate --out results/calibration.json
python3 -m camase --far --out results/far_a1.json
python3 -m camase --fetch-btc --pages 8 --csv data/btc_usdt_1m.csv
python3 scripts/reproduce_results.py
```
