"""Adaptor identification diagnostics.

The adaptor is only *adaptive* if the EWMA energy ratios actually move.
Report, for every run:

- E_short / Ebar_short and E_long / Ebar_long over time,
- coherence between D1-D2 detail energy and the filter residual,
- fraction of ready bars where the R or Q ratio is clipped at 10x,
- fraction of ready bars where the adaptor is effectively inert
  (|ratio - 1| < 5%).

If the adaptor is clipped or ~1 almost always, it is a static filter with
extra code, not an adaptive one.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import numpy as np
from scipy.signal import coherence

from .adaptation import clip_ratio
from .config import CamaseConfig, DEFAULT_CONFIG
from .generators import GenPath, generate
from .pipeline import CamaseEngine

INERT_TOL = 0.05


def identification_run(
    path: GenPath,
    cfg: Optional[CamaseConfig] = None,
    sample_every: int = 10,
) -> dict:
    """Stream the M6 engine over a path and record adaptor internals."""
    cfg = cfg or DEFAULT_CONFIG
    eng = CamaseEngine(cfg, gated=False)
    n = path.n
    rho_s = np.full(n, np.nan)
    rho_l = np.full(n, np.nan)
    rr = np.full(n, np.nan)
    rq = np.full(n, np.nan)
    clip_r = np.zeros(n, dtype=bool)
    clip_q = np.zeros(n, dtype=bool)
    innov = np.full(n, np.nan)
    d12 = np.full(n, np.nan)
    d34 = np.full(n, np.nan)
    ready = np.zeros(n, dtype=bool)

    for t, px in enumerate(path.price):
        out = eng.step(float(px))
        ready[t] = out.ready
        if not out.ready:
            continue
        e_h, e_l, vars_j = eng.adapt.energies(eng.cascade)
        lam = cfg.ewma_lambda
        r_s = e_h / max(eng.adapt.bar_h, 1e-18)
        r_l = e_l / max(eng.adapt.bar_l, 1e-18)
        ratio_r = (r_s ** cfg.alpha) if r_s > 0 else 1.0
        ratio_q = (r_l ** cfg.beta) if r_l > 0 else 1.0
        rho_s[t] = r_s
        rho_l[t] = r_l
        rr[t] = ratio_r
        rq[t] = ratio_q
        clip_r[t] = ratio_r >= cfg.clip_r - 1e-9 or ratio_r <= 1.0 / cfg.clip_r + 1e-9
        clip_q[t] = ratio_q >= cfg.clip_q - 1e-9 or ratio_q <= 1.0 / cfg.clip_q + 1e-9
        innov[t] = eng.ad.last_innov
        d12[t] = vars_j[0] + vars_j[1]
        d34[t] = vars_j[2] + vars_j[3]

    m = ready & np.isfinite(rr)
    n_r = int(m.sum())
    clip_frac_r = float(clip_r[m].mean()) if n_r else float("nan")
    clip_frac_q = float(clip_q[m].mean()) if n_r else float("nan")
    inert = (np.abs(rr[m] - 1.0) < INERT_TOL) & (np.abs(rq[m] - 1.0) < INERT_TOL)
    inert_frac = float(inert.mean()) if n_r else float("nan")

    # Coherence between short-scale detail energy and the residual.
    coh = {"mean_coh_d12_innov": float("nan"), "mean_coh_d34_innov": float("nan"),
           "peak_freq_d12": float("nan")}
    mv = ready & np.isfinite(innov) & np.isfinite(d12)
    if mv.sum() >= 512:
        iv = innov[mv]
        s12 = d12[mv]
        s34 = d34[mv]
        f, c12 = coherence(s12, iv, fs=1.0, nperseg=256)
        _, c34 = coherence(s34, iv, fs=1.0, nperseg=256)
        coh = {
            "mean_coh_d12_innov": float(np.mean(c12)),
            "mean_coh_d34_innov": float(np.mean(c34)),
            "peak_freq_d12": float(f[int(np.argmax(c12))]),
        }

    idx = np.arange(n)[::sample_every]
    return {
        "gen": path.gen,
        "n": n,
        "seed": path.seed,
        "n_ready": n_r,
        "clip_frac_R": clip_frac_r,
        "clip_frac_Q": clip_frac_q,
        "inert_frac": inert_frac,
        "mean_Eshort_over_bar": float(np.nanmean(rho_s[m])) if n_r else float("nan"),
        "mean_Elong_over_bar": float(np.nanmean(rho_l[m])) if n_r else float("nan"),
        "std_ratio_R": float(np.nanstd(rr[m])) if n_r else float("nan"),
        "std_ratio_Q": float(np.nanstd(rq[m])) if n_r else float("nan"),
        "coherence": coh,
        "sampled": {
            "t": [int(i) for i in idx],
            "Eshort_over_bar": [None if not np.isfinite(rho_s[i]) else float(rho_s[i]) for i in idx],
            "Elong_over_bar": [None if not np.isfinite(rho_l[i]) else float(rho_l[i]) for i in idx],
            "ratio_R": [None if not np.isfinite(rr[i]) else float(rr[i]) for i in idx],
            "ratio_Q": [None if not np.isfinite(rq[i]) else float(rq[i]) for i in idx],
            "clip_R": [bool(clip_r[i]) for i in idx],
        },
    }


def identification_plots(
    path: GenPath,
    out_dir: str | Path,
    cfg: Optional[CamaseConfig] = None,
) -> list[str]:
    """PNG plots of the energy ratios and clip events. Committed to the repo."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    cfg = cfg or DEFAULT_CONFIG
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    res = identification_run(path, cfg, sample_every=1)
    t = np.array(res["sampled"]["t"], dtype=float)
    es = np.array([x if x is not None else np.nan for x in res["sampled"]["Eshort_over_bar"]])
    el = np.array([x if x is not None else np.nan for x in res["sampled"]["Elong_over_bar"]])
    rr = np.array([x if x is not None else np.nan for x in res["sampled"]["ratio_R"]])
    rq = np.array([x if x is not None else np.nan for x in res["sampled"]["ratio_Q"]])

    fig, ax = plt.subplots(2, 1, figsize=(10, 7), sharex=True)
    ax[0].plot(t, es, lw=0.8, label="E_short / Ebar_short")
    ax[0].plot(t, el, lw=0.8, label="E_long / Ebar_long")
    ax[0].axhline(1.0, color="k", lw=0.8, ls="--")
    ax[0].set_ylabel("energy / EWMA")
    ax[0].legend(fontsize=9)
    ax[0].set_title(f"Adaptor identification — generator {path.gen} (n={path.n}, seed={path.seed})")
    ax[1].plot(t, rr, lw=0.8, label="R ratio (clip ±10x)")
    ax[1].plot(t, rq, lw=0.8, label="Q ratio (clip ±10x)")
    ax[1].axhline(1.0, color="k", lw=0.8, ls="--")
    ax[1].axhline(cfg.clip_r, color="r", lw=0.8, ls=":")
    ax[1].axhline(1.0 / cfg.clip_r, color="r", lw=0.8, ls=":")
    ax[1].set_ylabel("covariance ratio")
    ax[1].set_xlabel("bar")
    ax[1].legend(fontsize=9)
    fig.tight_layout()
    p1 = out_dir / f"identification_{path.gen}_n{path.n}_s{path.seed}.png"
    fig.savefig(p1, dpi=110)
    plt.close(fig)
    return [str(p1)]


def run_identification_suite(
    gens: tuple[str, ...] = ("A", "B", "C"),
    n: int = 2600,
    seeds: tuple[int, ...] = (42,),
    plot_dir: Optional[str | Path] = None,
) -> dict:
    out = {"n": n, "seeds": list(seeds), "runs": []}
    plots: list[str] = []
    for gen in gens:
        for seed in seeds:
            path = generate(gen, n=n, seed=seed)
            res = identification_run(path)
            out["runs"].append(res)
            if plot_dir is not None:
                plots.extend(identification_plots(path, plot_dir))
    out["plots"] = plots
    # Summary row per generator.
    summ = {}
    for gen in gens:
        rows = [r for r in out["runs"] if r["gen"] == gen]
        summ[gen] = {
            "mean_clip_frac_R": float(np.mean([r["clip_frac_R"] for r in rows])),
            "mean_clip_frac_Q": float(np.mean([r["clip_frac_Q"] for r in rows])),
            "mean_inert_frac": float(np.mean([r["inert_frac"] for r in rows])),
            "mean_coh_d12": float(np.nanmean([r["coherence"]["mean_coh_d12_innov"] for r in rows])),
        }
    out["summary"] = summ
    return out
