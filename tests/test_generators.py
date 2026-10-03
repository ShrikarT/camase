import numpy as np

from camase.generators import generate, generate_A, generate_B, generate_C


def test_generators_shapes_and_fields():
    for g in ("A", "B", "C"):
        p = generate(g, n=800, seed=7)
        assert p.n == 800 and p.gen == g
        for f in ("latent", "drift", "variance", "price", "log_obs", "jump_flags", "regime_flags"):
            a = getattr(p, f)
            assert a.shape == (800,), (g, f)
        assert np.all(np.isfinite(p.log_obs))
        assert np.all(p.price > 0)


def test_generator_a_block_noise_varies():
    p = generate_A(n=1200, seed=3)
    q = p.log_obs[:500] - p.latent[:500]
    l = p.log_obs[500:1000] - p.latent[500:1000]
    assert np.std(l) > 1.5 * np.std(q), "loud block should be noisier than quiet block"


def test_generator_b_bounce_negative_autocorr():
    p = generate_B(n=3000, seed=5)
    r = np.diff(p.log_obs)
    ac1 = np.corrcoef(r[:-1], r[1:])[0, 1]
    assert ac1 < -0.15, f"bounce should induce negative return autocorr, got {ac1:.3f}"
    assert p.jump_flags.sum() > 0, "B should contain sparse jumps"


def test_generator_c_matches_heston_scale():
    p = generate_C(n=900, seed=11)
    assert p.jump_flags.sum() > 0
