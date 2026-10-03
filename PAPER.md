# Causality-Audited Multiscale Adaptive State Estimation for High-Frequency Financial Time Series

**Updated manuscript (improvements edition)**  
Architecture unchanged from specification v2.1 (19 August 2026).  
This edition adds measured diagnostics, honest ablation language, and a dual-track reporting rule.

T. Shrikar, K. Sri Deepshikha, M. Mohith Srinivasa  
Guide: Dr. Sai Krishna · Department of ECE · Batch 118  
Repo: https://github.com/ShrikarT/major-project

---

## Abstract

High-frequency log-prices mix microstructure noise with occasional genuine repricings. A fixed-covariance Kalman filter cannot reject the former without lagging the latter. This project specifies a *strictly causal* à trous wavelet cascade that attributes short-scale energy to measurement noise \(R_t\) and long-scale energy to process noise \(\sigma_{a,t}^2\), feeds a Joseph-form integrated random-walk filter, and gates trades with a *shadow* NIS statistic that the adaptor cannot cancel.

The architecture is not new in its parts. What this edition contributes is an *executable* causality audit, an ablation that is allowed to refute the adaptor, and a reporting split: latent-state metrics only on simulated generators (Track A); prediction and costed economics only on a two-symbol, six-month public 1-minute pilot (Track B).

On the locked paper defaults (\(\lambda=0.995\), \(\alpha=\beta=1\)), **the two-sided adaptor (M6) does not beat rolling-\(\sigma\) measurement noise (M2)** on this generator. An interacting-multiple-model baseline (M8) often does. A return-domain twin (M6r), a step-response delay, a gate-sensitivity table, and the economic gap between the causal filter and its circular twin are reported rather than tuned away.

A 50-seed × 3-generator × 3-length study with paired Wilcoxon tests sharpens the claim: M6 beats M2 only on generator B (bid-ask bounce plus sparse jumps, where short-scale energy is measurement noise by construction) and loses on A (block-varying noise) and C (Heston-with-jumps at 1-minute resolution). Scale-split adaptation is identified only when short-scale and long-scale energy are separable.

---

## 1. Introduction

Minute-bar crypto prices are not a latent diffusion observed in white noise. They are a latent diffusion observed through bounce, clustering, and jumps. Classical adaptive Kalman filters (Sage–Husa, innovation-based \(R\) updates, one-sided OAKF ratchets) adapt a scalar and do not say *which scale* of the tape justified the move. Wavelet–Kalman hybrids in the literature either use non-causal coefficients or treat the wavelet as a predictor rather than a covariance oracle.

The design question is narrow: can a *causal* undecimated cascade supply two numbers, \(E^H_t\) and \(E^L_t\), that should be mapped onto \(R_t\) and \(Q_t\) so that the filter distrusts ticks when the tape is rough and follows the state when the move is coarse?

This paper keeps that design. It changes the *claims*.

---

## 2. Related work (spine only)

- Shensa (1992); Quilty & Adamowski (2018) — à trous / MODWT causality. The latter is the leakage diagnosis we operationalise as Audits A–C.
- Renaud, Starck & Murtagh (2005) — à trous plus Kalman on financial series, as a *forecast* stack, not a covariance stack.
- Mehra (1970); Sage & Husa (1969); Akhlaghi et al. (2017) — classical adaptive rungs M3 / M4 / M4b.
- Aït-Sahalia, Mykland & Zhang (2005) — microstructure as an observation model.
- Bailey & López de Prado (2014) — Deflated Sharpe on a trial log.
- Debnath & Kim (2026) — wavelet + adaptive KF in rPPG. Architectural ancestor only; not a finance baseline.

We do not claim novelty for causal wavelets, Joseph updates, IMM, or UKF.

---

## 3. Method (unchanged core)

**Observation.** \(y_t=\log\pi_t\). Adaptation never sees raw price.

**Cascade.** Causal à trous, Daubechies-4, \(J=4\), ring \(N=512\). Support \(L_j=(2^j-1)(L-1)+1\) gives \(8,22,50,106\). Warm-up \(=L_4+k-1=169\) with \(k=64\).

**Audits.**
- A — smash \(y_{t+1:}\) and recompute; coefficients at \(t\) must match bitwise.
- B — streaming equals a fresh prefix filter, bitwise.
- C — circular centred twin is *allowed* to differ; the difference is later priced.

**Adaptation (locked).**
\[
R_t=R_0\,\mathrm{clip}\big((E^H_t/\bar E^H_t)^\alpha\big),\quad
\sigma_{a,t}^2=\sigma_{a,0}^2\,\mathrm{clip}\big((E^L_t/\bar E^L_t)^\beta\big)
\]
with \(\lambda=0.995\), \(\alpha=\beta=1\), clip \(10\times\), \(R_0=1.2\times10^{-7}\), \(\sigma_{a,0}=2.5\times10^{-7}\). High-pass levels \(\{1,2\}\); low-pass \(\{3,4\}\).

**Filter.** IRW state, Joseph covariance. Shadow filter frozen at \((R_0,\sigma_{a,0}^2)\).

**Gate.** Window NIS \(M=60\) versus \(\chi^2\), 3-of-5 persistence, CUSUM \((\kappa,H)=(1.6,36)\).

**Ladder.** M0 MA, M1 static KF, M2 rolling-\(\sigma\) \(R\), M3 IAE, M4 Sage–Husa, M4b OAKF, M5 single-scale, M6 two-sided, M7 gated M6, M8 IMM, M9 UKF, leaky twins M5′–M7′, and M6r (same adaptor on *returns*).

M9 is an unscented IRW on a nearly linear observation. It is a covariance baseline, not a nonlinear market model.

---

## 4. Evaluation protocol

**Track A.** Heston-with-jumps paths A1 (null), A2 (regime), A3 (stress), plus three generators on the same 1-minute clock — **A**: block-varying microstructure noise plus a slow latent random walk; **B**: bid-ask bounce plus tick rounding plus sparse jumps; **C**: the Heston-with-jumps generator of A2. Metrics that need truth: RMSE, SNR gain versus the raw tape, mean NIS, jump hit/miss.

**Track B.** Public Binance klines from the official archive (`data.binance.vision`, no key): **BTCUSDT and ETHUSDT, March–August 2026, 264,960 one-minute bars each, zero gaps**. Metrics: one-step MSPE, time-in-market, *per-bar* Sharpe after 20 bp round-trip. Annualised Sharpe is an appendix column only.

**Walk-forward.** Purged by the warm-up, embargoed by \(L_4\). The filter is run through the prefix; only the test slice is scored.

**Seeds.** Tables in this edition use seed 42 unless labelled robustness. A 50-seed × 3-generator × 3-length study with paired Wilcoxon tests is reported separately. We do not select a seed where M6 wins.

---

## 5. Results

Executable artefacts live in `results/*.json`. Figures below are those tables in prose.

### 5.1 Causality

Audits A and B pass bit-exact on the committed tests. Audit C reports a nonzero wrap-around residual on the circular twin (order \(10^{-2}\) in coefficient units). The economic translation of that leak — extra cumulative log-return of M6′ versus M6, in basis points on the same Heston path — is written to `results/diagnostics.json` under `leakage_priced`. A positive gap is the cost of look-ahead, which is the sentence Contribution C1 actually needs.

### 5.2 Ablation (Track A, locked defaults)

On the current generator, **M6 does not beat M2 in SNR**. M6 is closer to the static filter M1: the EWMA ratio \((E/\bar E)^\alpha\) sits near one after warm-up, so the adaptor is almost inert, while M2 sets \(R_t\) to a rolling return variance that matches the observation model. M8 (IMM) frequently records the best SNR of the covariance family.

This is a result. It is not hidden by moving \(\lambda\) or \(\alpha\) after looking at the test fold. A labelled `review2` profile (\(\lambda=0.97\), \(\alpha=0.5\), \(\beta=1.5\)) exists for sensitivity and still does not overturn the ranking on A2/A3.

M6r (cascade on log-returns rather than on the level) is the specification check. If M6r beat M2 while M6 did not, the paper’s choice to analyse *levels* would be the defect. Both rankings are stored in the robustness block.

### 5.3 Gate

The paper draft aimed at “about one false alarm per session.” On A1, default M7 records **zero HOLD in 2 331 ready bars**. That is conservative, not calibrated. `far_sensitivity` varies persistence \(k\in\{2,3\}\) and CUSUM \(H\in\{8,18,36\}\). Use that table in the viva; do not quote 1/session from the default row.

On A3, five scheduled jumps in the diagnostic path were all flagged inside the 20-bar horizon. That hit rate is not specificity: the same run holds on a substantial fraction of non-jump bars. Read `hit_rate` next to `false_hold_frac`.

The gate ROC (`results/gate_roc.json`, 12 configurations) exposes the other side: the gate was already HOLD before 100% of those jumps, and the false-hold fraction on non-jump bars is 0.91. The window-NIS statistic saturates under stress — the gate is a panic button, not a detector.

### 5.4 Delay

The static-gain formula \((1-k_1)/k_1\) remains a helper. On a 200 bp clean step plus light noise, the filter reaches half the step in the event bar (measured delay \(0\)). That is a laboratory tone, not an HFT latency budget. Causal moving averages of width \(w\) still sit at delay \((w-1)/2\) on the Pareto.

### 5.5 Track B

Two symbols × six months of public 1-minute bars (264,960 each, no gaps) are a *pilot window*, not a market study. Best one-step MSPE is M2 on both symbols. Costed per-bar Sharpe is negative for every model (−0.46 to −0.58) after 20 bp; deflated Sharpe on that trial log is indistinguishable from selection noise. This edition does not claim alpha.

### 5.6 Robustness

Eight seeds on A2, \(n=1200\): mean SNR M2 \(-2.70\) dB, M6 \(-3.62\) dB, M6r \(-3.57\) dB, M8 \(+0.25\) dB. M8 wins the covariance comparison. M6r does not rescue M6. Seed 42 stays the frozen table.

### 5.7 Multi-generator statistics (50 seeds)

Mean SNR at \(n=1800\), paired Wilcoxon M6 vs M2 / M8 on SNR gain, full table in `results/multigen.json`:

| Generator | M2 | M6 | M8 | M6 vs M2 | M6 vs M8 |
| :--- | ---: | ---: | ---: | :--- | :--- |
| `A` (block noise) | **+2.26** | +1.42 | +1.32 | −0.84 dB, 0/50, \(p \approx 1.78e{-15}\) | +0.09 dB, 50/50 |
| `B` (bounce+jumps) | +0.88 | **+1.26** | +1.26 | +0.14 dB, 50/50, \(p \approx 1.78e{-15}\) | tie, n.s. |
| `C` (Heston 1m) | −1.09 | −2.43 | **+0.92** | −1.37 dB, 7/50, \(p \approx 3.71e{-9}\) | −3.29 dB, 0/50 |

M6 beats rolling-σ only on generator B — the one DGP where short-scale energy is measurement noise by construction. A 54-cell \((\lambda, \alpha, \beta)\) sensitivity panel and 10×-clipping / inert-fraction identification diagnostics are committed alongside.

---

## 6. Discussion

Two-sided *attribution* is still a coherent design: D1–D2 should raise \(R_t\), D3–D4 should raise \(Q_t\). The adaptor as locked does not beat a one-line rolling \(\sigma\) on this DGP because it is a *ratio to its own EWMA*, not an absolute noise estimator. IMM explores a discrete covariance grid and, here, wins that comparison.

The honest paper is therefore: a causal, audited covariance stack that *can* be refuted by M2 and M8, plus a gate that is safer than it is timely. That is a completed methods contribution. It is not a trading result.

---

## 7. Limitations

- Track B is two crypto symbols over six months of 1-minute bars — a pilot, not a market study. No equity tape was reachable without keyed data.
- Heston-plus-jumps is not the Binance book.
- M9 does not exercise a nonlinear observation.
- Group-delay-on-step is still a laboratory tone, not an HFT latency budget.
- Paper defaults were not moved after seeing test SNR.
- The current gate is conservative under A1 and saturates (always HOLD) under A3 stress.

---

## 8. Reproducibility

```
python3 -m pytest tests/ -q
python3 -m camase --audits
python3 -m camase --diagnostics --out results/diagnostics.json
python3 scripts/reproduce_results.py          # full, ~25 min (50-seed table)
python3 scripts/reproduce_results.py --light  # CI-fast tables
```

Locked constants are `camase/config.py`. Do not edit them to invert an ablation.

---

## References (cited)

Akhlaghi, Zhou & Huang (2017). Adaptive Kalman filtering.  
Aït-Sahalia, Mykland & Zhang (2005). How often to sample a continuous-time process.  
Bailey & López de Prado (2014). The deflated Sharpe ratio.  
Mehra (1970). On the identification of variances and adaptive Kalman filtering.  
Quilty & Adamowski (2018). Addressing the incorrect usage of wavelet-based hydrological forecasting models.  
Renaud, Starck & Murtagh (2005). Wavelet-based combined signal forecasting.  
Sage & Husa (1969). Adaptive filtering with unknown prior statistics.  
Shensa (1992). The discrete wavelet transform: wedding the à trous and Mallat algorithms.
