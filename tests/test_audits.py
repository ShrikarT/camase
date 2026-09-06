from camase.audits import audit_a, audit_b, audit_c_leaky_premium
from camase.config import DEFAULT_CONFIG


def test_support_lengths():
    assert DEFAULT_CONFIG.support == [8, 22, 50, 106]
    assert DEFAULT_CONFIG.warmup == 169


def test_audit_a_passes():
    r = audit_a(n=180)
    assert r.passed, r.detail


def test_audit_b_passes():
    r = audit_b(n=120)
    assert r.passed, r.detail


def test_audit_c_detects_leakage():
    r = audit_c_leaky_premium(n=256)
    assert r.passed, r.detail
