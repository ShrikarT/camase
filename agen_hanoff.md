# Agent handoff log

Living record of work completed on CAMASE. Append, do not rewrite history.
Any new agent must read this file + `claude.md` + `plan.md` first.

Repo: https://github.com/ShrikarT/major-project
Push account: GitHub connector / `gh` login **ShrikarT** (id 132975062).

---

## Current state (read this first)

Phase-0 engine is green. Session 2 added M8/M9, Track B loader, purged
walk-forward, group-delay Pareto, committed result tables, and a Results
page. A real Binance dump is still not in the repo — the sample CSV is
explicitly synthetic.

| Area | Status | Where |
|---|---|---|
| Causal à trous db4 J=4 | DONE | `camase/wavelet.py`, `src/lib/camase/wavelet.ts` |
| Audits A / B (bitwise) | DONE, pytest green | `camase/audits.py`, `tests/test_audits.py` |
| Audit C leaky twin | DONE | same |
| Joseph IRW KF | DONE | `camase/kalman.py` |
| Two-sided EWMA adapt | DONE | `camase/adaptation.py` |
| Shadow NIS + 3-of-5 + CUSUM | DONE | `camase/gate.py` |
| Heston A1/A2/A3 | DONE | `camase/heston.py` |
| Ladder M0–M7 + M5′–M7′ | DONE | `camase/models.py` |
| M8 IMM | DONE | `camase/imm.py` |
| M9 UKF | DONE | `camase/ukf.py` |
| Track A harness | DONE | `camase/evaluation.py` |
| Track B BTC CSV | DONE (synthetic sample) | `camase/trackb.py`, `data/btc_sample.csv` |
| Purged/embargoed WF | DONE | `camase/walkforward.py` |
| Deflated Sharpe on trials | DONE | `walkforward.run_walkforward` summary |
| Group-delay vs MA Pareto | DONE | `camase/pareto.py` |
| Costed long/flat | DONE | `camase/strategy.py` |
| Lab / Ablation / Audits / Paper UI | DONE | `src/routes/*` |
| Results UI | DONE | `src/routes/results.tsx` |
| Result JSON tables | DONE | `results/*.json` |
| pytest | 14 passed | audits, kalman, m8/m9, trackb/wf |
| Live Binance feed | NOT DONE | needs a real CSV / API key |
| Thesis PDF rewrite | NOT DONE | out of scope unless asked |

Locked defaults: db4 L=8, J=4, N=512, k=64, warmup=169, R0=1.2e-7,
σ_a0=2.5e-7, clip 10×, cost 20 bp, NIS M=60, persist 3-of-5,
χ² α=0.005, CUSUM κ=1.6 h=36.

Honest metrics notes:
- Minute-bar Sharpe is annualised with √(365·24·60) and looks extreme on
  short folds. Use Deflated Sharpe + time-in-market, not the raw SR.
- M6 SNR vs M2 depends on the seed / length. Do not cherrypick.
- WF runs the filter through the purge prefix so M6/M7 warm up before
  the scored test slice.

---

## Session 1 — 2026-09-06

Stand-up: engine M0–M7, audits, lab, Milestone 0–2 commits
`0575ce0`, `f254b5d`, `fe0a479`.

---

## Session 2 — 2026-09-06

### Intent
Handoff docs, then remaining Review-2 pieces, push as ShrikarT.

### Done
- Confirmed connector identity: `ShrikarT` / 132975062.
- Rewrote `claude.md` and this file (done vs left).
- Docs push: `b44f8c64` Milestone 3.
- Code push: `c6bcaaa` Milestone 4–7 (M8/M9, Track B, WF, results).
- M8 IMM (calm/normal/stress, π_ii=0.92) in `camase/imm.py`.
- M9 UKF (5 sigma points, α=1e-3, β=2, κ=0) in `camase/ukf.py`.
- Track B loader + hashed synthetic sample `data/btc_sample.csv`
  sha256 `4f7853fcfe847a0afee1fb24039397d78762291457ad1e6de72557eeb1c17efb`.
- Purged/embargoed walk-forward; test slice scored after purge warm-up.
- Bootstrap CI + Deflated Sharpe on the trial log.
- Group-delay vs MA Pareto (`camase/pareto.py`).
- CLI flags: `--walkforward`, `--track-b`, `--pareto`.
- Committed tables in `results/` and `/results` lab page.
- pytest: 14 passed.

### Milestone checklist
- [x] M3 docs push (`claude.md`, `agen_hanoff.md`) — `b44f8c64`
- [x] M4 M8 IMM + M9 UKF + tests
- [x] M5 Track B loader + sample data
- [x] M6 purged walk-forward + DSR + group-delay Pareto
- [x] M7 committed `results/*.json` + CLI
- [x] M8 dashboard `/results`
- [x] pytest green

### Still open for a later agent
1. Drop in a real BTC/USDT 1m CSV (same header), hash it, rerun
   `python3 -m camase --track-b --csv …` and replace `results/track_b.json`.
2. Longer Track A (n≥8000) if Review-2 wants stabler SNR.
3. Optional TS ports of M8/M9 for live ablation (Python is source of truth).
4. Do not claim live Binance.

---

## Next agent should

1. `python3 -m pytest tests/ -q` — must stay green. Audit A is bitwise.
2. Push with GitHub connector or `gh` as **ShrikarT** only.
3. If a real BTC CSV lands, hash it and store `data/<file>.sha256`.
4. Append a note here with the new commit SHA after every push.
