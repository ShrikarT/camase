"""Default hyperparameters from paper v2.1 / Objectives v2.1."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence


@dataclass
class CamaseConfig:
    n_buffer: int = 512
    J: int = 4
    k_var: int = 64
    L: int = 8
    wavelet: str = "db4"
    j_high: Sequence[int] = field(default_factory=lambda: (1, 2))
    j_low: Sequence[int] = field(default_factory=lambda: (3, 4))
    weights: Sequence[float] = field(default_factory=lambda: (1.0, 1.0, 1.0, 1.0))
    ewma_lambda: float = 0.995
    alpha: float = 1.0
    beta: float = 1.0
    clip_r: float = 10.0
    clip_q: float = 10.0
    R0: float = 1.2e-7
    sigma_a0: float = 2.5e-7
    dt: float = 1.0
    nis_window: int = 60
    persist_k: int = 3
    persist_m: int = 5
    chi2_alpha: float = 0.005
    cusum_kappa: float = 1.6
    cusum_h: float = 36.0
    cost_rt_bp: float = 20.0
    ma_fast: int = 8
    ma_slow: int = 32
    roll_sigma_win: int = 64
    iae_win: int = 30
    seed: int = 42

    @property
    def support(self) -> list[int]:
        return [(2**j - 1) * (self.L - 1) + 1 for j in range(1, self.J + 1)]

    @property
    def warmup(self) -> int:
        return self.support[-1] + self.k_var - 1


DEFAULT_CONFIG = CamaseConfig()
