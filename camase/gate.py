"""Shadow-filter sequential innovation-consistency gating."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field

from scipy.stats import chi2

from .config import CamaseConfig


def window_threshold(M: int, alpha: float) -> float:
    """γ_M = χ²_{M, 1-α} / M  so that M·ν ~ χ²_M under the null."""
    return float(chi2.ppf(1.0 - alpha, M) / M)


@dataclass
class ShadowGate:
    cfg: CamaseConfig
    nis_win: deque[float] = field(default_factory=deque)
    exceed: deque[bool] = field(default_factory=deque)
    g: float = 0.0
    gamma: float = 0.0

    def __post_init__(self) -> None:
        self.gamma = window_threshold(self.cfg.nis_window, self.cfg.chi2_alpha)

    def step(self, nis0: float) -> dict:
        M = self.cfg.nis_window
        self.nis_win.append(float(nis0))
        if len(self.nis_win) > M:
            self.nis_win.popleft()
        nu = sum(self.nis_win) / max(len(self.nis_win), 1)
        self.g = max(0.0, self.g + float(nis0) - self.cfg.cusum_kappa)
        over = nu > self.gamma
        self.exceed.append(over)
        if len(self.exceed) > self.cfg.persist_m:
            self.exceed.popleft()
        persist_hits = sum(1 for x in self.exceed if x)
        persist_alarm = persist_hits >= self.cfg.persist_k and len(self.exceed) >= self.cfg.persist_k
        cusum_alarm = self.g > self.cfg.cusum_h
        alarm = persist_alarm or cusum_alarm
        locked = not alarm
        return {
            "nu": nu,
            "gamma": self.gamma,
            "cusum": self.g,
            "persist_hits": persist_hits,
            "persist_alarm": persist_alarm,
            "cusum_alarm": cusum_alarm,
            "alarm": alarm,
            "locked": locked,
            "action": "TRADE" if locked else "HOLD",
        }
