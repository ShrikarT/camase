"""M8 IMM mixing and M9 UKF sigma-point contracts."""

import numpy as np

from camase.config import CamaseConfig
from camase.imm import IMMFilter, N_MODES, MODE_SCALES, transition_matrix
from camase.models import run_model
from camase.ukf import UnscentedIRW


def test_imm_transition_rows_sum_to_one():
    P = transition_matrix()
    assert P.shape == (N_MODES, N_MODES)
    np.testing.assert_allclose(P.sum(axis=1), np.ones(N_MODES))
    assert np.all(np.diag(P) == 0.92)


def test_imm_weights_are_a_simplex():
    rng = np.random.default_rng(0)
    y = np.cumsum(rng.normal(0, 1e-4, 80))
    prices = np.exp(y)
    imm = IMMFilter(R0=1.2e-7, sigma_a0=2.5e-7)
    for yt in y:
        imm.step(float(yt))
    assert imm.mu.shape == (3,)
    np.testing.assert_allclose(imm.mu.sum(), 1.0, atol=1e-12)
    assert np.all(imm.mu >= 0)
    assert len(MODE_SCALES) == 3


def test_ukf_has_five_sigma_points():
    ukf = UnscentedIRW()
    assert ukf.n_sigma == 5
    pts = ukf.sigma_points()
    assert pts.shape == (5, 2)
    # Mean of unweighted pts is not the claim — first point is the mean.
    np.testing.assert_allclose(pts[0], ukf.x)


def test_m8_m9_run_on_short_path():
    rng = np.random.default_rng(1)
    prices = 100 * np.exp(np.cumsum(rng.normal(0, 1e-4, 120)))
    cfg = CamaseConfig()
    r8 = run_model("M8", prices, cfg)
    r9 = run_model("M9", prices, cfg)
    assert r8.name == "M8" and r9.name == "M9"
    assert np.isfinite(r8.p_hat[10:]).all()
    assert np.isfinite(r9.p_hat[10:]).all()
