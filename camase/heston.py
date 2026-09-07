"""Heston-with-jumps generator for Track A (A1 null, A2 regime, A3 stress)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np

Track = Literal["A1", "A2", "A3"]


@dataclass
class HestonPath:
    t: np.ndarray
    latent: np.ndarray
    drift: np.ndarray
    variance: np.ndarray
    price: np.ndarray
    log_obs: np.ndarray
    jump_flags: np.ndarray
    regime_flags: np.ndarray


def generate_heston(
    n: int = 4000,
    track: Track = "A2",
    seed: int = 42,
    dt: float = 1.0 / (365 * 24 * 60),
    s0: float = 65000.0,
) -> HestonPath:
    rng = np.random.default_rng(seed)
    mu = 0.0
    kappa, theta, xi, rho = 2.0, 0.04, 0.35, -0.55
    v = theta
    log_p = np.log(s0)
    latent = np.empty(n)
    drift = np.empty(n)
    var = np.empty(n)
    jumps = np.zeros(n, dtype=bool)
    regimes = np.zeros(n, dtype=bool)

    jump_rate = 0.0
    jump_mu, jump_sig = -0.008, 0.012
    if track == "A2":
        jump_rate = 4.0
    elif track == "A3":
        jump_rate = 8.0
        xi = 0.55
        theta = 0.09

    scheduled = set()
    if track == "A2" and n > 800:
        scheduled = {n // 5, n // 2, (3 * n) // 4}
    if track == "A3" and n > 400:
        scheduled = {n // 6, n // 3, n // 2, (2 * n) // 3, (5 * n) // 6}

    for i in range(n):
        if track == "A2" and (n // 3) <= i < (n // 3 + n // 8):
            regimes[i] = True
            theta_t = theta * 3.5
        else:
            theta_t = theta

        z1 = rng.standard_normal()
        z2 = rho * z1 + np.sqrt(max(1.0 - rho * rho, 0.0)) * rng.standard_normal()
        v = max(v + kappa * (theta_t - v) * dt + xi * np.sqrt(max(v, 1e-12)) * np.sqrt(dt) * z2, 1e-10)
        dlog = (mu - 0.5 * v) * dt + np.sqrt(v) * np.sqrt(dt) * z1
        if i in scheduled or (jump_rate > 0 and rng.random() < jump_rate * dt):
            dlog += jump_mu + jump_sig * rng.standard_normal()
            jumps[i] = True
        log_p += dlog
        latent[i] = log_p
        drift[i] = dlog / dt
        var[i] = v

    # Microstructure layer: heteroskedastic noise + bid-ask bounce + tick.
    vol_scale = np.sqrt(np.maximum(var, 1e-12))
    eta = 0.00018 * vol_scale / np.median(vol_scale) * rng.standard_normal(n)
    bounce = (rng.random(n) < 0.5).astype(np.float64) * 2 - 1
    half_spread = 0.00004 * vol_scale / np.median(vol_scale)
    tick = 1e-5 * rng.standard_normal(n)
    log_obs = latent + eta + bounce * half_spread + tick
    if track != "A1":
        n_out = max(2, n // 400)
        idx = rng.choice(n, size=n_out, replace=False)
        log_obs[idx] += rng.choice([-1.0, 1.0], size=n_out) * rng.uniform(0.004, 0.012, size=n_out)

    price = np.exp(log_obs)
    t = np.arange(n, dtype=np.float64)
    return HestonPath(t, latent, drift, var, price, log_obs, jumps, regimes)
