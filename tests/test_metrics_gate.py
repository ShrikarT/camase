from camase.adaptation import clip_ratio
from camase.config import DEFAULT_CONFIG
from camase.gate import window_threshold
from camase.jsonutil import sanitize
from camase.strategy import overlay_long_flat
from camase.models import run_model
import numpy as np


def test_clip_ratio_bounds():
    assert clip_ratio(100, 10) == 10
    assert clip_ratio(0.001, 10) == 0.1
    assert clip_ratio(float("nan"), 10) == 1.0


def test_chi2_threshold_positive():
    g = window_threshold(60, 0.005)
    assert 1.3 < g < 2.0


def test_sanitize_nans():
    out = sanitize({"a": float("nan"), "b": [1.0, float("inf")]})
    assert out == {"a": None, "b": [1.0, None]}


def test_per_bar_sharpe_not_annualised():
    rng = np.random.default_rng(0)
    prices = 100 * np.exp(np.cumsum(rng.normal(0, 1e-4, 400)))
    run = run_model("M1", prices)
    st = overlay_long_flat(run, np.log(prices), 20.0)
    assert abs(st.sharpe_net) < 2.0  # per-bar, not ±400
    assert abs(st.sharpe_net_ann) >= abs(st.sharpe_net)
