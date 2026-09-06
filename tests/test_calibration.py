from camase.calibration import far_on_null, run_calibration
from camase.config import get_profile


def test_profiles_are_distinct():
    paper = get_profile("paper")
    rev = get_profile("review2")
    assert paper.ewma_lambda == 0.995
    assert rev.ewma_lambda == 0.97
    assert rev.alpha == 0.5


def test_calibration_emits_both_profiles():
    out = run_calibration(n=500, tracks=("A2",), models=("M2", "M6"))
    assert len(out["blocks"]) == 2
    profiles = {b["profile"] for b in out["blocks"]}
    assert profiles == {"paper", "review2"}
    assert "m6_beats_m2_snr" in out["blocks"][0]


def test_far_on_null_has_ready_samples():
    out = far_on_null(n=400, seed=1)
    assert out["track"] == "A1"
    assert out["n_ready"] > 50
    assert 0.0 <= out["hold_frac"] <= 1.0
