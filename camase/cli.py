"""Command-line entry: audits, Track A, ablation, walk-forward, Track B."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .audits import run_all_audits
from .evaluation import run_ablation, run_track_a
from .jsonutil import dump, sanitize


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="camase")
    p.add_argument("--audits", action="store_true")
    p.add_argument("--track", default="A2")
    p.add_argument("--models", default="M1,M2,M6,M7,M8,M9")
    p.add_argument("--n", type=int, default=2000)
    p.add_argument("--ablation", action="store_true")
    p.add_argument("--walkforward", action="store_true")
    p.add_argument("--track-b", action="store_true")
    p.add_argument("--pareto", action="store_true")
    p.add_argument("--csv", default="")
    p.add_argument("--fetch-btc", action="store_true")
    p.add_argument("--pages", type=int, default=3)
    p.add_argument("--out", default="")
    args = p.parse_args(argv)

    if args.fetch_btc:
        from .fetch_btc import fetch_klines, write_klines_csv

        dest = Path(args.csv or "data/btc_usdt_1m.csv")
        try:
            rows = fetch_klines(pages=args.pages)
        except RuntimeError as exc:
            print(f"fetch failed: {exc}", file=sys.stderr)
            return 2
        write_klines_csv(rows, dest)
        print(json.dumps({"wrote": str(dest), "n": len(rows), "sha256": dest.with_suffix(dest.suffix + '.sha256').read_text().split()[0]}))
        return 0

    if args.audits:
        for r in run_all_audits():
            flag = "PASS" if r.passed else "FAIL"
            print(f"Audit {r.name}: {flag} — {r.detail}")
            if not r.passed:
                return 1
        return 0

    if args.walkforward:
        from .heston import generate_heston
        from .walkforward import run_walkforward

        path = generate_heston(n=args.n, track=args.track)  # type: ignore[arg-type]
        models = [m.strip() for m in args.models.split(",") if m.strip()]
        out = run_walkforward(path.price, path.log_obs, models=models)
        text = json.dumps(sanitize(out), indent=2)
        print(text)
        if args.out:
            dump(out, args.out)
        return 0

    if args.track_b:
        from .trackb import load_track_b
        from .walkforward import run_walkforward

        bars = load_track_b(csv_path=args.csv or None, n=args.n)
        models = [m.strip() for m in args.models.split(",") if m.strip()]
        out = {
            "source": bars.source,
            "synthetic": bars.synthetic,
            "sha256": bars.sha256,
            "n": int(bars.close.size),
            "walkforward": run_walkforward(bars.close, bars.log_price, models=models),
        }
        print(json.dumps(sanitize(out), indent=2))
        if args.out:
            dump(out, args.out)
        return 0

    if args.pareto:
        from .pareto import run_pareto

        pts = run_pareto(n=args.n, track=args.track)
        print(json.dumps(sanitize(pts), indent=2))
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
    print(json.dumps(sanitize(out), indent=2))
    if args.out:
        dump(out, args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
