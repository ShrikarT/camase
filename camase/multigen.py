"""Multi-generator statistics: 50 seeds x 3 generators x 3 lengths.

Paired Wilcoxon signed-rank tests (M6 vs M2, M6 vs M8, M6 vs M10, M6 vs M11)
on SNR gain and MSPE — not a single mean SNR. The `review2` profile stays off
the main table. A (lambda, alpha, beta) sensitivity heatmap is computed on
generators A and C with 12 seeds and is locked before any Track B comparison.
"""

from __future__ import annotations

import itertools
import json
import time
from dataclasses import replace
from pathlib import Path

import numpy as np
from scipy.stats import wilcoxon

from .config import CamaseConfig, DEFAULT_CONFIG
from .generators import GenPath, generate
from .metrics import score_track_a
from .models import run_model

MODELS = ("M2", "M6", "M8", "M10", "M11")
PAIRS = (("M6", "M2"), ("M6", "M8"), ("M6", "M10"), ("M6", "M11"))
METRICS = ("snr_db", "mspe")

LAMBDAS = (0.99, 0.995, 0.999)
ALPHAS = (0.5, 1.0, 1.5)
BETAS = (0.5, 1.0, 1.5)


def score_seed(gen: str, n: int, seed: int, models=MODELS, cfg: CamaseConfig | None = None) -> dict:
    cfg = cfg or DEFAULT_CONFIG
    path: GenPath = generate(gen, n=n, seed=seed)
    row = {"gen": gen, "n": n, "seed": seed, "scores": {}}
    for name in models:
        run = run_model(name, path.price, cfg)
        sc = score_track_a(run, path.log_obs, path.latent, path.drift, path.jump_flags)
        row["scores"][name] = {
            "snr_db": sc.snr_db,
            "mspe": sc.mspe,
            "rmse_p": sc.rmse_p,
            "mean_nis": sc.mean_nis,
        }
    return row


def _paired(xs: list[float], ys: list[float]) -> dict:
    x = np.asarray(xs, dtype=float)
    y = np.asarray(ys, dtype=float)
    ok = np.isfinite(x) & np.isfinite(y)
    x, y = x[ok], y[ok]
    d = x - y
    out = {
        "n": int(d.size),
        "median_diff": float(np.median(d)) if d.size else float("nan"),
        "mean_diff": float(np.mean(d)) if d.size else float("nan"),
        "wins_first": int(np.sum(d > 0)),
        "wins_second": int(np.sum(d < 0)),
    }
    if d.size >= 8 and np.any(d != 0):
        try:
            res = wilcoxon(x, y, alternative="two-sided", zero_method="wilcox")
            out["w_stat"] = float(res.statistic)
            out["p_value"] = float(res.pvalue)
        except Exception as exc:  # pragma: no cover - defensive
            out["w_stat"] = float("nan")
            out["p_value"] = float("nan")
            out["error"] = str(exc)
    else:
        out["w_stat"] = float("nan")
        out["p_value"] = float("nan")
    return out


def wilcoxon_table(rows: list[dict], gen: str, n: int) -> dict:
    block = [r for r in rows if r["gen"] == gen and r["n"] == n]
    tab = {}
    for metric in METRICS:
        for a, b in PAIRS:
            xa = [r["scores"][a][metric] for r in block]
            xb = [r["scores"][b][metric] for r in block]
            tab[f"{metric}:{a}_vs_{b}"] = _paired(xa, xb)
    # Means per model for the headline table.
    means = {}
    for m in MODELS:
        vals = {met: [r["scores"][m][met] for r in block] for met in ("snr_db", "mspe", "rmse_p")}
        means[m] = {k: float(np.nanmean(v)) for k, v in vals.items()}
        means[m]["n"] = len(block)
    return {"gen": gen, "n": n, "means": means, "paired": tab}


def heatmap(
    gens: tuple[str, ...] = ("A", "C"),
    n: int = 1800,
    seeds: tuple[int, ...] = tuple(range(100, 112)),
    cfg0: CamaseConfig | None = None,
) -> dict:
    cfg0 = cfg0 or DEFAULT_CONFIG
    cells = []
    for lam, alpha, beta in itertools.product(LAMBDAS, ALPHAS, BETAS):
        cfg = replace(cfg0, ewma_lambda=lam, alpha=alpha, beta=beta)
        for gen in gens:
            snrs = []
            for seed in seeds:
                path = generate(gen, n=n, seed=seed)
                run = run_model("M6", path.price, cfg)
                sc = score_track_a(run, path.log_obs, path.latent, path.drift, path.jump_flags)
                snrs.append(sc.snr_db)
            cells.append(
                {
                    "lambda": lam,
                    "alpha": alpha,
                    "beta": beta,
                    "gen": gen,
                    "mean_snr": float(np.nanmean(snrs)),
                    "n": len(snrs),
                }
            )
    return {
        "n": n,
        "seeds": list(seeds),
        "note": "Sensitivity heatmap locked before any Track B comparison.",
        "cells": cells,
    }


def run_multi_gen(
    seeds: tuple[int, ...] = tuple(range(50)),
    gens: tuple[str, ...] = ("A", "B", "C"),
    lengths: tuple[int, ...] = (1200, 1800, 2600),
    out_dir: str | Path = "results",
    checkpoint_every: int = 10,
) -> dict:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    ckpt = out_dir / "multigen_checkpoint.json"
    rows: list[dict] = []
    done: set[tuple[str, int, int]] = set()
    if ckpt.is_file():
        try:
            prev = json.loads(ckpt.read_text())
            rows = prev.get("rows", [])
            done = {(r["gen"], r["n"], r["seed"]) for r in rows}
        except Exception:
            rows, done = [], set()
    t0 = time.time()
    total = len(seeds) * len(gens) * len(lengths)
    k = 0
    for gen, n, seed in itertools.product(gens, lengths, seeds):
        if (gen, n, seed) in done:
            k += 1
            continue
        rows.append(score_seed(gen, n, seed))
        k += 1
        if k % checkpoint_every == 0:
            ckpt.write_text(json.dumps({"rows": rows, "done": k, "total": total}))
    tables = [wilcoxon_table(rows, g, n) for g, n in itertools.product(gens, lengths)]
    out = {
        "seeds": list(seeds),
        "gens": list(gens),
        "lengths": list(lengths),
        "models": list(MODELS),
        "elapsed_s": round(time.time() - t0, 1),
        "tables": tables,
        "heatmap": heatmap(),
        "rows": rows,
    }
    (out_dir / "multigen.json").write_text(json.dumps(out, default=float))
    if ckpt.is_file():
        ckpt.unlink()
    return out


def summarize_multigen(path: str | Path = "results/multigen.json") -> str:
    d = json.loads(Path(path).read_text())
    lines = []
    for tab in d["tables"]:
        lines.append(f"gen={tab['gen']} n={tab['n']}")
        for m, s in tab["means"].items():
            lines.append(f"  {m}: mean_snr={s['snr_db']:.2f} dB  mean_mspe={s['mspe']:.3e}")
        for key, p in tab["paired"].items():
            if key.startswith("snr_db"):
                lines.append(
                    f"  {key}: median_diff={p['median_diff']:+.2f} dB "
                    f"wins={p['wins_first']}/{p['n']} p={p['p_value']:.3g}"
                )
    return "\n".join(lines)


if __name__ == "__main__":  # pragma: no cover
    import sys

    dest = sys.argv[1] if len(sys.argv) > 1 else "results"
    out = run_multi_gen(out_dir=dest)
    print(summarize_multigen(str(Path(dest) / "multigen.json")))
