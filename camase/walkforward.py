"""Purged / embargoed expanding walk-forward.

Train grows. A purge gap of `warmup` bars is dropped at the train/test
join so wavelet support cannot leak. After each test fold an embargo of
L_4 bars is skipped before the next train extension.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Iterable

import numpy as np

from .config import CamaseConfig, DEFAULT_CONFIG
from .metrics import deflated_sharpe, mspe
from .models import run_model
from .strategy import overlay_long_flat


@dataclass
class Fold:
    fold: int
    train_start: int
    train_end: int
    test_start: int
    test_end: int
    embargo_end: int


def make_folds(
    n: int,
    warmup: int = 169,
    l4: int = 106,
    min_train: int | None = None,
    test_frac: float = 0.2,
    max_folds: int = 6,
) -> list[Fold]:
    """Expanding 60/20-style folds with purge + embargo.

    First train length defaults to 60% of n, each test is ~20% of the
    remaining unused span, clipped by max_folds.
    """
    min_train = min_train or max(warmup + 50, int(0.6 * n))
    folds: list[Fold] = []
    train_end = min_train
    fold_i = 0
    while train_end < n - warmup and fold_i < max_folds:
        test_start = train_end + warmup  # purge gap
        if test_start >= n:
            break
        remaining = n - test_start
        test_len = max(int(remaining * test_frac), warmup + 80)
        test_end = min(n, test_start + test_len)
        if test_end - test_start < 30:
            break
        embargo_end = min(n, test_end + l4)
        folds.append(
            Fold(
                fold=fold_i,
                train_start=0,
                train_end=train_end,
                test_start=test_start,
                test_end=test_end,
                embargo_end=embargo_end,
            )
        )
        train_end = embargo_end
        fold_i += 1
    return folds


def assert_no_leakage(folds: Iterable[Fold]) -> None:
    for f in folds:
        if f.test_start < f.train_end:
            raise AssertionError(f"fold {f.fold}: test overlaps train")
        if f.test_start - f.train_end < 1:
            raise AssertionError(f"fold {f.fold}: missing purge gap")
        if f.embargo_end < f.test_end:
            raise AssertionError(f"fold {f.fold}: embargo before test end")


def bootstrap_ci(x: np.ndarray, n_boot: int = 400, seed: int = 0, alpha: float = 0.05) -> dict:
    rng = np.random.default_rng(seed)
    x = np.asarray(x, dtype=float)
    x = x[np.isfinite(x)]
    if x.size < 2:
        return {"mean": float("nan"), "lo": float("nan"), "hi": float("nan")}
    stats = []
    for _ in range(n_boot):
        draw = rng.choice(x, size=x.size, replace=True)
        stats.append(float(draw.mean()))
    lo, hi = np.quantile(stats, [alpha / 2, 1 - alpha / 2])
    return {"mean": float(x.mean()), "lo": float(lo), "hi": float(hi)}


def _slice_run(run, off: int):
    from .models import ModelRun

    sl = slice(off, None)
    return ModelRun(
        name=run.name,
        p_hat=run.p_hat[sl],
        v_hat=run.v_hat[sl],
        R_t=run.R_t[sl],
        sa2=run.sa2[sl],
        nis=run.nis[sl],
        nis_shadow=run.nis_shadow[sl],
        action=run.action[sl],
        pred=run.pred[sl],
        ready=run.ready[sl],
    )


def run_walkforward(
    prices: np.ndarray,
    log_price: np.ndarray | None = None,
    models: Iterable[str] = ("M1", "M2", "M6", "M7", "M8", "M9"),
    cfg: CamaseConfig | None = None,
    n_trials_hint: int | None = None,
) -> dict:
    cfg = cfg or DEFAULT_CONFIG
    prices = np.asarray(prices, dtype=float)
    if log_price is None:
        log_price = np.log(np.maximum(prices, 1e-12))
    folds = make_folds(len(prices), warmup=cfg.warmup, l4=cfg.support[-1])
    assert_no_leakage(folds)
    models = list(models)
    n_trials = n_trials_hint or (len(folds) * len(models))
    trials = []
    by_model: dict[str, list[float]] = {m: [] for m in models}
    for fold in folds:
        # Run from the start of the purge gap so causal warm-up is paid
        # before the first scored test bar. Score only the test slice.
        run_start = fold.train_end
        px_run = prices[run_start:fold.test_end]
        yp_run = log_price[run_start:fold.test_end]
        off = fold.test_start - run_start
        for name in models:
            run = run_model(name, px_run, cfg)
            run = _slice_run(run, off)
            yp_test = yp_run[off:]
            st = overlay_long_flat(run, yp_test, cfg.cost_rt_bp)
            row = {
                "fold": fold.fold,
                "model": name,
                "test_start": fold.test_start,
                "test_end": fold.test_end,
                "purge": fold.test_start - fold.train_end,
                "embargo": fold.embargo_end - fold.test_end,
                "mspe": mspe(run, yp_test),
                "sharpe_net": st.sharpe_net,
                "sharpe_net_ann": st.sharpe_net_ann,
                "sharpe_gross": st.sharpe_gross,
                "max_dd_net": st.max_dd_net,
                "time_in_market": st.time_in_market,
                "n_trades": st.n_trades,
            }
            trials.append(row)
            by_model[name].append(st.sharpe_net)

    summary = []
    for name, srs in by_model.items():
        arr = np.asarray(srs, dtype=float)
        ci = bootstrap_ci(arr)
        mean_sr = float(np.nanmean(arr)) if arr.size else float("nan")
        n_obs = max(int(np.mean([t["test_end"] - t["test_start"] for t in trials if t["model"] == name] or [1])), 3)
        summary.append(
            {
                "model": name,
                "mean_sharpe_net": mean_sr,
                "sharpe_ci": ci,
                "deflated_sharpe": deflated_sharpe(mean_sr, n_obs=n_obs, n_trials=n_trials),
                "n_folds": int(np.sum(np.isfinite(arr))),
            }
        )
    return {
        "n": int(len(prices)),
        "warmup": cfg.warmup,
        "l4": cfg.support[-1],
        "n_folds": len(folds),
        "n_trials": n_trials,
        "folds": [asdict(f) for f in folds],
        "trials": trials,
        "summary": summary,
    }
