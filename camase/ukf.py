"""Unscented Kalman filter on the IRW log-price state (model M9)."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from .kalman import H, process_cov, transition


def _chol_psd(P: np.ndarray) -> np.ndarray:
    P = 0.5 * (P + P.T)
    try:
        return np.linalg.cholesky(P)
    except np.linalg.LinAlgError:
        eig, vec = np.linalg.eigh(P)
        eig = np.clip(eig, 1e-18, None)
        return vec @ np.diag(np.sqrt(eig))


@dataclass
class UnscentedIRW:
    """Additive-noise UKF, n=2, 5 sigma points. Same F/Q/H/R as the linear KF."""

    x: np.ndarray = field(default_factory=lambda: np.zeros(2, dtype=np.float64))
    P: np.ndarray = field(default_factory=lambda: np.diag([1e-4, 1e-6]).astype(np.float64))
    alpha: float = 1e-3
    beta: float = 2.0
    kappa: float = 0.0
    last_S: float = 1.0
    last_innov: float = 0.0
    last_nis: float = 1.0

    @property
    def n(self) -> int:
        return 2

    @property
    def n_sigma(self) -> int:
        return 2 * self.n + 1

    def _weights(self) -> tuple[np.ndarray, np.ndarray, float]:
        n = self.n
        lam = self.alpha * self.alpha * (n + self.kappa) - n
        c = n + lam
        wm = np.full(2 * n + 1, 1.0 / (2.0 * c))
        wc = wm.copy()
        wm[0] = lam / c
        wc[0] = lam / c + (1.0 - self.alpha * self.alpha + self.beta)
        return wm, wc, c

    def sigma_points(self) -> np.ndarray:
        wm, wc, c = self._weights()
        col = _chol_psd(c * self.P)
        pts = np.zeros((self.n_sigma, 2))
        pts[0] = self.x
        for i in range(self.n):
            pts[1 + i] = self.x + col[:, i]
            pts[1 + self.n + i] = self.x - col[:, i]
        return pts

    def predict(self, F: np.ndarray, Q: np.ndarray) -> None:
        wm, wc, _ = self._weights()
        sig = self.sigma_points()
        prop = sig @ F.T
        self.x = wm @ prop
        d = prop - self.x
        self.P = (d * wc[:, None]).T @ d + Q
        self.P = 0.5 * (self.P + self.P.T)

    def update(self, y: float, R: float) -> float:
        wm, wc, _ = self._weights()
        sig = self.sigma_points()
        yhat_i = sig @ H.T  # (5, 1)
        yhat = float(wm @ yhat_i.ravel())
        dy = yhat_i.ravel() - yhat
        S = float(np.sum(wc * dy * dy) + R)
        if S <= 1e-18:
            S = 1e-18
        dx = sig - self.x
        Pxy = (dx * wc[:, None]).T @ dy.reshape(-1, 1)
        K = Pxy / S
        innov = y - yhat
        self.x = self.x + K.ravel() * innov
        self.P = self.P - S * (K @ K.T)
        self.P = 0.5 * (self.P + self.P.T)
        self.last_S = S
        self.last_innov = float(innov)
        self.last_nis = float(innov * innov / S)
        return self.last_nis

    def one_step_pred(self, F: np.ndarray) -> float:
        return float((H @ (F @ self.x))[0])


def run_ukf(prices: np.ndarray, R: float, sigma_a2: float, dt: float = 1.0) -> dict:
    """Convenience runner used by tests."""
    y = np.log(np.maximum(prices, 1e-12))
    ukf = UnscentedIRW()
    F = transition(dt)
    Q = process_cov(sigma_a2, dt)
    p = np.empty_like(y)
    for t, yt in enumerate(y):
        ukf.predict(F, Q)
        ukf.update(float(yt), R)
        p[t] = ukf.x[0]
    return {"p_hat": p, "n_sigma": ukf.n_sigma}
