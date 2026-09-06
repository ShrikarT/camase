"""Filter algebra + support lengths. Does not relax Audits A/B."""

import numpy as np

from camase.config import DEFAULT_CONFIG
from camase.wavelet import G0, H0, batch_causal_details, support_length


def test_db4_lowpass_sums_near_sqrt2_before_scale():
    # G0 = db4_lo / √2, so sum(G0) ≈ 1 (low-pass gain on a constant).
    assert abs(G0.sum() - 1.0) < 1e-12


def test_db4_highpass_kills_dc():
    assert abs(H0.sum()) < 1e-12


def test_qmf_alternating_flip():
    # High-pass is low-pass reversed with alternating signs (up to 1/√2 scale already applied).
    lo = G0
    expected = lo[::-1] * np.array([1, -1, 1, -1, 1, -1, 1, -1], dtype=float)
    # db4 convention in this repo uses the opposite alternating start; allow either phase.
    alt = lo[::-1] * np.array([-1, 1, -1, 1, -1, 1, -1, 1], dtype=float)
    assert np.allclose(H0, expected, atol=1e-12) or np.allclose(H0, alt, atol=1e-12)


def test_support_matches_paper():
    assert [support_length(j) for j in range(1, 5)] == [8, 22, 50, 106]
    assert DEFAULT_CONFIG.warmup == 169


def test_causal_details_shape():
    y = np.linspace(0, 1, 80)
    D = batch_causal_details(y, J=4)
    assert D.shape == (4, 80)
    assert np.isfinite(D).all()
