#!/usr/bin/env python3
"""Regenerate results/*.json from the Python engine."""

from __future__ import annotations

import sys
from dataclasses import asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from camase.evaluation import run_ablation, run_track_a  # noqa: E402
from camase.heston import generate_heston  # noqa: E402
from camase.jsonutil import dump  # noqa: E402
from camase.pareto import run_pareto  # noqa: E402
from camase.trackb import load_track_b  # noqa: E402
from camase.walkforward import run_walkforward  # noqa: E402
from camase.diagnostics import run_all_diagnostics  # noqa: E402


def main() -> None:
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
    csv = ROOT / "data" / "btc_usdt_1m.csv"
    sample = ROOT / "data" / "btc_sample.csv"
    bars = load_track_b(str(csv if csv.is_file() else sample))
    tb = run_walkforward(bars.close, bars.log_price, models=("M1", "M6", "M7"))
    dump(
        {
            "source": "data/" + Path(bars.source).name,
            "synthetic": bars.synthetic,
            "sha256": bars.sha256,
            "n": int(bars.close.size),
            "note": (
                "Real Binance dump."
                if not bars.synthetic
                else "CSV is a labelled synthetic BTC-like path, not a Binance dump."
            ),
            "walkforward": tb,
        },
        out / "track_b.json",
    )
    pub = ROOT / "src" / "lib" / "camase" / "published"
    if pub.is_dir():
        for p in out.glob("*.json"):
            (pub / p.name).write_text(p.read_text())
    print("wrote", out)


if __name__ == "__main__":
    main()
