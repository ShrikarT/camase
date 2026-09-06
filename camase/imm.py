"""3-mode Interacting Multiple Model filter (model M8).

Modes: calm / normal / stress with fixed (R, σ_a²) multiples of the
paper defaults. Mixing is standard Blom / Bar-Shalom. No wavelet on
this path — M8 is a covariance-regime baseline, not a leaky cascade.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .kalman import KalmanIRW, process_cov, transition


MODE_SCALES = (0.3, 1.0, 3.0)
N_MODES = 3
STAY = 0.92


def transition_matrix(stay: float = STAY, n: int = N_MODES) -> np.ndarray:
    off = (1.0 - stay) / (n - 1)
    P = np.full((n, n), off)
    np.fill_diagonal(P, stay)
    return P


@dataclass
class IMMFilter:
    R0: float
    sigma_a0: float
    dt: float = 1.0
    stay: float = STAY
    mu: np.ndarray = field(default_factory=lambda: np.ones(N_MODES) / N_MODES)
    filters: list[KalmanIRW] = field(default_factory=list)
    last_nis: float = 1.0
    last_innov: float = 0.0
    last_pred: float = 0.0

    def __post_init__(self) -> None:
        if not self.filters:
            self.filters = [KalmanIRW() for _ in range(N_MODES)]
        self.Pi = transition_matrix(self.stay)

    @property
    def x(self) -> np.ndarray:
        return sum(m * f.x for m, f in zip(self.mu, self.filters))

    @property
    def mode_R(self) -> tuple[float, ...]:
        return tuple(s * self.R0 for s in MODE_SCALES)

    @property
    def mode_sa(self) -> tuple[float, ...]:
        return tuple(s * self.sigma_a0 for s in MODE_SCALES)

    def mix(self) -> None:
        cbar = self.Pi.T @ self.mu
        cbar = np.maximum(cbar, 1e-16)
        mu_mix = (self.Pi * self.mu[:, None]) / cbar[None, :]
        xs = [f.x.copy() for f in self.filters]
        Ps = [f.P.copy() for f in self.filters]
        mixed_x = []
        mixed_P = []
        for j in range(N_MODES):
            xj = sum(mu_mix[i, j] * xs[i] for i in range(N_MODES))
            Pj = np.zeros((2, 2))
            for i in range(N_MODES):
                d = (xs[i] - xj).reshape(2, 1)
                Pj = Pj + mu_mix[i, j] * (Ps[i] + d @ d.T)
            mixed_x.append(xj)
            mixed_P.append(0.5 * (Pj + Pj.T))
        for j, f in enumerate(self.filters):
            f.x = mixed_x[j]
            f.P = mixed_P[j]
        self._cbar = cbar

    def step(self, y: float) -> np.ndarray:
        F = transition(self.dt)
        self.last_pred = float((F @ self.x)[0])
        self.mix()
        likes = np.zeros(N_MODES)
        for j, f in enumerate(self.filters):
            Q = process_cov(self.mode_sa[j], self.dt)
            f.predict(F, Q)
            f.update_joseph(y, self.mode_R[j])
            S = max(f.last_S, 1e-18)
            likes[j] = np.exp(-0.5 * (f.last_innov ** 2) / S) / np.sqrt(2 * np.pi * S)
        post = likes * self._cbar
        s = post.sum()
        self.mu = post / s if s > 0 else np.ones(N_MODES) / N_MODES
        x = self.x
        innov = y - self.last_pred
        # Combined NIS against mixture innovation variance.
        S_mix = 0.0
        for j, f in enumerate(self.filters):
            S_mix += self.mu[j] * f.last_S
        S_mix = max(S_mix, 1e-18)
        self.last_innov = float(innov)
        self.last_nis = float(innov * innov / S_mix)
        return x
