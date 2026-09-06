# CLAUDE.md — Agent brief for CAMASE

Read this file AND `agen_hanoff.md` before touching code.
This is the contract for every future agent session.

Paper title: *Causality-Audited Multiscale Adaptive State Estimation for
High-Frequency Financial Time Series* (v2.1, 19 Aug 2026).

Student: T. Shrikar (160123735056) with K. Sri Deepshikha, M. Mohith Srinivasa.
Guide: Dr. Sai Krishna, Dept. of ECE. Batch 118.

Repo (push here, as user ShrikarT via GitHub connector):
https://github.com/ShrikarT/major-project

Live preview must stay on `0.0.0.0:8080`. Do not add auth.

---

## Mission

Ship a **working, audited estimator** plus a **lab dashboard**.
Every claim in the paper that can be executed must be executable here.

If a change would make Audit A or B fail, do not merge it.

---

## Status snapshot (2026-09-06 evening)

Phase 0 engine + Review-2 skeleton is **green**. Full Review-2 / Phase I
artefacts listed under "Work left" are **not** all shipped. Next agent
must continue from `agen_hanoff.md` Session 2 onward.

### Work already done

Engine (Python `camase/` AND TypeScript `src/lib/camase/`):

- [x] Causal à trous cascade, db4, J=4, streaming ring buffer
- [x] Scale-local variance window k=64, E^H / E^L split
- [x] Dimensionless clipped EWMA ratios → R_t and σ²_a,t
- [x] Integrated random walk F(Δt), Q(Δt) with off-diagonals
- [x] Joseph-form covariance update
- [x] Shadow filter with frozen (R0, σ²_a,0)
- [x] Windowed NIS (M=60) vs χ², 3-of-5 persistence, CUSUM
- [x] Heston-with-jumps generator (A1 null, A2 regime, A3 stress)
- [x] Models M0, M1, M2, M3, M4, M4b, M5, M6, M7
- [x] Leaky circular-MODWT twins M5′–M7′
- [x] Track A metrics: RMSE, SNR gain, mean NIS, detection delay, FAR
- [x] Track B-style metrics: one-step MSPE, time-in-market, costed PnL
- [x] Audits A, B as tests; Audit C as leaky-twin comparison
- [x] Group-delay / delay-vs-accuracy helper (static gain only)
- [x] Deflated Sharpe helper (`metrics.deflated_sharpe`)
- [x] Lab console, ablation, audits, paper pages
- [x] Docs: plan.md, claude.md, agen_hanoff.md, README.md
- [x] pytest green (6 tests: audits + Kalman)

### Work left (do these, in this order)

1. **M8 IMM** — 3-mode interacting multiple model (calm / normal / stress
   Q-R pairs). Stay off the causal wavelet hot path. Register as `M8`.
2. **M9 UKF** — unscented Kalman on the same IRW state. Register as `M9`.
   Do not replace Joseph M6/M7.
3. **Track B data plane** — CSV loader for BTC/USDT 1m bars
   (`timestamp,open,high,low,close,volume`). Fallback synthetic BTC-like
   path when no CSV is present. Hash the file. Never claim live Binance
   unless a feed is actually wired.
4. **Purged / embargoed walk-forward** — 60/20 expanding folds, embargo
   = wavelet support L_4 = 106 bars (or warmup). Write trial log JSON.
5. **Deflated Sharpe + bootstrap CIs** — run on the walk-forward trial
   log, not on a single in-sample path.
6. **Group-delay vs MA Pareto** — sweep matched moving-average windows
   vs M6 group delay; report delay (bars) vs SNR / MSPE.
7. **Filled Chapter-7 style result tables** — write
   `results/track_a.json`, `results/ablation.json`,
   `results/walkforward.json` from a real run (n≥2000 Track A).
8. **Dashboard pages** for walk-forward + Track B + M8/M9 rows.
9. **Tests** for IMM mixing weights, UKF sigma-point count, walk-forward
   embargo (no train sample in test after purge), Track B loader.
10. Push to `ShrikarT/major-project` via **GitHub connector**
    (`github___push_files`) after each milestone. Authenticated user
    must be `ShrikarT` (id 132975062). Do not use a local `git push`
    from another account.

Out of scope unless the student asks: full thesis PDF rewrite, viva
slides, live Binance websocket, Streamlit (web lab already exists).

---

## Hard rules from the paper

1. **Log-price only.** `y_t = log π_t`. Never adapt on raw price.
2. **Causal FIR only** on the live path. Periodic / symmetric extension is
   allowed solely inside leaky twins (Audit C).
3. **Do not emit during warm-up.** Fabricating boundary samples is leakage.
4. **Joseph form always** on the linear KF path. Short-form P update is banned.
5. **Gate on the shadow filter**, never on the adaptive NIS. Adaptation would
   cancel the very inconsistency the gate is meant to see.
6. **No RMSE / SNR on real prices.** Those need latent truth (Track A only).
7. **Report time-in-market** whenever a gate changes economic metrics.
8. **Costs exist.** Default round-trip 20 bp. Show gross and net.
9. **No zero-lag claim.** Measure group delay. Compare to matched MAs.
10. **Do not overclaim novelty.** Causal à trous is adopted from Quilty &
    Adamowski (2018) / Shensa (1992). The increment is the executable audit,
    HFT transfer, scale-band attribution, shadow gate, and priced leakage.

---

## Key equations (implement exactly)

Support at level j:

```
L_j = (2^j − 1)(L − 1) + 1
L=8 → L1=8, L2=22, L3=50, L4=106
warm-up = L_J + k − 1 = 169
```

IRW process noise:

```
Q(Δt) = σ_a² · [[Δt³/3, Δt²/2],
                 [Δt²/2, Δt  ]]
```

Adaptation:

```
R_t      = R0   · clip( (E^H / Ē^H)^α , 1/cR, cR )
σ_a,t²   = σa0² · clip( (E^L / Ē^L)^β , 1/cQ, cQ )
```

NIS (scalar):

```
NIS = ỹ² / S ,   S = H P Hᵀ + R
```

SNR gain (Track A only):

```
G = 10 log10( Σ(y − p)² / Σ(p̂ − p)² )
```

IMM mixing (M8): standard Blom / Bar-Shalom mixing. Three modes with
fixed (R, σ_a²) = {(0.3 R0, 0.3 σa0), (R0, σa0), (3 R0, 3 σa0)}.
Transition π_ii = 0.92, off-diagonal split equally.

UKF (M9): n=2 state, 5 sigma points, α=1e-3, β=2, κ=0. Additive noise.
Same F, Q, H, R as M1 unless adaptation is explicitly requested.

Walk-forward: purge gap = warmup (169). Embargo after each test fold
equals L_4 (106). No shuffling.

---

## Locked hyperparameters

| Symbol | Value |
|---|---|
| wavelet | db4, L = 8 |
| J, N, k | 4, 512, 64 |
| warm-up | 169 samples |
| M, persist | 60, 3-of-5 |
| clip | 10× |
| cost | 20 bp round-trip |
| R0 | 1.2e-7 |
| σ_a0 | 2.5e-7 |
| χ² α | 0.005 |
| CUSUM κ, h | 1.6, 36 |

---

## File map

```
camase/                 Python research package
  wavelet.py            causal + circular MODWT
  kalman.py             Joseph IRW
  ukf.py                unscented KF (M9)        ← add if missing
  imm.py                3-mode IMM (M8)          ← add if missing
  adaptation.py         two-sided EWMA
  gate.py               shadow NIS / CUSUM
  pipeline.py           M6 / M7 engine
  models.py             ladder runners
  heston.py             Track A generator
  trackb.py             BTC CSV + fallback       ← add if missing
  walkforward.py        purged WF                ← add if missing
  metrics.py            RMSE / SNR / DSR
  evaluation.py         Track A harness
  strategy.py           long/flat + costs
  audits.py             A / B / C
  cli.py                entry
tests/                  pytest
results/                committed JSON tables
data/                   sample BTC-like CSV
src/lib/camase/         Browser-faithful port
src/routes/             Dashboard pages
```

---

## How to run

Web lab (preview): `npm run dev` via `/workspace/startup.sh`.

```
python3 -m pytest tests/ -q
python3 -m camase --audits
python3 -m camase --ablation --track A2 --n 2000
python3 -m camase --track A2 --models M1,M2,M6,M7,M8,M9 --n 2000
python3 -m camase --walkforward --n 4000
python3 -m camase --track-b --csv data/btc_sample.csv
```

---

## How to push

Use the connected GitHub tool as owner `ShrikarT`, repo `major-project`,
branch `main`:

```
github___push_files
  owner=ShrikarT
  repo=major-project
  branch=main
  message="Milestone N: …"
  files=[{path, content}, …]
```

Confirm `github___get_me` login is `ShrikarT` before pushing.
Do not force-push. Do not rewrite milestone history.

---

## What not to do

- Do not pull PyWavelets / filterpy into the *live* causal path.
- Do not fit EWMA baselines on the full sample then replay.
- Do not select the “winning” model on the test fold and hide the rest.
- Do not add auth, accounts, or a database.
- Do not strip Grok preview branding.
- Do not bind the app to a port other than 8080.
- Do not relax Audit A to a tolerance. Bitwise means bitwise.
- Do not claim Track B is real Binance if the path is synthetic.
