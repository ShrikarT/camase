# Agent handoff log

Living record of work completed on CAMASE. Append, do not rewrite history.
Any new agent must read this file + `claude.md` + `plan.md` first.

Repo: https://github.com/ShrikarT/major-project
Push account: GitHub connector / `gh` login **ShrikarT** (id 132975062).

---

## Current state (read this first)

Review-2 engine is in place. Session 3 added a **real** Binance BTCUSDT
1m pull (no API key), per-bar Sharpe (annualised column separate),
JSON sanitizer, TypeScript M8/M9, extra tests, and a reproduce script.

| Area | Status | Where |
|---|---|---|
| Causal à trous + Audits A/B/C | DONE | `camase/wavelet.py`, `tests/test_audits.py` |
| Joseph IRW + two-sided adapt + gate | DONE | kalman / adaptation / gate |
| Heston A1/A2/A3 | DONE | `camase/heston.py` |
| Ladder M0–M9 + leaky twins | DONE | `camase/models.py` + TS port |
| Track B CSV loader | DONE | `camase/trackb.py` |
| Binance public fetch | DONE | `camase/fetch_btc.py` |
| Real BTCUSDT 1m sample | DONE | `data/btc_usdt_1m.csv` (3000 bars, hashed) |
| Synthetic fallback CSV | DONE | `data/btc_sample.csv` |
| Purged/embargoed WF + DSR | DONE | `camase/walkforward.py` |
| Per-bar vs annualised Sharpe | DONE | `camase/strategy.py` |
| Group-delay vs MA Pareto | DONE | `camase/pareto.py` |
| JSON-safe dumps | DONE | `camase/jsonutil.py` |
| Result tables + `/results` | DONE | `results/`, `src/routes/results.tsx` |
| Reproduce script | DONE | `scripts/reproduce_results.py` |
| pytest | 18 passed | audits, kalman, m8/m9, trackb/wf, metrics |
| Multi-month BTC history | NOT DONE | fetch more `--pages` or drop a dump |
| Thesis PDF rewrite | NOT DONE | out of scope unless asked |

Locked defaults unchanged: db4 L=8, J=4, N=512, k=64, warmup=169,
R0=1.2e-7, σ_a0=2.5e-7, clip 10×, cost 20 bp.

Honest metrics notes:
- `sharpe_net` is now **per bar**. `sharpe_net_ann` is √(365·24·60).
  Deflated Sharpe should be read against the per-bar column.
- M6 SNR vs M2 still depends on seed / length. Do not cherrypick.
- WF runs the filter through the purge prefix so M6/M7 warm up first.

---

## Session 1 — 2026-09-06

Stand-up: engine M0–M7, audits, lab. Commits `0575ce0`, `f254b5d`, `fe0a479`.

---

## Session 2 — 2026-09-06

M8 IMM, M9 UKF (Python), synthetic Track B, purged WF, results page.
Commits `b44f8c64`, `c6bcaaa`, `5e0f4ec`.

---

## Session 3 — 2026-09-06

### Intent
Keep building, log handoff, push each milestone as ShrikarT, land
improvements that were blocking honest Review-2 numbers.

### Done
- Public Binance fetch (`camase/fetch_btc.py`), no key.
  `python3 -m camase --fetch-btc --pages 3 --csv data/btc_usdt_1m.csv`
  wrote 3000 BTCUSDT 1m bars,
  sha256 `86087d4b96f83a8b8d4b7547bcbbb6c9e2f475444d266862bd48536a533c99f0`.
- Per-bar Sharpe + separate annualised column so DSR is not ~0.
- `jsonutil.sanitize` / `dump` so result files are valid JSON.
- TypeScript IMM + UKF; live ablation now includes M8/M9.
- Extra tests: clip, χ² threshold, sanitizer, Sharpe units.
- `scripts/reproduce_results.py` refreshes `results/` and the published copies.
- Regenerated Track B tables on the real CSV (`synthetic: false`).
- Pushed `5fee287` Milestone 8 (Binance fetch + CSV).
- Pushed `fd7f0fc` Milestone 9 (Sharpe units, TS M8/M9, reproduce).

### Still open
1. Longer BTC history (`--pages 20+`) if Review-2 wants weeks, not hours.
2. Optional calibration pass if M6 must beat M2 on a published seed.
3. Thesis / viva write-up.

---

## Next agent should

1. `python3 -m pytest tests/ -q` — must stay green. Audit A is bitwise.
2. Push only as **ShrikarT**.
3. To refresh exchange data: `--fetch-btc` then `scripts/reproduce_results.py`.
4. Append the new commit SHA here after every push.
