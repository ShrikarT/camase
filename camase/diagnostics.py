"""Additive Review-2 diagnostics. Does not change paper defaults."""

from __future__ import annotations

from dataclasses import replace

import numpy as np

from .config import DEFAULT_CONFIG, CamaseConfig
from .heston import generate_heston
from .metrics import score_track_a
from .models import run_model
from .pipeline import CamaseEngine
from .strategy import overlay_long_flat


def pilot_r0(log_price: np.ndarray, warmup: int) -> float:
    """Training-prefix return variance. Not written back into DEFAULT_CONFIG."""
    dy = np.diff(log_price[: max(warmup, 8)])
    v = float(np.var(dy, ddof=1)) if dy.size > 2 else DEFAULT_CONFIG.R0
    return max(v, 1e-12)


def step_response_delay(amp: float = 0.02, n: int = 500, noise: float = 3e-4) -> dict:
    """Bars until the filter reaches 50% of a late step in log-price."""
    rng = np.random.default_rng(0)
    y = rng.normal(scale=noise, size=n)
    t_step = 260
    y[t_step:] += amp
    price = np.exp(y)
    eng = CamaseEngine(DEFAULT_CONFIG, gated=False)
    ph = np.zeros(n)
    for t, px in enumerate(price):
        ph[t] = eng.step(float(px)).p_hat
    base = float(np.mean(ph[t_step - 20 : t_step]))
    target = base + 0.5 * amp
    delay = float("nan")
    for t in range(t_step, n):
        if ph[t] >= target:
            delay = float(t - t_step)
            break
    return {"t_step": t_step, "amp_log": amp, "delay_50pct_bars": delay, "note": "measured on a clean step, not the static-gain formula"}


def far_sensitivity(n: int = 1800, seed: int = 3) -> dict:
    path = generate_heston(n=n, track="A1", seed=seed)
    rows = []
    for persist_k, cusum_h in ((3, 36.0), (2, 36.0), (3, 18.0), (2, 18.0), (3, 8.0)):
        cfg = replace(DEFAULT_CONFIG, persist_k=persist_k, cusum_h=cusum_h)
        run = run_model("M7", path.price, cfg)
        sc = score_track_a(run, path.log_obs, path.latent, path.drift, path.jump_flags)
        rows.append(
            {
                "persist_k": persist_k,
                "cusum_h": cusum_h,
                "far_per_day": sc.far_per_day,
                "time_in_market": sc.time_in_market,
            }
        )
    return {
        "track": "A1",
        "n": n,
        "seed": seed,
        "note": "Paper sentence '~1 FA/session' is not the default row. This table is the sensitivity.",
        "rows": rows,
    }


def leakage_priced(n: int = 1600, seed: int = 42) -> dict:
    path = generate_heston(n=n, track="A2", seed=seed)
    causal = run_model("M6", path.price)
    leaky = run_model("M6'", path.price)
    sc = overlay_long_flat(causal, path.log_obs, DEFAULT_CONFIG.cost_rt_bp)
    sl = overlay_long_flat(leaky, path.log_obs, DEFAULT_CONFIG.cost_rt_bp)
    diff_bp = (sl.sharpe_net - sc.sharpe_net)  # per-bar Sharpe gap, not bp
    # mean extra log-return of leaky minus causal, in bp per bar
    extra = float(np.nanmean(sl.equity_net[-1] - sc.equity_net[-1]) * 1e4) if sl.equity_net.size else float("nan")
    return {
        "causal_sharpe_net": sc.sharpe_net,
        "leaky_sharpe_net": sl.sharpe_net,
        "leaky_minus_causal_cum_bp": extra,
        "note": "Positive leaky-minus-causal cum bp is the economic price of Audit-C look-ahead.",
    }


def jump_table(n: int = 1800, seed: int = 42, horizon: int = 20) -> dict:
    path = generate_heston(n=n, track="A3", seed=seed)
    run = run_model("M7", path.price)
    onsets = np.where(path.jump_flags)[0]
    hits = 0
    delays = []
    for t0 in onsets:
        w = np.where(run.action[t0 : t0 + horizon] == "HOLD")[0]
        if w.size:
            hits += 1
            delays.append(int(w[0]))
    n_hold = int(((run.action == "HOLD") & run.ready & ~path.jump_flags).sum())
    n_ready_null = int((run.ready & ~path.jump_flags).sum())
    return {
        "track": "A3",
        "n_jumps": int(onsets.size),
        "hits_within_horizon": hits,
        "misses": int(onsets.size - hits),
        "hit_rate": hits / max(onsets.size, 1),
        "mean_delay_on_hit": float(np.mean(delays)) if delays else float("nan"),
        "false_holds_on_nonjump": n_hold,
        "false_hold_frac": n_hold / max(n_ready_null, 1),
        "horizon": horizon,
    }


def robustness(n: int = 1200, seeds: tuple[int, ...] = (42, 7, 11, 19, 23, 29, 31, 37)) -> dict:
    models = ("M2", "M6", "M6r", "M8")
    by = {m: [] for m in models}
    for seed in seeds:
        path = generate_heston(n=n, track="A2", seed=seed)
        for m in models:
            run = run_model(m, path.price)
            sc = score_track_a(run, path.log_obs, path.latent, path.drift, path.jump_flags)
            by[m].append(sc.snr_db)
    summary = {}
    for m, xs in by.items():
        a = np.asarray(xs, dtype=float)
        summary[m] = {
            "mean_snr": float(np.nanmean(a)),
            "std_snr": float(np.nanstd(a)),
            "wins_vs_m2": int(np.nansum(a > np.asarray(by["M2"]))) if m != "M2" else None,
            "n_seeds": int(a.size),
        }
    return {
        "seeds": list(seeds),
        "n": n,
        "track": "A2",
        "summary": summary,
        "note": "Frozen evaluation seed remains 42. This block is robustness only.",
    }


def run_all_diagnostics() -> dict:
    path = generate_heston(n=800, track="A2", seed=42)
    return {
        "pilot_r0": pilot_r0(path.log_obs, DEFAULT_CONFIG.warmup),
        "step_delay": step_response_delay(),
        "far_sensitivity": far_sensitivity(),
        "leakage_priced": leakage_priced(),
        "jump_table": jump_table(),
        "robustness": robustness(),
    }
