# Agent handoff log

Living record of work completed on CAMASE. Append, do not rewrite history.
Any new agent must read this file + `claude.md` + `plan.md` first.

Repo: https://github.com/ShrikarT/major-project
Push account: GitHub connector / `gh` login **ShrikarT** (id 132975062).

---

## Current state (read this first)

Engine + audits + real Binance window + published calibration are in.
**Paper defaults are locked.** A `review2` profile exists for comparison
only. On the current Heston generator **M6 does not beat M2**; **M8 often
beats both**. Gate FAR on A1 is 0 HOLDs in 2500 bars (conservative).

| Area | Status |
|---|---|
| Causal cascade + Audits A/B/C | DONE |
| M0–M9 + leaky twins (Python + TS) | DONE |
| Track B loader + Binance fetch | DONE · 6000 1m bars hashed |
| Purged WF + DSR + per-bar Sharpe | DONE |
| Calibration paper vs review2 | DONE · `results/calibration.json` |
| A1 gate FAR log | DONE · `results/far_a1.json` |
| Wavelet filter tests | DONE |
| pytest | 26 passed |
| Multi-month BTC / thesis PDF | NOT DONE |

Defaults: db4 L=8, J=4, N=512, k=64, warmup=169, R0=1.2e-7,
σ_a0=2.5e-7, λ=0.995, α=1, β=1, clip 10×, cost 20 bp.

---

## Session 1 — 2026-09-06
Stand-up M0–M7, lab. `0575ce0`, `f254b5d`, `fe0a479`.

## Session 2 — 2026-09-06
Python M8/M9, WF, results page. `b44f8c64`, `c6bcaaa`, `5e0f4ec`.

## Session 3 — 2026-09-06
Binance fetch, Sharpe units, TS M8/M9. `5fee287`, `fd7f0fc`, `95fd564`.

## Session 4 — 2026-09-06

### Done
- Wavelet algebra tests (DC gain, QMF, support 8/22/50/106).
- `camase/calibration.py`: paper vs review2 (λ=0.97, α=0.5, β=1.5).
  M6_beats_M2 is **false** on A2/A3 for both profiles. Not hidden.
- A1 FAR: 0 HOLD / 2331 ready bars.
- BTC window extended to **6000** 1m bars (`--pages 6`).
- `results/README.md` + Results page reading note.
- CLI: `--calibrate`, `--far`, `--profile`.
- pytest: 26 passed.
- Pushed `c1b494e` Milestone 10 (wavelet tests + calibration).
- Pushed `3e5e8d6` Milestone 11 (FAR + 6000-bar BTC + reading notes).

### Still open
1. Months of BTC if the viva wants it (`--pages 20+`).
2. Thesis / viva write-up.
3. Do not silently retune paper defaults to make M6 win.

---

## Next agent should

1. `python3 -m pytest tests/ -q`
2. Push only as **ShrikarT**.
3. Refresh data: `--fetch-btc --pages 6` then `scripts/reproduce_results.py`.
4. Append commit SHAs here after every push.
