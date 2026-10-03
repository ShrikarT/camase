"""Gate ROC: false-alarm rate on A1 (null) vs jump hit rate on A3 (stress).

Sweep persistence k, CUSUM H, and the chi2 window threshold. A gate that is
both conservative and timely traces a curve; a dead or always-on gate is a
single point. "5/5 jumps inside 20 bars" and "0 HOLD on A1" are not enough on
their own — both can be true while the gate is dead or always on.
"""

from __future__ import annotations

import itertools
from dataclasses import replace
from pathlib import Path

import numpy as np

from .config import DEFAULT_CONFIG
from .heston import generate_heston
from .models import run_model

PERSIST_K = (2, 3)
CUSUM_H = (8.0, 18.0, 36.0)
CHI2_ALPHA = (0.005, 0.02)


def _far_on_a1(cfg, n: int = 2500, seed: int = 3, bars_per_day: float = 1440.0) -> dict:
    path = generate_heston(n=n, track="A1", seed=seed)
    run = run_model("M7", path.price, cfg)
    m = run.ready & np.isfinite(run.p_hat)
    n_ready = int(m.sum())
    n_hold = int(((run.action == "HOLD") & m).sum())
    return {
        "n_ready": n_ready,
        "n_hold": n_hold,
        "hold_frac": n_hold / max(n_ready, 1),
        "far_per_day": n_hold / max(n_ready / bars_per_day, 1e-9),
        "time_in_market": float(np.mean(run.action[m] == "TRADE")) if n_ready else float("nan"),
    }


def _hits_on_a3(cfg, n: int = 2500, seed: int = 42, horizon: int = 20) -> dict:
    path = generate_heston(n=n, track="A3", seed=seed)
    run = run_model("M7", path.price, cfg)
    onsets = np.where(path.jump_flags)[0]
    hits, delays, pre_held = 0, [], 0
    for t0 in onsets:
        if t0 > 0 and run.action[t0 - 1] == "HOLD":
            pre_held += 1
        w = np.where(run.action[t0 : t0 + horizon] == "HOLD")[0]
        if w.size:
            hits += 1
            delays.append(int(w[0]))
    n_hold = int(((run.action == "HOLD") & run.ready & ~path.jump_flags).sum())
    n_null = int((run.ready & ~path.jump_flags).sum())
    return {
        "n_jumps": int(onsets.size),
        "hits": hits,
        "hit_rate": hits / max(onsets.size, 1),
        "mean_delay": float(np.mean(delays)) if delays else float("nan"),
        "pre_held_frac": pre_held / max(onsets.size, 1),
        "false_hold_frac": n_hold / max(n_null, 1),
    }


def run_gate_roc(n: int = 2500, horizon: int = 20) -> dict:
    points = []
    for pk, h, alpha in itertools.product(PERSIST_K, CUSUM_H, CHI2_ALPHA):
        cfg = replace(DEFAULT_CONFIG, persist_k=pk, cusum_h=h, chi2_alpha=alpha)
        a1 = _far_on_a1(cfg, n=n)
        a3 = _hits_on_a3(cfg, n=n, horizon=horizon)
        points.append(
            {
                "persist_k": pk,
                "cusum_h": h,
                "chi2_alpha": alpha,
                "far_per_day": a1["far_per_day"],
                "a1_hold_frac": a1["hold_frac"],
                "time_in_market": a1["time_in_market"],
                "hit_rate": a3["hit_rate"],
                "mean_delay": a3["mean_delay"],
                "pre_held_frac": a3["pre_held_frac"],
                "false_hold_frac": a3["false_hold_frac"],
                "n_jumps": a3["n_jumps"],
            }
        )
    # Sort by false-alarm rate so the ROC reads left to right.
    points.sort(key=lambda p: (p["far_per_day"], -p["hit_rate"]))
    return {
        "n": n,
        "horizon": horizon,
        "note": "Gate ROC: x = false alarms/day on A1, y = jump hit rate on A3. "
        "Paper default row is persist_k=3, cusum_h=36, chi2_alpha=0.005.",
        "default": {"persist_k": 3, "cusum_h": 36.0, "chi2_alpha": 0.005},
        "points": points,
    }


def main(out: str | Path = "results/gate_roc.json") -> dict:
    from .jsonutil import dump

    res = run_gate_roc()
    dump(res, Path(out))
    return res


if __name__ == "__main__":  # pragma: no cover
    print(main())
