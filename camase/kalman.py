"""Integrated-random-walk Kalman filter with Joseph covariance update."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


def transition(dt: float) -> np.ndarray:
    return np.array([[1.0, dt], [0.0, 1.0]], dtype=np.float64)


def process_cov(sigma_a2: float, dt: float) -> np.ndarray:
    dt2 = dt * dt
    dt3 = dt2 * dt
    return sigma_a2 * np.array(
        [[dt3 / 3.0, dt2 / 2.0], [dt2 / 2.0, dt]], dtype=np.float64
    )


H = np.array([[1.0, 0.0]], dtype=np.float64)
I2 = np.eye(2, dtype=np.float64)


@dataclass
class KalmanIRW:
    x: np.ndarray = field(default_factory=lambda: np.zeros(2, dtype=np.float64))
    P: np.ndarray = field(default_factory=lambda: np.diag([1e-4, 1e-6]).astype(np.float64))
    last_S: float = 1.0
    last_innov: float = 0.0
    last_nis: float = 1.0

    def copy(self) -> "KalmanIRW":
        k = KalmanIRW()
        k.x = self.x.copy()
        k.P = self.P.copy()
        k.last_S = self.last_S
        k.last_innov = self.last_innov
        k.last_nis = self.last_nis
        return k

    def predict(self, F: np.ndarray, Q: np.ndarray) -> None:
        self.x = F @ self.x
        self.P = F @ self.P @ F.T + Q
        self.P = 0.5 * (self.P + self.P.T)

    def update_joseph(self, y: float, R: float) -> float:
        innov = float(y - (H @ self.x)[0])
        S = float((H @ self.P @ H.T)[0, 0] + R)
        if S <= 1e-18:
            S = 1e-18
        K = (self.P @ H.T) / S
        self.x = self.x + K.ravel() * innov
        IKH = I2 - K @ H
        self.P = IKH @ self.P @ IKH.T + (K * R) @ K.T
        self.P = 0.5 * (self.P + self.P.T)
        self.last_S = S
        self.last_innov = innov
        self.last_nis = innov * innov / S
        return self.last_nis

    def one_step_pred(self, F: np.ndarray) -> float:
        return float((H @ (F @ self.x))[0])
