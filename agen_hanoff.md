# Agent handoff log

Living record of work completed on CAMASE. Append, do not rewrite history.
Any new agent must read this file + `claude.md` + `plan.md` first.

Repo: https://github.com/ShrikarT/major-project
Push account: GitHub connector login **ShrikarT** (id 132975062).

---

## Current state (read this first)

**Not finished.** Phase-0 engine + lab + Audits A/B are done and green.
Review-2 still needs M8/M9, real Track B plane, purged walk-forward run,
Deflated Sharpe on the trial log, group-delay Pareto, committed result
tables, and dashboard pages for those.

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
| M8 IMM | NOT DONE | add `camase/imm.py` |
| M9 UKF | NOT DONE | add `camase/ukf.py` |
| Track A harness | DONE (short n in lab) | `camase/evaluation.py` |
| Track B BTC CSV | NOT DONE | add `camase/trackb.py` + `data/` |
| Purged/embargoed WF | NOT DONE | add `camase/walkforward.py` |
| Deflated Sharpe helper | DONE (unused in harness) | `camase/metrics.py` |
| Group-delay helper | PARTIAL (static gain only) | `camase/metrics.py` |
| Costed long/flat | DONE | `camase/strategy.py` |
| Lab / Ablation / Audits / Paper UI | DONE | `src/routes/*` |
| WF / Track B / M8-M9 UI | NOT DONE | new routes |
| Result JSON tables | NOT DONE | `results/` |
| pytest | 6 passed | audits + kalman |

Locked defaults: db4 L=8, J=4, N=512, k=64, warmup=169, R0=1.2e-7,
σ_a0=2.5e-7, clip 10×, cost 20 bp, NIS M=60, persist 3-of-5,
χ² α=0.005, CUSUM κ=1.6 h=36.

---

## Session 1 — 2026-09-06

### Intent
Stand up the project from the v2.1 paper + objectives + Review-1 deck:
engine, audits, ablation, Heston track, lab dashboard, push to
`https://github.com/ShrikarT/major-project`.

### Done
- Wrote `plan.md`, `claude.md`, `agen_hanoff.md`, `README.md`.
- Implemented Python package `camase/` (wavelet, Kalman, adaptation,
  gate, Heston, M0–M7 + leaky twins, metrics, strategy, evaluation, audits).
- Ported engine to `src/lib/camase/*` for the in-browser lab.
- Dashboard routes: `/` lab, `/ablation`, `/audits`, `/paper`.
- `startup.sh` → `npm run dev` on `0.0.0.0:8080`.
- `tests/` for Audits A/B and Kalman smoke checks.
- Pushed Milestone 0 / 1 / 2.

### Commits on origin/main after Session 1
- `0575ce0` Milestone 0: project brief, architecture plan, and agent contract
- `f254b5d` Milestone 1: causal wavelet engine, Joseph KF, shadow gate, Track A, lab UI
- `fe0a479` Milestone 2: calibrate R0/Q0, defer lab compute, bit-exact Audit C twin

### Known limits left by Session 1
- Track B in the browser is synthetic. No BTC CSV loader.
- M8 IMM and M9 UKF not implemented.
- Group delay is static-gain only.
- Deflated Sharpe exists but is not run on walk-forward trials.
- No purged/embargoed folds.
- No committed `results/*.json`.

---

## Session 2 — 2026-09-06 (this session)

### Intent
1. Rewrite `claude.md` and `agen_hanoff.md` so a replacement agent knows
   exactly what is done vs left.
2. Push those docs through the **GitHub connector as ShrikarT**
   (not a side account).
3. Implement remaining Review-2 pieces and push after each milestone.

### Done in this session (append as work lands)
- Confirmed GitHub connector identity: login `ShrikarT`, id 132975062.
- Rewrote `claude.md` with done/left checklist, push protocol, M8/M9/WF
  equations, locked hyperparameters.
- Rewrote this handoff with a status table a new agent can act on.

### Still queued when this paragraph was written
M8, M9, Track B loader, walk-forward, DSR-on-trials, Pareto, result
tables, extra dashboard routes, extra tests. Tick them off below as
each milestone is pushed.

### Milestone checklist for Session 2+
- [ ] M3 docs push (`claude.md`, `agen_hanoff.md`)
- [ ] M4 M8 IMM + M9 UKF + tests
- [ ] M5 Track B loader + sample data
- [ ] M6 purged walk-forward + DSR + group-delay Pareto
- [ ] M7 committed `results/*.json` + CLI
- [ ] M8 dashboard routes for WF / Track B / extra models
- [ ] pytest still green; origin/main updated as ShrikarT

---

## Next agent should

1. `python3 -m pytest tests/ -q` — must stay green. Audit A is bitwise.
2. If a box above is unchecked, do that box. Do not restart the engine.
3. Keep M8/M9 off the causal wavelet hot path until they have tests.
4. If a real BTC CSV lands, hash it (`sha256`) and store the hash next
   to the file. Run Track B through the walk-forward harness.
5. Push with `github___push_files` owner=`ShrikarT` repo=`major-project`.
6. After every push, append a short note here (commit SHA + what landed).
