"""Track A runner and ablation table."""

from __future__ import annotations

from dataclasses import asdict
from typing import Iterable

import numpy as np

from .config import CamaseConfig, DEFAULT_CONFIG
from .heston import generate_heston
from .metrics import TrackAScore, score_track_a
from .models import RUNNERS, run_model
from .strategy import overlay_long_flat


DEFAULT_MODELS = ["M0", "M1", "M2", "M3", "M4", "M4b", "M5", "M6", "M7", "M8", "M9", "M5'", "M6'"]


def run_track_a(
    track: str = "A2",
    n: int = 2500,
    models: Iterable[str] = ("M1", "M2", "M6", "M7"),
    cfg: CamaseConfig | None = None,
    seed: int = 42,
) -> dict:
    cfg = cfg or DEFAULT_CONFIG
    path = generate_heston(n=n, track=track, seed=seed)  # type: ignore[arg-type]
    rows = []
    econ = []
    for name in models:
        run = run_model(name, path.price, cfg)
        sc = score_track_a(run, path.log_obs, path.latent, path.drift, path.jump_flags)
        st = overlay_long_flat(run, path.log_obs, cfg.cost_rt_bp)
        row = asdict(sc)
        row["sharpe_net"] = st.sharpe_net
        row["sharpe_net_ann"] = st.sharpe_net_ann
        row["max_dd_net"] = st.max_dd_net
        row["n_trades"] = st.n_trades
        rows.append(row)
        econ.append({"model": name, "sharpe_net": st.sharpe_net, "sharpe_net_ann": st.sharpe_net_ann, "tim": st.time_in_market})
    return {
        "track": track,
        "n": n,
        "seed": seed,
        "warmup": cfg.warmup,
        "scores": rows,
        "econ": econ,
        "n_jumps": int(path.jump_flags.sum()),
    }


def run_ablation(
    n: int = 2200,
    track: str = "A2",
    cfg: CamaseConfig | None = None,
    models: Iterable[str] | None = None,
) -> list[TrackAScore]:
    cfg = cfg or DEFAULT_CONFIG
    path = generate_heston(n=n, track=track, seed=cfg.seed)  # type: ignore[arg-type]
    out = []
    for name in models or DEFAULT_MODELS:
        run = run_model(name, path.price, cfg)
        out.append(score_track_a(run, path.log_obs, path.latent, path.drift, path.jump_flags))
    return out


def traces_for_dashboard(n: int = 1600, track: str = "A2", seed: int = 42) -> dict:
    """Compact JSON-able traces for the web lab (M7 vs raw vs latent)."""
    from .pipeline import CamaseEngine

    cfg = DEFAULT_CONFIG
    path = generate_heston(n=n, track=track, seed=seed)  # type: ignore[arg-type]
    eng = CamaseEngine(cfg, gated=True)
    rec = []
    for px, lat, jf in zip(path.price, path.latent, path.jump_flags):
        o = eng.step(float(px))
        rec.append(
            {
                "y": o.y,
                "latent": float(lat),
                "p_hat": o.p_hat,
                "R": o.R_t,
                "sa2": o.sigma_a2,
                "rho": o.rho,
                "nis_a": o.nis_adapt,
                "nis_s": o.nis_shadow,
                "nu": o.nu,
                "gamma": o.gamma,
                "cusum": o.cusum,
                "action": o.action,
                "ready": o.ready,
                "jump": bool(jf),
            }
        )
    return {"n": n, "track": track, "warmup": cfg.warmup, "series": rec}
