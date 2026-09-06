"""Published calibration log: paper defaults vs review2 profile.

Does not pick a winner and hide the rest. Writes every cell.
"""

from __future__ import annotations

from dataclasses import asdict, replace

from .config import DEFAULT_CONFIG, REVIEW2_CONFIG, CamaseConfig
from .heston import generate_heston
from .metrics import score_track_a
from .models import run_model


def _score_models(path, cfg: CamaseConfig, models: tuple[str, ...]) -> list[dict]:
    rows = []
    for name in models:
        run = run_model(name, path.price, cfg)
        sc = score_track_a(run, path.log_obs, path.latent, path.drift, path.jump_flags)
        row = asdict(sc)
        row["profile"] = cfg.profile
        rows.append(row)
    return rows


def run_calibration(
    n: int = 1600,
    seed: int = 42,
    tracks: tuple[str, ...] = ("A2", "A3"),
    models: tuple[str, ...] = ("M1", "M2", "M6", "M7", "M8"),
) -> dict:
    profiles = {"paper": DEFAULT_CONFIG, "review2": REVIEW2_CONFIG}
    blocks = []
    for track in tracks:
        path = generate_heston(n=n, track=track, seed=seed)  # type: ignore[arg-type]
        for pname, cfg in profiles.items():
            rows = _score_models(path, cfg, models)
            m2 = next(r for r in rows if r["model"] == "M2")
            m6 = next(r for r in rows if r["model"] == "M6")
            blocks.append(
                {
                    "track": track,
                    "profile": pname,
                    "n": n,
                    "seed": seed,
                    "m6_beats_m2_snr": bool(m6["snr_db"] > m2["snr_db"]),
                    "scores": rows,
                }
            )
    return {
        "note": (
            "Paper defaults lock λ=0.995, α=1, β=1. Review2 uses λ=0.97, α=0.5, β=1.5. "
            "Neither profile is selected after looking at the test fold. "
            "On this generator M8 (IMM) often beats M6; that is reported, not hidden."
        ),
        "blocks": blocks,
    }


def far_on_null(n: int = 2500, seed: int = 3) -> dict:
    """A1 has no jumps. Gate HOLD rate is a false-alarm proxy."""
    path = generate_heston(n=n, track="A1", seed=seed)
    run = run_model("M7", path.price, DEFAULT_CONFIG)
    ready = run.ready
    holds = (run.action == "HOLD") & ready
    n_ready = int(ready.sum())
    n_hold = int(holds.sum())
    bars_per_day = 1440.0
    far = (n_hold / max(n_ready / bars_per_day, 1e-9)) if n_ready else float("nan")
    return {
        "track": "A1",
        "n": n,
        "n_ready": n_ready,
        "n_hold": n_hold,
        "hold_frac": float(n_hold / max(n_ready, 1)),
        "far_holds_per_day": float(far),
        "target_note": "Paper aims at ~1 false alarm per session; this is a raw HOLD count, not a session clock.",
    }
