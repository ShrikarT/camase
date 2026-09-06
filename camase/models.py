"""Ablation ladder M0–M7 and leaky twins M5′–M7′."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional

import numpy as np

from .config import CamaseConfig
from .kalman import KalmanIRW, process_cov, transition
from .pipeline import CamaseEngine
from .wavelet import batch_causal_details, circular_modwt_details


@dataclass
class ModelRun:
    name: str
    p_hat: np.ndarray
    v_hat: np.ndarray
    R_t: np.ndarray
    sa2: np.ndarray
    nis: np.ndarray
    nis_shadow: np.ndarray
    action: np.ndarray
    pred: np.ndarray
    ready: np.ndarray


def _alloc(n: int) -> dict:
    z = lambda: np.full(n, np.nan)
    return {
        "p": z(),
        "v": z(),
        "R": z(),
        "sa": z(),
        "nis": z(),
        "nis0": z(),
        "act": np.array(["HOLD"] * n, dtype=object),
        "pred": z(),
        "rdy": np.zeros(n, dtype=bool),
    }


def run_m0(prices: np.ndarray, cfg: CamaseConfig) -> ModelRun:
    y = np.log(np.maximum(prices, 1e-12))
    n = y.size
    o = _alloc(n)
    fast, slow = cfg.ma_fast, cfg.ma_slow
    csum = np.cumsum(y)
    for t in range(n):
        if t + 1 >= slow:
            mf = (csum[t] - (csum[t - fast] if t >= fast else 0.0)) / fast
            ms = (csum[t] - (csum[t - slow] if t >= slow else 0.0)) / slow
            o["p"][t] = mf
            o["v"][t] = mf - ms
            o["act"][t] = "TRADE" if mf > ms else "HOLD"
            o["rdy"][t] = True
            o["pred"][t] = mf
            o["R"][t] = np.nan
            o["sa"][t] = np.nan
            o["nis"][t] = np.nan
    return ModelRun("M0", o["p"], o["v"], o["R"], o["sa"], o["nis"], o["nis0"], o["act"], o["pred"], o["rdy"])


def run_static_kf(prices: np.ndarray, cfg: CamaseConfig, name: str = "M1") -> ModelRun:
    y = np.log(np.maximum(prices, 1e-12))
    n = y.size
    o = _alloc(n)
    kf = KalmanIRW()
    F = transition(cfg.dt)
    Q = process_cov(cfg.sigma_a0, cfg.dt)
    for t in range(n):
        pred = kf.one_step_pred(F)
        kf.predict(F, Q)
        kf.update_joseph(y[t], cfg.R0)
        o["p"][t] = kf.x[0]
        o["v"][t] = kf.x[1]
        o["R"][t] = cfg.R0
        o["sa"][t] = cfg.sigma_a0
        o["nis"][t] = kf.last_nis
        o["pred"][t] = pred
        o["act"][t] = "TRADE"
        o["rdy"][t] = t >= 2
    return ModelRun(name, o["p"], o["v"], o["R"], o["sa"], o["nis"], o["nis0"], o["act"], o["pred"], o["rdy"])


def run_m2_rolling(prices: np.ndarray, cfg: CamaseConfig) -> ModelRun:
    y = np.log(np.maximum(prices, 1e-12))
    n = y.size
    o = _alloc(n)
    kf = KalmanIRW()
    F = transition(cfg.dt)
    dy = np.diff(y, prepend=y[0])
    for t in range(n):
        w0 = max(0, t - cfg.roll_sigma_win + 1)
        sig = float(np.std(dy[w0 : t + 1], ddof=1)) if t > 5 else np.sqrt(cfg.R0)
        R = float(np.clip(sig * sig, cfg.R0 / cfg.clip_r, cfg.R0 * cfg.clip_r))
        Q = process_cov(cfg.sigma_a0, cfg.dt)
        pred = kf.one_step_pred(F)
        kf.predict(F, Q)
        kf.update_joseph(y[t], R)
        o["p"][t] = kf.x[0]
        o["v"][t] = kf.x[1]
        o["R"][t] = R
        o["sa"][t] = cfg.sigma_a0
        o["nis"][t] = kf.last_nis
        o["pred"][t] = pred
        o["act"][t] = "TRADE"
        o["rdy"][t] = t >= cfg.roll_sigma_win
    return ModelRun("M2", o["p"], o["v"], o["R"], o["sa"], o["nis"], o["nis0"], o["act"], o["pred"], o["rdy"])


def run_m3_iae(prices: np.ndarray, cfg: CamaseConfig) -> ModelRun:
    y = np.log(np.maximum(prices, 1e-12))
    n = y.size
    o = _alloc(n)
    kf = KalmanIRW()
    F = transition(cfg.dt)
    Q = process_cov(cfg.sigma_a0, cfg.dt)
    innovs: list[float] = []
    for t in range(n):
        pred = kf.one_step_pred(F)
        kf.predict(F, Q)
        R = cfg.R0
        if len(innovs) >= cfg.iae_win:
            R = float(np.mean(np.square(innovs[-cfg.iae_win:])))
            R = float(np.clip(R, cfg.R0 / cfg.clip_r, cfg.R0 * cfg.clip_r))
        kf.update_joseph(y[t], R)
        innovs.append(kf.last_innov)
        o["p"][t] = kf.x[0]
        o["v"][t] = kf.x[1]
        o["R"][t] = R
        o["sa"][t] = cfg.sigma_a0
        o["nis"][t] = kf.last_nis
        o["pred"][t] = pred
        o["act"][t] = "TRADE"
        o["rdy"][t] = t >= cfg.iae_win
    return ModelRun("M3", o["p"], o["v"], o["R"], o["sa"], o["nis"], o["nis0"], o["act"], o["pred"], o["rdy"])


def run_m4_sage_husa(prices: np.ndarray, cfg: CamaseConfig) -> ModelRun:
    y = np.log(np.maximum(prices, 1e-12))
    n = y.size
    o = _alloc(n)
    kf = KalmanIRW()
    F = transition(cfg.dt)
    R_hat = cfg.R0
    sa = cfg.sigma_a0
    beta = 0.995
    for t in range(n):
        Q = process_cov(sa, cfg.dt)
        pred = kf.one_step_pred(F)
        x_pred = F @ kf.x
        kf.predict(F, Q)
        kf.update_joseph(y[t], R_hat)
        resid = y[t] - kf.x[0]
        innov = y[t] - x_pred[0]
        R_hat = beta * R_hat + (1 - beta) * max(resid * resid, 1e-16)
        R_hat = float(np.clip(R_hat, cfg.R0 / cfg.clip_r, cfg.R0 * cfg.clip_r))
        sa = beta * sa + (1 - beta) * max(innov * innov, 1e-18)
        sa = float(np.clip(sa, cfg.sigma_a0 / cfg.clip_q, cfg.sigma_a0 * cfg.clip_q))
        o["p"][t] = kf.x[0]
        o["v"][t] = kf.x[1]
        o["R"][t] = R_hat
        o["sa"][t] = sa
        o["nis"][t] = kf.last_nis
        o["pred"][t] = pred
        o["act"][t] = "TRADE"
        o["rdy"][t] = t >= 20
    return ModelRun("M4", o["p"], o["v"], o["R"], o["sa"], o["nis"], o["nis0"], o["act"], o["pred"], o["rdy"])


def run_m4b_oakf(prices: np.ndarray, cfg: CamaseConfig) -> ModelRun:
    """Base-paper ratchet: raise Q and R together, never decrease."""
    y = np.log(np.maximum(prices, 1e-12))
    n = y.size
    o = _alloc(n)
    kf = KalmanIRW()
    F = transition(cfg.dt)
    R = cfg.R0
    sa = cfg.sigma_a0
    buf: list[float] = []
    for t in range(n):
        Q = process_cov(sa, cfg.dt)
        pred = kf.one_step_pred(F)
        kf.predict(F, Q)
        kf.update_joseph(y[t], R)
        buf.append(abs(kf.last_innov))
        if len(buf) > 30:
            buf.pop(0)
        thr = 2.0 * (np.std(buf) + 1e-12)
        if abs(kf.last_innov) > thr:
            R = min(R * 1.15, cfg.R0 * cfg.clip_r)
            sa = min(sa * 1.15, cfg.sigma_a0 * cfg.clip_q)
        o["p"][t] = kf.x[0]
        o["v"][t] = kf.x[1]
        o["R"][t] = R
        o["sa"][t] = sa
        o["nis"][t] = kf.last_nis
        o["pred"][t] = pred
        o["act"][t] = "TRADE"
        o["rdy"][t] = t >= 30
    return ModelRun("M4b", o["p"], o["v"], o["R"], o["sa"], o["nis"], o["nis0"], o["act"], o["pred"], o["rdy"])


def run_engine_model(prices: np.ndarray, cfg: CamaseConfig, name: str, gated: bool) -> ModelRun:
    n = prices.size
    o = _alloc(n)
    eng = CamaseEngine(cfg, gated=gated)
    F = transition(cfg.dt)
    prev_x = np.zeros(2)
    for t, px in enumerate(prices):
        pred = float((F @ prev_x)[0])
        out = eng.step(float(px))
        prev_x = np.array([out.p_hat, out.v_hat])
        o["p"][t] = out.p_hat
        o["v"][t] = out.v_hat
        o["R"][t] = out.R_t
        o["sa"][t] = out.sigma_a2
        o["nis"][t] = out.nis_adapt
        o["nis0"][t] = out.nis_shadow
        o["act"][t] = out.action
        o["pred"][t] = pred
        o["rdy"][t] = out.ready
    return ModelRun(name, o["p"], o["v"], o["R"], o["sa"], o["nis"], o["nis0"], o["act"], o["pred"], o["rdy"])


def run_m5_single_scale(prices: np.ndarray, cfg: CamaseConfig, leaky: bool = False) -> ModelRun:
    y = np.log(np.maximum(prices, 1e-12))
    n = y.size
    D = circular_modwt_details(y, cfg.J) if leaky else batch_causal_details(y, cfg.J)
    o = _alloc(n)
    kf = KalmanIRW()
    F = transition(cfg.dt)
    bar = None
    for t in range(n):
        R = cfg.R0
        ready = t >= cfg.warmup
        if ready:
            sl = D[0, t - cfg.k_var + 1 : t + 1]
            e = float(np.var(sl, ddof=1))
            bar = e if bar is None else cfg.ewma_lambda * bar + (1 - cfg.ewma_lambda) * e
            ratio = (e / max(bar, 1e-18)) ** cfg.alpha
            ratio = float(np.clip(ratio, 1 / cfg.clip_r, cfg.clip_r))
            R = cfg.R0 * ratio
        Q = process_cov(cfg.sigma_a0, cfg.dt)
        pred = kf.one_step_pred(F)
        kf.predict(F, Q)
        kf.update_joseph(y[t], R)
        o["p"][t] = kf.x[0]
        o["v"][t] = kf.x[1]
        o["R"][t] = R
        o["sa"][t] = cfg.sigma_a0
        o["nis"][t] = kf.last_nis
        o["pred"][t] = pred
        o["act"][t] = "TRADE"
        o["rdy"][t] = ready
    return ModelRun("M5'" if leaky else "M5", o["p"], o["v"], o["R"], o["sa"], o["nis"], o["nis0"], o["act"], o["pred"], o["rdy"])


def run_leaky_m6(prices: np.ndarray, cfg: CamaseConfig, gated: bool = False) -> ModelRun:
    """Circular full-sample energies drive the same KF — look-ahead twin."""
    y = np.log(np.maximum(prices, 1e-12))
    n = y.size
    D = circular_modwt_details(y, cfg.J)
    o = _alloc(n)
    kf = KalmanIRW()
    F = transition(cfg.dt)
    bar_h = bar_l = None
    for t in range(n):
        R, sa = cfg.R0, cfg.sigma_a0
        ready = t >= cfg.k_var
        if ready:
            e_h = float(np.var(D[0, t - cfg.k_var + 1 : t + 1], ddof=1) + np.var(D[1, t - cfg.k_var + 1 : t + 1], ddof=1))
            e_l = float(np.var(D[2, t - cfg.k_var + 1 : t + 1], ddof=1) + np.var(D[3, t - cfg.k_var + 1 : t + 1], ddof=1))
            bar_h = e_h if bar_h is None else cfg.ewma_lambda * bar_h + (1 - cfg.ewma_lambda) * e_h
            bar_l = e_l if bar_l is None else cfg.ewma_lambda * bar_l + (1 - cfg.ewma_lambda) * e_l
            rr = float(np.clip((e_h / max(bar_h, 1e-18)) ** cfg.alpha, 1 / cfg.clip_r, cfg.clip_r))
            rq = float(np.clip((e_l / max(bar_l, 1e-18)) ** cfg.beta, 1 / cfg.clip_q, cfg.clip_q))
            R = cfg.R0 * rr
            sa = cfg.sigma_a0 * rq
        Q = process_cov(sa, cfg.dt)
        pred = kf.one_step_pred(F)
        kf.predict(F, Q)
        kf.update_joseph(y[t], R)
        o["p"][t] = kf.x[0]
        o["v"][t] = kf.x[1]
        o["R"][t] = R
        o["sa"][t] = sa
        o["nis"][t] = kf.last_nis
        o["pred"][t] = pred
        o["act"][t] = "TRADE"
        o["rdy"][t] = ready
    tag = "M7'" if gated else "M6'"
    return ModelRun(tag, o["p"], o["v"], o["R"], o["sa"], o["nis"], o["nis0"], o["act"], o["pred"], o["rdy"])


RUNNERS: dict[str, Callable[[np.ndarray, CamaseConfig], ModelRun]] = {
    "M0": run_m0,
    "M1": run_static_kf,
    "M2": run_m2_rolling,
    "M3": run_m3_iae,
    "M4": run_m4_sage_husa,
    "M4b": run_m4b_oakf,
    "M5": lambda p, c: run_m5_single_scale(p, c, leaky=False),
    "M6": lambda p, c: run_engine_model(p, c, "M6", gated=False),
    "M7": lambda p, c: run_engine_model(p, c, "M7", gated=True),
    "M5'": lambda p, c: run_m5_single_scale(p, c, leaky=True),
    "M6'": lambda p, c: run_leaky_m6(p, c, gated=False),
    "M7'": lambda p, c: run_leaky_m6(p, c, gated=True),
}


def run_model(name: str, prices: np.ndarray, cfg: Optional[CamaseConfig] = None) -> ModelRun:
    cfg = cfg or CamaseConfig()
    if name not in RUNNERS:
        raise KeyError(f"unknown model {name}")
    return RUNNERS[name](prices, cfg)
