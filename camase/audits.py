"""Executable leakage audits A, B and C."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .wavelet import CausalAtrous, batch_causal_details, circular_modwt_details


@dataclass
class AuditResult:
    name: str
    passed: bool
    detail: str
    n_checked: int = 0


def audit_a(n: int = 256, seed: int = 7, J: int = 4) -> AuditResult:
    rng = np.random.default_rng(seed)
    y = rng.normal(size=n).cumsum() * 0.001
    D = batch_causal_details(y, J)
    n_checked = 0
    probes = list(range(40, n - 8, max(1, (n - 48) // 12)))
    for t in probes:
        y2 = y.copy()
        y2[t + 1 :] = 1.0e9
        D2 = batch_causal_details(y2, J)
        n_checked += J
        if not np.array_equal(D[:, t], D2[:, t]):
            diff = np.max(np.abs(D[:, t] - D2[:, t]))
            return AuditResult("A", False, f"mismatch at t={t}, max|Δ|={diff}", n_checked)
    return AuditResult("A", True, f"bitwise match at {len(probes)} probes × {J} levels", n_checked)


def audit_b(n: int = 220, seed: int = 11, J: int = 4) -> AuditResult:
    rng = np.random.default_rng(seed)
    y = rng.normal(size=n).cumsum() * 0.001
    stream = CausalAtrous(J=J, n_buffer=max(512, n + 8))
    n_checked = 0
    for t in range(n):
        d_stream = stream.step(y[t])
        fresh = CausalAtrous(J=J, n_buffer=max(512, t + 16))
        d_prefix = np.zeros(J)
        for s in range(t + 1):
            d_prefix = fresh.step(y[s])
        n_checked += J
        if not np.array_equal(d_stream, d_prefix):
            return AuditResult("B", False, f"mismatch at t={t}", n_checked)
    return AuditResult("B", True, f"streaming ≡ prefix on {n} samples", n_checked)


def audit_c_leaky_premium(n: int = 512, seed: int = 3, J: int = 4) -> AuditResult:
    rng = np.random.default_rng(seed)
    y = rng.normal(size=n).cumsum() * 0.001
    causal = batch_causal_details(y, J)
    leaky = circular_modwt_details(y, J)
    delta = np.abs(causal - leaky)
    edge = float(np.max(delta[:, [0, -1]]))
    passed = edge > 0.0
    return AuditResult(
        "C",
        passed,
        f"boundary max|Δ|={edge:.6g} (nonzero = look-ahead present in circular twin)",
        n,
    )


def run_all_audits() -> list[AuditResult]:
    return [audit_a(), audit_b(), audit_c_leaky_premium()]
