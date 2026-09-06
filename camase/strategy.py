"""Cost-aware long/flat overlay on filter velocity."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .models import ModelRun


@dataclass
class StrategyResult:
    equity_gross: np.ndarray
    equity_net: np.ndarray
    sharpe_gross: float
    sharpe_net: float
    max_dd_net: float
    turnover: float
    time_in_market: float
    n_trades: int


def overlay_long_flat(run: ModelRun, log_price: np.ndarray, cost_rt_bp: float = 20.0) -> StrategyResult:
    n = log_price.size
    pos = np.zeros(n)
    for t in range(n):
        if not run.ready[t]:
            pos[t] = 0.0
            continue
        if run.action[t] != "TRADE":
            pos[t] = 0.0
            continue
        pos[t] = 1.0 if (np.isfinite(run.v_hat[t]) and run.v_hat[t] > 0) else 0.0
    # Execute next bar (no same-bar fill).
    pos_exec = np.zeros(n)
    pos_exec[1:] = pos[:-1]
    rets = np.diff(log_price, prepend=log_price[0])
    gross = pos_exec * rets
    dpos = np.abs(np.diff(pos_exec, prepend=0.0))
    cost = dpos * (cost_rt_bp * 1e-4 / 2.0)
    net = gross - cost
    def sharpe(x: np.ndarray) -> float:
        m = x[run.ready] if run.ready.any() else x
        if m.std() == 0:
            return 0.0
        return float(m.mean() / m.std() * np.sqrt(365 * 24 * 60))
    eq_g = np.cumsum(gross)
    eq_n = np.cumsum(net)
    peak = np.maximum.accumulate(eq_n)
    dd = eq_n - peak
    tim = float(np.mean(pos_exec[run.ready] != 0)) if run.ready.any() else 0.0
    return StrategyResult(
        equity_gross=eq_g,
        equity_net=eq_n,
        sharpe_gross=sharpe(gross),
        sharpe_net=sharpe(net),
        max_dd_net=float(dd.min()),
        turnover=float(dpos.sum()),
        time_in_market=tim,
        n_trades=int(np.sum(dpos > 0)),
    )
