"""Two-sided scale-attributed covariance adaptation."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .config import CamaseConfig
from .wavelet import CausalAtrous


def clip_ratio(ratio: float, cap: float) -> float:
    if not np.isfinite(ratio) or ratio <= 0:
        return 1.0
    return float(np.clip(ratio, 1.0 / cap, cap))


@dataclass
class TwoSidedAdaptor:
    cfg: CamaseConfig
    bar_h: float = 0.0
    bar_l: float = 0.0
    primed: bool = False

    def energies(self, cascade: CausalAtrous) -> tuple[float, float, np.ndarray]:
        k = self.cfg.k_var
        vars_j = np.zeros(self.cfg.J, dtype=np.float64)
        for j in range(1, self.cfg.J + 1):
            hist = cascade.history(j, k)
            vars_j[j - 1] = float(np.var(hist, ddof=1)) if k > 1 else 0.0
        w = np.asarray(self.cfg.weights, dtype=np.float64)
        e_h = 0.0
        e_l = 0.0
        for j in self.cfg.j_high:
            e_h += w[j - 1] * vars_j[j - 1]
        for j in self.cfg.j_low:
            e_l += w[j - 1] * vars_j[j - 1]
        return e_h, e_l, vars_j

    def step(self, e_h: float, e_l: float) -> tuple[float, float, float]:
        lam = self.cfg.ewma_lambda
        if not self.primed:
            self.bar_h = max(e_h, 1e-18)
            self.bar_l = max(e_l, 1e-18)
            self.primed = True
        else:
            self.bar_h = lam * self.bar_h + (1.0 - lam) * e_h
            self.bar_l = lam * self.bar_l + (1.0 - lam) * e_l
        ratio_r = (e_h / max(self.bar_h, 1e-18)) ** self.cfg.alpha
        ratio_q = (e_l / max(self.bar_l, 1e-18)) ** self.cfg.beta
        R_t = self.cfg.R0 * clip_ratio(ratio_r, self.cfg.clip_r)
        sa2 = self.cfg.sigma_a0 * clip_ratio(ratio_q, self.cfg.clip_q)
        rho = e_h / (e_h + e_l + 1e-18)
        return R_t, sa2, rho
