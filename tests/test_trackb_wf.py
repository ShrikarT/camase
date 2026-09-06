"""Track B loader and purged walk-forward contracts."""

from pathlib import Path

import numpy as np

from camase.trackb import load_ohlcv_csv, synthetic_btc, write_sample_csv
from camase.walkforward import assert_no_leakage, make_folds, run_walkforward


def test_synthetic_btc_tagged():
    bars = synthetic_btc(n=200, seed=3)
    assert bars.synthetic is True
    assert bars.sha256 is None
    assert bars.close.size == 200
    assert np.all(bars.close > 0)


def test_csv_roundtrip_hashed(tmp_path: Path):
    p = tmp_path / "btc.csv"
    write_sample_csv(p, n=80, seed=4)
    loaded = load_ohlcv_csv(p)
    assert loaded.synthetic is False
    assert loaded.sha256 is not None
    assert len(loaded.sha256) == 64
    assert loaded.close.size == 80


def test_folds_have_purge_and_embargo():
    folds = make_folds(n=2000, warmup=169, l4=106, min_train=1200, test_frac=0.25, max_folds=4)
    assert folds, "expected at least one fold"
    assert_no_leakage(folds)
    for f in folds:
        assert f.test_start - f.train_end == 169
        assert f.test_start >= f.train_end + 169
        assert f.embargo_end >= f.test_end
        assert f.embargo_end - f.test_end <= 106 or f.embargo_end == 2000


def test_walkforward_runs_two_models():
    rng = np.random.default_rng(2)
    prices = 100 * np.exp(np.cumsum(rng.normal(0, 1e-4, 900)))
    out = run_walkforward(prices, models=("M1", "M8"), cfg=None)
    assert out["n_folds"] >= 1
    assert out["trials"]
    models = {t["model"] for t in out["trials"]}
    assert models == {"M1", "M8"}
    for t in out["trials"]:
        assert t["purge"] >= 169
