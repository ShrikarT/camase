"""Group-delay vs accuracy Pareto: matched moving averages against M6."""

from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np

from .config import CamaseConfig, DEFAULT_CONFIG
from .heston import generate_heston
from .metrics import group_delay_static, rmse, snr_gain_db
from .models import run_model


@dataclass
class ParetoPoint:
    name: str
    window: int
    delay_bars: float
    rmse_p: float
    snr_db: float


def causal_ma(y: np.ndarray, w: int) -> np.ndarray:
    out = np.full_like(y, np.nan)
    c = np.cumsum(y)
    for t in range(w - 1, len(y)):
        out[t] = (c[t] - (c[t - w] if t >= w else 0.0)) / w
    return out


def ma_group_delay(window: int) -> float:
    """Causal boxcar group delay is (window-1)/2 bars."""
    return (window - 1) / 2.0


def m6_mean_gain(run_k: np.ndarray) -> float:
    k = run_k[np.isfinite(run_k)]
    if k.size == 0:
        return float("nan")
    return float(np.mean(np.clip(k, 1e-6, 0.999)))


def run_pareto(
    n: int = 2200,
    track: str = "A2",
    windows: tuple[int, ...] = (4, 8, 16, 32, 64, 128),
    cfg: CamaseConfig | None = None,
    seed: int = 42,
) -> list[dict]:
    cfg = cfg or DEFAULT_CONFIG
    path = generate_heston(n=n, track=track, seed=seed)  # type: ignore[arg-type]
    y = path.log_obs
    latent = path.latent
    points: list[ParetoPoint] = []
    for w in windows:
        est = causal_ma(y, w)
        mask = np.isfinite(est)
        points.append(
            ParetoPoint(
                name=f"MA{w}",
                window=w,
                delay_bars=ma_group_delay(w),
                rmse_p=rmse(est, latent, mask),
                snr_db=snr_gain_db(y, est, latent, mask),
            )
        )
    m6 = run_model("M6", path.price, cfg)
    # Approximate Kalman position gain from NIS/S via residual variance.
    # Use the static-gain helper on a typical k1 inferred from RMSE ratio.
    # Better: recover k1 from one-step update magnitude after warmup.
    ready = m6.ready
    dy = y[ready] - m6.p_hat[ready]
    # Mean Kalman gain ≈ 1 - var(est-latent)/var(y-latent) is noisy; use
    # empirical lag of peak xcorr between v_hat and latent increment.
    k1 = 0.15
    if ready.sum() > 50:
        err = m6.p_hat[ready] - y[ready]
        # gain proxy: how much of the innovation is taken
        inn = np.diff(y[ready], prepend=y[ready][0])
        num = np.dot(np.diff(m6.p_hat[ready], prepend=m6.p_hat[ready][0]), inn)
        den = np.dot(inn, inn)
        if den > 0:
            k1 = float(np.clip(num / den, 0.02, 0.8))
    points.append(
        ParetoPoint(
            name="M6",
            window=0,
            delay_bars=group_delay_static(k1, cfg.dt),
            rmse_p=rmse(m6.p_hat, latent, ready),
            snr_db=snr_gain_db(y, m6.p_hat, latent, ready),
        )
    )
    return [asdict(p) for p in points]
