# CLAUDE.md — Agent brief for CAMASE

Read this file before touching code. It is the contract for every future agent
session on this major project.

Paper title: *Causality-Audited Multiscale Adaptive State Estimation for
High-Frequency Financial Time Series* (v2.1, 19 Aug 2026).

Student: T. Shrikar (160123735056) with K. Sri Deepshikha, M. Mohith Srinivasa.
Guide: Dr. Sai Krishna, Dept. of ECE. Batch 118.

---

## Mission

Ship a **working, audited estimator** and a **lab dashboard**, not a slide deck.
Every claim in the paper that can be executed must be executable here.

If a change would make Audit A or B fail, do not merge it.

---

## What to build (complete checklist)

### Engine (Python `camase/` AND TypeScript `src/lib/camase/`)

Keep the two implementations numerically aligned (same filters, same Joseph
update, same clip/EWMA). The dashboard runs the TS engine in the browser.
The paper / pytest suite runs the Python engine.

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
- [x] Group-delay / delay-vs-accuracy helper

### Dashboard (TanStack Start, port 8080)

- [x] Lab console with live traces
- [x] Ablation ladder view
- [x] Audit runner view
- [x] Paper / objectives / literature view

### Docs

- [x] `plan.md` — architecture
- [x] `claude.md` — this file
- [x] `agen_hanoff.md` — work log
- [x] `README.md` — how to run

---

## Hard rules from the paper

1. **Log-price only.** `y_t = log π_t`. Never adapt on raw price.
2. **Causal FIR only** on the live path. Periodic / symmetric extension is
   allowed solely inside leaky twins (Audit C).
3. **Do not emit during warm-up.** Fabricating boundary samples is leakage.
4. **Joseph form always.** Short-form P update is banned.
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

---

## File map

```
camase/                 Python research package
tests/                  pytest: audits, wavelet, kalman
src/lib/camase/         Browser-faithful port
src/routes/             Dashboard pages
src/components/camase/  Charts and chrome
```

---

## How to run

Web lab (preview): `npm run dev` via `/workspace/startup.sh`.

Python audits:

```
python3 -m pytest tests/ -q
python3 -m camase.cli --track A2 --models M1,M2,M6,M7 --n 4000
```

---

## What not to do

- Do not pull PyWavelets / filterpy into the *live* causal path.
- Do not fit EWMA baselines on the full sample then replay.
- Do not select the “winning” model on the test fold and hide the rest.
- Do not add auth, accounts, or a database.
- Do not strip Grok preview branding.
- Do not bind the app to a port other than 8080.
