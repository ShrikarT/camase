import numpy as np

from camase.generators import generate
from camase.models import run_model


def _path():
    return generate("A", n=700, seed=9)


def test_m10_m11_run_and_ready_masks():
    p = _path()
    for name in ("M10", "M11"):
        r = run_model(name, p.price)
        assert r.name == name
        assert r.ready.sum() > 100
        m = r.ready & np.isfinite(r.p_hat)
        assert m.sum() > 100
        assert np.all(np.isfinite(r.p_hat[m]))


def test_baselines_are_causal():
    """Smashing the future must not change estimates at earlier bars."""
    p = _path()
    for name in ("M10", "M11", "M2", "M6"):
        r1 = run_model(name, p.price)
        p2 = p.price.copy()
        p2[600:] = p2[600] * 1.05
        r2 = run_model(name, p2)
        m = r1.ready & r2.ready
        m[595:] = False
        a = r1.p_hat[m]
        b = r2.p_hat[m]
        assert np.allclose(a, b, rtol=1e-9, atol=1e-12), f"{name} leaks future into past"


def test_m11_thresholding_is_active():
    """The universal threshold must actually zero some detail coefficients."""
    import numpy as np

    from camase.config import DEFAULT_CONFIG
    from camase.wavelet import batch_causal_details

    p = _path()
    y = np.log(p.price)
    D = batch_causal_details(y, DEFAULT_CONFIG.J)
    k = DEFAULT_CONFIG.k_var
    thr_const = np.sqrt(2.0 * np.log(k))
    zeroed = 0
    total = 0
    for t in range(DEFAULT_CONFIG.warmup, 700):
        win = D[0, t - k + 1 : t + 1]
        thr = float(np.median(np.abs(win)) / 0.6745) * thr_const
        for j in range(DEFAULT_CONFIG.J):
            d = float(D[j, t])
            total += 1
            if abs(d) <= thr:
                zeroed += 1
    frac = zeroed / total
    assert 0.0 < frac < 1.0, f"thresholding should be partial, zeroed frac={frac:.3f}"
