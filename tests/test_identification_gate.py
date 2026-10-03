import numpy as np

from camase.gate_roc import run_gate_roc
from camase.identification import identification_run
from camase.generators import generate


def test_identification_metrics_valid():
    for g in ("A", "B", "C"):
        res = identification_run(generate(g, n=900, seed=21))
        assert res["n_ready"] > 100
        for key in ("clip_frac_R", "clip_frac_Q", "inert_frac"):
            v = res[key]
            assert 0.0 <= v <= 1.0, (g, key, v)
        coh = res["coherence"]["mean_coh_d12_innov"]
        assert 0.0 <= coh <= 1.0, (g, coh)
        s = res["sampled"]
        assert len(s["t"]) == len(s["Eshort_over_bar"]) == len(s["ratio_R"])


def test_gate_roc_structure():
    res = run_gate_roc(n=600, horizon=20)
    assert len(res["points"]) == 2 * 3 * 2
    for p in res["points"]:
        assert 0.0 <= p["hit_rate"] <= 1.0
        assert p["far_per_day"] >= 0.0
        assert p["mean_delay"] >= 0.0 or np.isnan(p["mean_delay"])
    fars = [p["far_per_day"] for p in res["points"]]
    assert fars == sorted(fars), "points should be sorted by FAR for the ROC"
