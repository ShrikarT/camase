import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Panel, Shell } from "@/components/camase/shell";
import { TrackKind } from "@/lib/camase/heston";
import { runLadder } from "@/lib/camase/runner";

export const Route = createFileRoute("/ablation")({ component: AblationPage });

function AblationPage() {
  const [track, setTrack] = useState<TrackKind>("A2");
  const [tick, setTick] = useState(0);
  const rows = useMemo(() => {
    void tick;
    return runLadder(640, track, 42 + tick);
  }, [track, tick]);

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-fg-subtle uppercase">
            Objective 4
          </p>
          <h2 className="font-display text-3xl tracking-tight">Ablation ladder</h2>
          <p className="mt-2 max-w-2xl text-sm text-fg-muted">
            M6 must beat M2, not merely M1. M8 (IMM) and M9 (UKF) are covariance
            baselines, not wavelet models. Leaky twins (M5′) price look-ahead.
          </p>
        </div>
        <div className="flex gap-2">
          {(["A1", "A2", "A3"] as TrackKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTrack(k)}
              className={`h-11 rounded-[10px] px-3 text-sm ${
                track === k ? "bg-accent text-accent-fg" : "border border-line text-fg-muted"
              }`}
            >
              {k}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTick((x) => x + 1)}
            className="h-11 rounded-[10px] bg-accent px-4 text-sm text-accent-fg"
          >
            Rerun
          </button>
        </div>
      </div>

      <Panel title={`Scores · ${track} · 1000 bars`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="font-mono text-[11px] tracking-wider text-fg-subtle uppercase">
              <tr className="border-b border-line">
                <th className="py-2 pr-3">Model</th>
                <th className="py-2 pr-3">RMSE p̂</th>
                <th className="py-2 pr-3">SNR dB</th>
                <th className="py-2 pr-3">Mean NIS</th>
                <th className="py-2 pr-3">MSPE</th>
                <th className="py-2">TiM</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {rows.map((r) => (
                <tr key={r.model} className="border-b border-line/80">
                  <td className="py-2.5 pr-3 text-fg">{r.model}</td>
                  <td className="py-2.5 pr-3">{fmt(r.rmseP)}</td>
                  <td className="py-2.5 pr-3">{Number.isFinite(r.snrDb) ? r.snrDb.toFixed(2) : "—"}</td>
                  <td className="py-2.5 pr-3">{Number.isFinite(r.meanNis) ? r.meanNis.toFixed(2) : "—"}</td>
                  <td className="py-2.5 pr-3">{fmt(r.mspe)}</td>
                  <td className="py-2.5">{(r.timeInMarket * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel title="What each rung isolates">
          <ul className="space-y-2 text-sm text-fg-muted">
            <li><span className="text-fg">M0</span> — MA crossover, naive benchmark.</li>
            <li><span className="text-fg">M1</span> — static Kalman, constant R, Q.</li>
            <li><span className="text-fg">M2</span> — rolling-σ adaptive R. Decisive cheap control.</li>
            <li><span className="text-fg">M5</span> — causal single-scale adaptive R (v1 made honest).</li>
            <li><span className="text-fg">M6</span> — two-sided multiscale (proposed).</li>
            <li><span className="text-fg">M7</span> — M6 + shadow gate.</li>
            <li><span className="text-fg">M5′</span> — circular leaky twin; premium = look-ahead.</li>
          </ul>
        </Panel>
        <Panel title="Falsification (pre-registered)">
          <p className="text-sm leading-relaxed text-fg-muted">
            If M6 does not beat M2 on Track A RMSE / SNR with a visible margin, C2 is
            refuted and the wavelet front end is decorative. If M7 drawdown improvement
            is only lower time-in-market, C3 is refuted. Both outcomes are reportable.
          </p>
        </Panel>
      </div>
    </Shell>
  );
}

function fmt(x: number) {
  if (!Number.isFinite(x)) return "—";
  return x.toExponential(2);
}
