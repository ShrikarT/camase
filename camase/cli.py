"""Command-line entry: audits, Track A, ablation."""

from __future__ import annotations

import argparse
import json
import sys

from .audits import run_all_audits
from .evaluation import run_ablation, run_track_a


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="camase")
    p.add_argument("--audits", action="store_true")
    p.add_argument("--track", default="A2")
    p.add_argument("--models", default="M1,M2,M6,M7")
    p.add_argument("--n", type=int, default=2000)
    p.add_argument("--ablation", action="store_true")
    args = p.parse_args(argv)

    if args.audits:
        for r in run_all_audits():
            flag = "PASS" if r.passed else "FAIL"
            print(f"Audit {r.name}: {flag} — {r.detail}")
            if not r.passed:
                return 1
        return 0

    if args.ablation:
        scores = run_ablation(n=args.n, track=args.track)
        print(f"{'model':<6} {'RMSE_p':>12} {'SNR_dB':>8} {'NIS':>8} {'MSPE':>12} {'TiM':>6}")
        for s in scores:
            print(
                f"{s.model:<6} {s.rmse_p:12.6g} {s.snr_db:8.3f} {s.mean_nis:8.3f} "
                f"{s.mspe:12.6g} {s.time_in_market:6.2f}"
            )
        return 0

    models = [m.strip() for m in args.models.split(",") if m.strip()]
    out = run_track_a(track=args.track, n=args.n, models=models)
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
