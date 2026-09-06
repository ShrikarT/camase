"""Track A / Track B metrics, Deflated Sharpe, group delay helper."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
from scipy import stats

from .models import ModelRun


def _mask(run: ModelRun) -> np.ndarray:
    return run.ready & np.isfinite(run.p_hat)


def rmse(est: np.ndarray, truth: np.ndarray, mask: Optional[np.ndarray] = None) -> float:
    if mask is None:
        mask = np.isfinite(est) & np.isfinite(truth)
    err = est[mask] - truth[mask]
    if err.size == 0:
        return float("nan")
    return float(np.sqrt(np.mean(err * err)))


def snr_gain_db(y: np.ndarray, p_hat: np.ndarray, p_true: np.ndarray, mask: Optional[np.ndarray] = None) -> float:
    if mask is None:
        mask = np.isfinite(p_hat)
    num = np.sum((y[mask] - p_true[mask]) ** 2)
    den = np.sum((p_hat[mask] - p_true[mask]) ** 2)
    if den <= 0 or num <= 0:
        return float("nan")
    return float(10.0 * np.log10(num / den))


def mspe(run: ModelRun, y: np.ndarray) -> float:
    m = run.ready & np.isfinite(run.pred)
    m[0] = False
    if m.sum() < 10:
        return float("nan")
    err = y[m] - run.pred[m]
    return float(np.mean(err * err))


def mean_nis(run: ModelRun) -> float:
    m = run.ready & np.isfinite(run.nis)
    if m.sum() == 0:
        return float("nan")
    return float(np.mean(run.nis[m]))


def time_in_market(run: ModelRun) -> float:
    m = run.ready
    if m.sum() == 0:
        return 0.0
    return float(np.mean(run.action[m] == "TRADE"))


def group_delay_static(k1: float, dt: float = 1.0) -> float:
    """Low-frequency group delay of the scalar position channel ≈ (1-k1)/k1 bars."""
    if k1 <= 0 or k1 >= 1:
        return float("nan")
    return float((1.0 - k1) / k1)


@dataclass
class TrackAScore:
    model: str
    rmse_p: float
    rmse_v: float
    snr_db: float
    mean_nis: float
    mspe: float
    time_in_market: float
    far_per_day: float
    mean_detect_delay: float


def score_track_a(
    run: ModelRun,
    y: np.ndarray,
    latent: np.ndarray,
    drift: np.ndarray,
    jump_flags: np.ndarray,
    bars_per_day: float = 1440.0,
) -> TrackAScore:
    m = _mask(run)
    far = 0.0
    delay = float("nan")
    if run.action is not None and m.any():
        holds = run.action == "HOLD"
        far = float(holds[m].sum() / max(m.sum() / bars_per_day, 1e-9))
        onsets = np.where(jump_flags)[0]
        delays = []
        for t0 in onsets:
            window = np.where(holds[t0 : min(t0 + 120, len(holds))])[0]
            if window.size:
                delays.append(int(window[0]))
        if delays:
            delay = float(np.mean(delays))
    return TrackAScore(
        model=run.name,
        rmse_p=rmse(run.p_hat, latent, m),
        rmse_v=rmse(run.v_hat, drift, m),
        snr_db=snr_gain_db(y, run.p_hat, latent, m),
        mean_nis=mean_nis(run),
        mspe=mspe(run, y),
        time_in_market=time_in_market(run),
        far_per_day=far if run.name == "M7" else float("nan"),
        mean_detect_delay=delay if run.name == "M7" else float("nan"),
    )


def deflated_sharpe(sr: float, n_obs: int, n_trials: int, skew: float = 0.0, kurt: float = 3.0) -> float:
    """Bailey & López de Prado Deflated Sharpe Ratio (normalised)."""
    if n_obs < 3 or not np.isfinite(sr):
        return float("nan")
    sr_std = np.sqrt((1 - skew * sr + (kurt - 1) / 4.0 * sr * sr) / (n_obs - 1))
    if sr_std <= 0:
        return float("nan")
    # Expected max Sharpe under n_trials nulls ~ ≈ (1-γ)Φ^{-1}(1-1/n) + γ Φ^{-1}(1-1/(n e))
    if n_trials <= 1:
        emax = 0.0
    else:
        gamma = 0.5772156649
        emax = ((1 - gamma) * stats.norm.ppf(1 - 1 / n_trials)
                + gamma * stats.norm.ppf(1 - 1 / (n_trials * np.e)))
    return float(stats.norm.cdf((sr - emax) / sr_std))
