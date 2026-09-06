# Agent handoff log

Living record of work completed on CAMASE. Append, do not rewrite history.

---

## Session 1 — 2026-09-06

### Intent
Stand up the entire project from the v2.1 paper + objectives + Review-1 deck:
engine, audits, ablation, Heston track, lab dashboard, and push to
`https://github.com/ShrikarT/major-project`.

### Done

- Wrote `plan.md`, `claude.md`, `agen_hanoff.md`, `README.md`.
- Implemented Python package `camase/`:
  - causal à trous db4 cascade + circular leaky twin
  - Joseph-form IRW Kalman filter
  - two-sided EWMA covariance adaptation
  - shadow NIS / 3-of-5 / CUSUM gate
  - Heston-with-jumps A1/A2/A3
  - models M0–M7 and M5′–M7′
  - Track A/B metrics, costed strategy, evaluation harness
  - Audits A, B, C
- Ported the same engine to `src/lib/camase/*` for the in-browser lab.
- Built dashboard routes: `/` lab, `/ablation`, `/audits`, `/paper`.
- Wired `startup.sh` to `npm run dev` on `0.0.0.0:8080`.
- Added `tests/` for Audits A/B and Kalman smoke checks.
- Pushed milestones to `ShrikarT/major-project` (empty repo at start).

### Defaults locked

| Symbol | Value |
|---|---|
| wavelet | db4, L = 8 |
| J, N, k | 4, 512, 64 |
| warm-up | 169 samples |
| M, persist | 60, 3-of-5 |
| clip | 10× |
| cost | 20 bp round-trip |

### Known limits (honest)

- Track B uses a generated BTC-like path in the browser (no live Binance key
  in this sandbox). Python CLI can ingest a CSV of bars when provided.
- M8 IMM and M9 UKF are specified in the paper and stubbed as future work;
  the live ladder ships M0–M7 + leaky twins, which is what Objectives 4–5
  require for Review-2.
- Group delay is estimated from the converged static gain, not a full
  frequency sweep UI (helper is in `metrics`).

### Next agent should

1. Confirm `pytest tests/ -q` is still green after any wavelet edit.
2. If adding M8/M9, keep them off the causal hot path until audited.
3. If real BTC CSV lands, hash it and run Track B through `evaluation.py`.
4. Never relax Audit A to a tolerance. Bitwise means bitwise.
