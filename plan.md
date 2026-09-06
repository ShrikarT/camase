# CAMASE — Architecture Plan

**Causality-Audited Multiscale Adaptive State Estimation**  
Wavelet-driven two-sided covariance adaptation with sequential innovation-consistency gating.

Paper: v2.1 (19 August 2026) · Objectives v2.1 · Review-1 (Batch 118)

---

## 1. What this repository is

A complete, executable implementation of the major-project specification:

1. Strictly causal à trous (undecimated) wavelet cascade, Audits A/B as unit tests.
2. Two-sided scale-attributed Kalman covariance adaptation (Joseph form, IRW state).
3. Shadow-filter NIS + 3-of-5 + CUSUM gate, χ²-calibrated.
4. Ablation ladder M0–M7 plus leaky twins M5′–M7′.
5. Dual-track validation: Heston-with-jumps (Track A) and BTC-style bars (Track B demo).
6. Live lab dashboard (web) plus a modular Python package for the paper.

The live preview is the **instrument panel**. The Python package is the **reproducible research artefact**.

---

## 2. System architecture

```
observation y_t = log π_t
        │
        ▼
┌───────────────────────────┐
│ Causal à trous cascade    │  db4, L=8, J=4, ring N=512
│ Audits A / B / C          │  support L_j = (2^j-1)(L-1)+1
└─────────────┬─────────────┘
              │ D1..D4
              ▼
┌───────────────────────────┐
│ Scale-local variance k=64 │
│ E^H = levels {1,2} → R_t  │
│ E^L = levels {3,4} → σ²a  │
│ clipped EWMA ratios       │
└─────────────┬─────────────┘
              │
     ┌────────┴────────┐
     ▼                 ▼
┌──────────┐     ┌──────────┐
│ Adaptive │     │ Shadow   │  R0, σ²a,0 frozen
│ KF (M6)  │     │ KF       │
│ Joseph   │     │ NIS / S  │
└────┬─────┘     └────┬─────┘
     │                ▼
     │         ┌────────────┐
     │         │ Window NIS │  M=60 vs χ²_M
     │         │ 3-of-5     │
     │         │ CUSUM      │
     │         └─────┬──────┘
     │               │ TRADE / HOLD
     ▼               ▼
  state x̂=[p,v]   gate + diagnostics
```

---

## 3. Modules

| Layer | Python | TypeScript (dashboard) |
|---|---|---|
| Config / defaults | `camase/config.py` | `src/lib/camase/config.ts` |
| Causal wavelet | `camase/wavelet.py` | `src/lib/camase/wavelet.ts` |
| Kalman + Joseph | `camase/kalman.py` | `src/lib/camase/kalman.ts` |
| Two-sided adaptation | `camase/adaptation.py` | `src/lib/camase/adaptation.ts` |
| Shadow gate | `camase/gate.py` | `src/lib/camase/gate.ts` |
| Full step (M6/M7) | `camase/pipeline.py` | `src/lib/camase/pipeline.ts` |
| Heston+jumps | `camase/heston.py` | `src/lib/camase/heston.ts` |
| Ablation M0–M7, leaky | `camase/models.py` | `src/lib/camase/models.ts` |
| Metrics / DSR | `camase/metrics.py` | `src/lib/camase/metrics.ts` |
| Audits A/B/C | `camase/audits.py` | `src/lib/camase/audits.ts` |
| Strategy + costs | `camase/strategy.py` | used in lab view |
| Evaluation harness | `camase/evaluation.py` | lab runner |

---

## 4. Ablation ladder (Objective 4)

| ID | Model | Isolates |
|---|---|---|
| M0 | Fast/slow MA crossover | Naive benchmark |
| M1 | Static KF | Value of state-space filtering |
| M2 | Rolling-σ adaptive R | Any vol proxy? |
| M3 | Mehra IAE | Classical adaptive |
| M4 | Sage–Husa | Joint residual estimator |
| M4b | OAKF ratchet (base paper) | Monotone +Q/+R |
| M5 | Causal single-scale adaptive R | v1 made causal |
| M6 | Two-sided multiscale | C2 |
| M7 | M6 + shadow gate | C3 |
| M5′–M7′ | Circular MODWT twins | Leakage premium |

---

## 5. Dashboard information architecture

| Route | Purpose |
|---|---|
| `/` | Lab console: run Track A, watch price / filter / R_t / Q_t / NIS / gate |
| `/ablation` | Ladder table + SNR / RMSE / MSPE / time-in-market |
| `/audits` | Live Audit A / B runner with bit-exact verdict |
| `/paper` | Objectives, positioning, hypotheses, literature map |

---

## 6. Causality contract (non-negotiable)

- Convolution indices `m ≥ 0` only. No periodic / symmetric extension on the live path.
- Warm-up: emit nothing until `t ≥ L_J + k − 1` (`L_4 = 106`, `k = 64` → 169).
- Audit A: future perturbation leaves `D_{j,t}` bitwise identical.
- Audit B: streaming coefficients ≡ prefix-from-scratch coefficients, bitwise.
- Audit C: leaky twin run in parallel; premium reported, never used as the estimate.

---

## 7. Default hyperparameters

```
N=512  J=4  k=64  L=8 (db4)
J_H={1,2}  J_L={3,4}
λ ≈ 0.995 (demo) / half-life ~1 session (paper)
α=1  β=1  c_R=c_Q=10
M=60  persist=3/5
round-trip cost budget ≈ 20 bp
```

---

## 8. Delivery sequence

1. Docs (`plan.md`, `claude.md`, `agen_hanoff.md`) + package skeleton.
2. Causal wavelet + Audits A/B (Phase 0).
3. Kalman / Joseph / IRW Q + static M1.
4. Two-sided adaptation (M6) + shadow gate (M7).
5. Heston generator A1/A2/A3 + Track A metrics.
6. Full ablation + leaky twins.
7. Lab dashboard + strategy cost model.
8. GitHub push per milestone to `ShrikarT/major-project`.
