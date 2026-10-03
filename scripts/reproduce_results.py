#!/usr/bin/env python3
"""Regenerate results/*.json from the Python engine.

Full mode regenerates everything, including the 50-seed multi-generator
table (~20 minutes). Light mode (--light) regenerates the three fast tables
used by CI (track_a, ablation, diagnostics-core) plus gate ROC and
identification, and skips the multi-generator statistics.
"""

from __future__ import annotations

import argparse
import sys
from dataclasses import asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from camase.calibration import far_on_null, run_calibration  # noqa: E402
from camase.diagnostics import run_all_diagnostics  # noqa: E402
from camase.evaluation import run_ablation, run_track_a  # noqa: E402
from camase.gate_roc import run_gate_roc  # noqa: E402
from camase.heston import generate_heston  # noqa: E402
from camase.identification import run_identification_suite  # noqa: E402
from camase.jsonutil import dump  # noqa: E402
from camase.pareto import run_pareto  # noqa: E402
from camase.trackb import load_track_b  # noqa: E402
from camase.walkforward import run_walkforward  # noqa: E402


def track_b_payload() -> dict:
    data = ROOT / "data"
    symbols = []
    for sym in ("BTC", "ETH"):
        gz = data / f"trackb_{sym}USDT_1m.csv.gz"
        if gz.is_file():
            symbols.append((sym, str(gz)))
    if not symbols:
        csv = data / "btc_usdt_1m.csv"
        sample = data / "btc_sample.csv"
        symbols = [("BTC", str(csv if csv.is_file() else sample))]
    out = {"symbols": [], "note": "MSPE and calibration first; Sharpe last, never the headline."}
    for sym, path in symbols:
        bars = load_track_b(str(path))
        wf = run_walkforward(bars.close, bars.log_price, models=("M1", "M2", "M6", "M7", "M8"))
        out["symbols"].append(
            {
                "symbol": sym,
                "source": "data/" + Path(bars.source).name,
                "synthetic": bars.synthetic,
                "sha256": bars.sha256,
                "n": int(bars.close.size),
                "note": (
                    "Public Binance monthly-klines archive (data.binance.vision), no key."
                    if not bars.synthetic
                    else "CSV is a labelled synthetic BTC-like path, not a Binance dump."
                ),
                "walkforward": wf,
            }
        )
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--light", action="store_true", help="CI mode: skip the 50-seed table")
    args = ap.parse_args()
    out = ROOT / "results"

    ta = run_track_a(track="A2", n=1800, models=("M1", "M2", "M6", "M7", "M8", "M9"), seed=42)
    dump(ta, out / "track_a.json")
    ab = run_ablation(n=1600, track="A2", models=("M0", "M1", "M2", "M5", "M6", "M7", "M8", "M9"))
    dump([asdict(s) for s in ab], out / "ablation.json")
    path = generate_heston(n=2800, track="A2", seed=42)
    wf = run_walkforward(path.price, path.log_obs, models=("M1", "M6", "M7", "M8"))
    dump(wf, out / "walkforward.json")
    dump(run_pareto(n=1600, track="A2"), out / "pareto.json")
    dump(run_calibration(n=1600, seed=42), out / "calibration.json")
    dump(far_on_null(n=2500, seed=3), out / "far_a1.json")
    dump(run_all_diagnostics(), out / "diagnostics.json")
    dump(run_gate_roc(), out / "gate_roc.json")
    ident = run_identification_suite(gens=("A", "B", "C"), n=2600, seeds=(42,), plot_dir=out / "plots")
    plots = ident.pop("plots")
    dump(ident, out / "identification.json")
    if not args.light:
        from camase.multigen import run_multi_gen

        run_multi_gen(out_dir=out)
        dump(track_b_payload(), out / "track_b.json")
    else:
        print("light mode: keeping committed results/multigen.json and results/track_b.json")

    pub = ROOT / "src" / "lib" / "camase" / "published"
    if pub.is_dir():
        for p in out.glob("*.json"):
            (pub / p.name).write_text(p.read_text())
    print("wrote", out, "| identification plots:", plots)


if __name__ == "__main__":
    main()
