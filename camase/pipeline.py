"""Streaming M6 / M7 engine — one sample in, estimate + diagnostics out."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np

from .adaptation import TwoSidedAdaptor
from .config import CamaseConfig
from .gate import ShadowGate
from .kalman import KalmanIRW, process_cov, transition
from .wavelet import CausalAtrous


@dataclass
class EngineOutput:
    ready: bool
    action: str
    y: float
    p_hat: float
    v_hat: float
    R_t: float
    sigma_a2: float
    rho: float
    nis_adapt: float
    nis_shadow: float
    nu: float
    gamma: float
    cusum: float
    alarm: bool
    details: Optional[np.ndarray] = None


class CamaseEngine:
    def __init__(self, cfg: Optional[CamaseConfig] = None, gated: bool = True) -> None:
        self.cfg = cfg or CamaseConfig()
        self.gated = gated
        self.cascade = CausalAtrous(J=self.cfg.J, n_buffer=self.cfg.n_buffer)
        self.adapt = TwoSidedAdaptor(self.cfg)
        self.ad = KalmanIRW()
        self.sh = KalmanIRW()
        self.gate = ShadowGate(self.cfg)
        self.t = -1
        self.ready_t = self.cfg.warmup

    def reset(self) -> None:
        self.cascade.reset()
        self.adapt = TwoSidedAdaptor(self.cfg)
        self.ad = KalmanIRW()
        self.sh = KalmanIRW()
        self.gate = ShadowGate(self.cfg)
        self.t = -1

    def step(self, price: float, dt: Optional[float] = None) -> EngineOutput:
        dt = self.cfg.dt if dt is None else dt
        y = float(np.log(max(price, 1e-12)))
        self.t += 1
        details = self.cascade.step(y)
        F = transition(dt)
        if self.t < self.ready_t:
            Q0 = process_cov(self.cfg.sigma_a0, dt)
            self.ad.predict(F, Q0)
            self.ad.update_joseph(y, self.cfg.R0)
            self.sh.predict(F, Q0)
            self.sh.update_joseph(y, self.cfg.R0)
            return EngineOutput(
                ready=False,
                action="HOLD",
                y=y,
                p_hat=float(self.ad.x[0]),
                v_hat=float(self.ad.x[1]),
                R_t=self.cfg.R0,
                sigma_a2=self.cfg.sigma_a0,
                rho=0.5,
                nis_adapt=self.ad.last_nis,
                nis_shadow=self.sh.last_nis,
                nu=1.0,
                gamma=self.gate.gamma,
                cusum=0.0,
                alarm=False,
                details=details,
            )

        e_h, e_l, _ = self.adapt.energies(self.cascade)
        R_t, sa2, rho = self.adapt.step(e_h, e_l)
        Q = process_cov(sa2, dt)
        Q0 = process_cov(self.cfg.sigma_a0, dt)

        self.ad.predict(F, Q)
        nis_ad = self.ad.update_joseph(y, R_t)

        self.sh.predict(F, Q0)
        nis0 = float((y - self.sh.x[0]) ** 2 / ((self.sh.P[0, 0] + self.cfg.R0) or 1e-18))
        self.sh.update_joseph(y, self.cfg.R0)

        g = self.gate.step(nis0)
        action = g["action"] if self.gated else "TRADE"
        return EngineOutput(
            ready=True,
            action=action,
            y=y,
            p_hat=float(self.ad.x[0]),
            v_hat=float(self.ad.x[1]),
            R_t=R_t,
            sigma_a2=sa2,
            rho=rho,
            nis_adapt=float(nis_ad),
            nis_shadow=nis0,
            nu=g["nu"],
            gamma=g["gamma"],
            cusum=g["cusum"],
            alarm=bool(g["alarm"]) if self.gated else False,
            details=details,
        )
