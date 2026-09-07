from camase.diagnostics import jump_table, leakage_priced, pilot_r0, step_response_delay
from camase.heston import generate_heston
from camase.models import run_model


def test_m6r_runs():
    path = generate_heston(n=400, track="A2", seed=1)
    run = run_model("M6r", path.price)
    assert run.ready.sum() > 50
    assert run.name == "M6r"


def test_step_delay_finite():
    d = step_response_delay()
    assert d["delay_50pct_bars"] == d["delay_50pct_bars"]  # not NaN
    assert d["delay_50pct_bars"] >= 0


def test_leakage_keys():
    out = leakage_priced(n=500, seed=2)
    assert "leaky_minus_causal_cum_bp" in out


def test_jump_table_counts():
    out = jump_table(n=800, seed=3)
    assert out["n_jumps"] + 0 == out["hits_within_horizon"] + out["misses"]


def test_pilot_positive():
    path = generate_heston(n=300, track="A1", seed=0)
    assert pilot_r0(path.log_obs, 80) > 0
