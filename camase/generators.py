"""Three data-generating processes on the same 1-minute observation clock.

The research question is not "does the adaptor work" but "when is scale-split
adaptation *identified*": when are short-scale and long-scale energy separable?

ID  Generator                                              Expected
A   Additive i.i.d. microstructure noise + slow latent      Scale split should
    random walk.                                           beat M2.
B   Hasbrouck-style bid-ask bounce + price rounding.       Short-scale energy
    Short-scale energy is real measurement noise by        is measurement noise
    construction.                                          by construction.
C   Heston-with-jumps (the current Track A2 path).         Scale split should
                                                           lose or tie M2.

All three return the same ``GenPath`` record so the model ladder,
identification diagnostics and statistics run unchanged on each.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np

from .heston import HestonPath, generate_heston


@dataclass
class GenPath:
    gen: str
    n: int
    seed: int
    t: np.ndarray
    latent: np.ndarray
    drift: np.ndarray
    variance: np.ndarray
    price: np.ndarray
    log_obs: np.ndarray
    jump_flags: np.ndarray
    regime_flags: np.ndarray


def generate_A(
    n: int = 2600,
    seed: int = 42,
    s0: float = 65000.0,
    sigma_p: float = 1.2e-4,
    sigma_quiet: float = 2.0e-4,
    sigma_loud: float = 6.0e-4,
    block: int = 500,
) -> GenPath:
    """Block-varying i.i.d. microstructure noise plus a slow latent random walk.

    y_t = p_t + eps_t,  p_t = p_{t-1} + sigma_p * z_t,
    eps_t ~ N(0, sigma_eps(t)^2) with sigma_eps alternating between quiet and
    loud blocks. Short-scale (D1/D2) energy tracks the noise regime; long-scale
    (D3/D4) energy tracks random-walk innovations. The two scales are separable
    *and* time-varying, which is the natural stress test for a covariance
    adaptor: the design hypothesis is that the two-sided adaptor beats the
    rolling-sigma baseline here by raising R_t in loud blocks.
    """
    rng = np.random.default_rng(seed)
    log_p0 = np.log(s0)
    innov = sigma_p * rng.standard_normal(n)
    latent = log_p0 + np.cumsum(innov)
    blk = (np.arange(n) // block) % 2
    sig_eps = np.where(blk == 0, sigma_quiet, sigma_loud)
    log_obs = latent + sig_eps * rng.standard_normal(n)
    drift = np.diff(latent, prepend=latent[0])
    variance = np.full(n, sigma_p * sigma_p)
    return GenPath(
        gen="A",
        n=n,
        seed=seed,
        t=np.arange(n, dtype=np.float64),
        latent=latent,
        drift=drift,
        variance=variance,
        price=np.exp(log_obs),
        log_obs=log_obs,
        jump_flags=np.zeros(n, dtype=bool),
        regime_flags=(blk == 1),
    )


def generate_B(
    n: int = 2600,
    seed: int = 42,
    s0: float = 65000.0,
    sigma_m: float = 1.5e-4,
    half_spread: float = 2.0e-4,
    flip_p: float = 0.55,
    tick: float = 0.01,
    jump_rate: float = 0.002,
    jump_sig: float = 3.0e-3,
) -> GenPath:
    """Hasbrouck-style bid-ask bounce with price rounding and sparse jumps.

    Efficient log-price m_t is a random walk; the observation is
    y_t = m_t + (half_spread) * q_t rounded to the tick grid, where q_t in
    {+1, -1} flips with probability ``flip_p``. Sparse Gaussian jumps hit the
    efficient price. The bounce dominates short-scale energy: D1/D2 variance
    is measurement noise by construction, which is exactly what R_t is
    supposed to absorb; jumps are the Q-side stress.
    """
    rng = np.random.default_rng(seed)
    log_m0 = np.log(s0)
    latent = log_m0 + np.cumsum(sigma_m * rng.standard_normal(n))
    jumps = rng.random(n) < jump_rate
    latent = latent + np.cumsum(np.where(jumps, jump_sig * rng.standard_normal(n), 0.0))
    q = np.empty(n, dtype=np.float64)
    q[0] = 1.0 if rng.random() < 0.5 else -1.0
    flips = rng.random(n) < flip_p
    for t in range(1, n):
        q[t] = -q[t - 1] if flips[t] else q[t - 1]
    y = latent + half_spread * q
    price = np.round(np.exp(y) / tick) * tick
    price = np.maximum(price, tick)
    log_obs = np.log(price)
    drift = np.diff(latent, prepend=latent[0])
    variance = np.full(n, sigma_m * sigma_m)
    return GenPath(
        gen="B",
        n=n,
        seed=seed,
        t=np.arange(n, dtype=np.float64),
        latent=latent,
        drift=drift,
        variance=variance,
        price=price,
        log_obs=log_obs,
        jump_flags=jumps,
        regime_flags=np.zeros(n, dtype=bool),
    )


def generate_C(n: int = 2600, seed: int = 42, track: str = "A2") -> GenPath:
    """The current Heston-with-jumps path. Scale split is expected to lose or
    tie rolling-sigma here: at 1-minute resolution short-scale and long-scale
    energy are not separable."""
    hp: HestonPath = generate_heston(n=n, track=track, seed=seed)  # type: ignore[arg-type]
    return GenPath(
        gen="C",
        n=n,
        seed=seed,
        t=hp.t,
        latent=hp.latent,
        drift=hp.drift,
        variance=hp.variance,
        price=hp.price,
        log_obs=hp.log_obs,
        jump_flags=hp.jump_flags,
        regime_flags=hp.regime_flags,
    )


GENERATORS: dict[str, Callable[..., GenPath]] = {
    "A": generate_A,
    "B": generate_B,
    "C": generate_C,
}


def generate(gen: str, n: int = 2600, seed: int = 42, **kw) -> GenPath:
    key = gen.upper()
    if key not in GENERATORS:
        raise KeyError(f"unknown generator {gen}; choose {sorted(GENERATORS)}")
    return GENERATORS[key](n=n, seed=seed, **kw)
