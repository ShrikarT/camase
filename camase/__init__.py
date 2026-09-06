"""CAMASE — Causality-Audited Multiscale Adaptive State Estimation."""

from .config import CamaseConfig, DEFAULT_CONFIG
from .pipeline import CamaseEngine, EngineOutput
from .heston import generate_heston
from .audits import audit_a, audit_b, audit_c_leaky_premium
from .evaluation import run_track_a, run_ablation

__all__ = [
    "CamaseConfig",
    "DEFAULT_CONFIG",
    "CamaseEngine",
    "EngineOutput",
    "generate_heston",
    "audit_a",
    "audit_b",
    "audit_c_leaky_premium",
    "run_track_a",
    "run_ablation",
]

__version__ = "0.2.1"
