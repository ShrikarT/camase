import numpy as np

from camase.heston import generate_heston
from camase.kalman import KalmanIRW, process_cov, transition
from camase.models import run_model


def test_joseph_keeps_psd():
    kf = KalmanIRW()
    F = transition(1.0)
    Q = process_cov(1e-8, 1.0)
    rng = np.random.default_rng(0)
    y = np.cumsum(rng.normal(scale=0.001, size=200))
    for t in y:
        kf.predict(F, Q)
        kf.update_joseph(float(t), 1e-6)
        eig = np.linalg.eigvalsh(kf.P)
        assert np.all(eig > -1e-12)
        assert abs(kf.P[0, 1] - kf.P[1, 0]) < 1e-15


def test_m6_runs_on_heston():
    path = generate_heston(n=400, track="A1", seed=1)
    run = run_model("M6", path.price)
    assert run.ready.sum() > 50
    assert np.isfinite(run.p_hat[run.ready]).all()
