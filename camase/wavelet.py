"""Causal à trous cascade (db4) and a circular leaky twin for Audit C."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Sequence

import numpy as np

_DB4_LO = np.array(
    [
        -0.010597401784997278,
        0.032883011666982945,
        0.030841381835986965,
        -0.18703481171888114,
        -0.02798376941698385,
        0.6308807679295904,
        0.7148465705525415,
        0.23037781330885523,
    ],
    dtype=np.float64,
)
_DB4_HI = np.array(
    [
        -0.23037781330885523,
        0.7148465705525415,
        -0.6308807679295904,
        -0.02798376941698385,
        0.18703481171888114,
        0.030841381835986965,
        -0.032883011666982945,
        -0.010597401784997278,
    ],
    dtype=np.float64,
)

INV_SQRT2 = 1.0 / np.sqrt(2.0)
G0 = _DB4_LO * INV_SQRT2
H0 = _DB4_HI * INV_SQRT2


def support_length(j: int, L: int = 8) -> int:
    return (2**j - 1) * (L - 1) + 1


@dataclass
class CausalAtrous:
    """Streaming causal FIR cascade. Every tap looks only backward."""

    J: int = 4
    n_buffer: int = 512

    def __post_init__(self) -> None:
        self._approx: list[np.ndarray] = [
            np.zeros(self.n_buffer, dtype=np.float64) for _ in range(self.J + 1)
        ]
        self._details: list[np.ndarray] = [
            np.zeros(self.n_buffer, dtype=np.float64) for _ in range(self.J + 1)
        ]
        self._t = -1
        self._count = 0

    def reset(self) -> None:
        for buf in self._approx:
            buf[:] = 0.0
        for buf in self._details:
            buf[:] = 0.0
        self._t = -1
        self._count = 0

    def step(self, y: float) -> np.ndarray:
        self._t += 1
        self._count += 1
        idx = self._t % self.n_buffer
        self._approx[0][idx] = float(y)
        details = np.zeros(self.J, dtype=np.float64)
        for j in range(1, self.J + 1):
            dilation = 1 << (j - 1)
            a = 0.0
            d = 0.0
            for m in range(len(G0)):
                lag = m * dilation
                src = (self._t - lag) % self.n_buffer
                val = 0.0 if lag > self._t else self._approx[j - 1][src]
                a += G0[m] * val
                d += H0[m] * val
            self._approx[j][idx] = a
            self._details[j][idx] = d
            details[j - 1] = d
        return details

    def history(self, level: int, k: int) -> np.ndarray:
        out = np.empty(k, dtype=np.float64)
        for i in range(k):
            src = (self._t - (k - 1 - i)) % self.n_buffer
            out[i] = self._details[level][src]
        return out


def batch_causal_details(y: Sequence[float], J: int = 4) -> np.ndarray:
    y = np.asarray(y, dtype=np.float64)
    T = y.size
    engine = CausalAtrous(J=J, n_buffer=max(512, T + 8))
    D = np.zeros((J, T), dtype=np.float64)
    for t in range(T):
        D[:, t] = engine.step(y[t])
    return D


def circular_modwt_details(y: Sequence[float], J: int = 4) -> np.ndarray:
    """Centered circular à trous — coefficient at t reads future samples."""
    y = np.asarray(y, dtype=np.float64)
    T = y.size
    A = y.copy()
    D = np.zeros((J, T), dtype=np.float64)
    L = len(G0)
    mid = (L - 1) // 2
    for j in range(1, J + 1):
        dilation = 1 << (j - 1)
        next_a = np.zeros(T, dtype=np.float64)
        det = np.zeros(T, dtype=np.float64)
        for t in range(T):
            a = 0.0
            d = 0.0
            for m in range(L):
                src = (t - (m - mid) * dilation) % T
                a += G0[m] * A[src]
                d += H0[m] * A[src]
            next_a[t] = a
            det[t] = d
        D[j - 1] = det
        A = next_a
    return D
