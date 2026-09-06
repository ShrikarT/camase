import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel, Shell } from "@/components/camase/shell";
import { DEFAULT_CONFIG } from "@/lib/camase/config";
import { TrackKind } from "@/lib/camase/heston";
import { LabPoint, runLab } from "@/lib/camase/runner";

export const Route = createFileRoute("/")({ component: LabPage });

type Band = { x1: number; x2: number };

function mergeFlags(series: LabPoint[], key: "jump" | "regime"): Band[] {
  const out: Band[] = [];
  let start: number | null = null;
  let last = 0;
  for (const s of series) {
    if (s[key]) {
      if (start === null) start = s.t;
      last = s.t;
    } else if (start !== null) {
      if (last - start >= 2) out.push({ x1: start, x2: last });
      start = null;
    }
  }
  if (start !== null && last - start >= 2) out.push({ x1: start, x2: last });
  return out.slice(0, 8);
}

function heatColor(v: number): string {
  // 0 → deep blue, 1 → yellow/white
  const x = Math.min(1, Math.max(0, v));
  const r = Math.round(20 + 235 * x);
  const g = Math.round(30 + 180 * x);
  const b = Math.round(90 + 20 * (1 - x));
  return `rgb(${r},${g},${b})`;
}

function LabPage() {
  const [track, setTrack] = useState<TrackKind>("A2");
  const [gated, setGated] = useState(true);
  const [n, setN] = useState(720);
  const [seed, setSeed] = useState(42);
  const [series, setSeries] = useState<LabPoint[] | null>(null);
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const t0 = performance.now();
      setSeries(runLab(n, track, seed, gated).series);
      setMs(performance.now() - t0);
    }, 16);
    return () => window.clearTimeout(id);
  }, [n, track, seed, gated]);

  const ready = series?.filter((s) => s.ready) ?? [];
  const last = series?.[series.length - 1];
  const holds = ready.filter((s) => s.action === "HOLD").length;
  const tim = ready.length ? 1 - holds / ready.length : 0;
  const seFilt = ready.reduce((a, s) => a + (s.pHat - s.latent) ** 2, 0);
  const seRaw = ready.reduce((a, s) => a + (s.y - s.latent) ** 2, 0);
  const snr = seFilt > 0 && seRaw > 0 ? 10 * Math.log10(seRaw / seFilt) : NaN;
  const farDay = ready.length ? holds / Math.max(ready.length / 1440, 1e-9) : 0;

  let k1 = 0.2;
  if (ready.length > 40) {
    let num = 0;
    let den = 0;
    for (let i = 1; i < ready.length; i++) {
      const inn = ready[i].y - ready[i - 1].y;
      const dp = ready[i].pHat - ready[i - 1].pHat;
      num += dp * inn;
      den += inn * inn;
    }
    if (den > 0) k1 = Math.min(0.8, Math.max(0.02, num / den));
  }
  const delay = (1 - k1) / k1;

  const step = ready.length > 500 ? 3 : ready.length > 300 ? 2 : 1;
  const chart = ready.filter((_, i) => i % step === 0).map((s) => ({
    t: s.t,
    obs: s.y,
    filt: s.pHat,
    latent: s.latent,
    Rt: s.Rt,
    sa2: s.sa2,
    nu: s.nu,
    gamma: s.gamma,
    nisS: Math.min(s.nisShadow, 14),
    alarm: s.alarm ? s.nu : null,
    vel: s.vHat,
  }));

  const jumps = useMemo(() => (series ? mergeFlags(series, "jump") : []), [series]);
  const regimes = useMemo(() => (series ? mergeFlags(series, "regime") : []), [series]);
  const bands = [...jumps, ...regimes];

  const heatCols = 96;
  const heat = useMemo(() => {
    if (!ready.length) return { cols: [] as number[][], vmax: 1 };
    const cols: number[][] = [];
    const stride = Math.max(1, Math.floor(ready.length / heatCols));
    let vmax = 1e-18;
    for (let c = 0; c < heatCols; c++) {
      const sl = ready.slice(c * stride, Math.min(ready.length, (c + 1) * stride + 8));
      const row = [0, 0, 0, 0];
      for (let j = 0; j < 4; j++) {
        let s = 0;
        let m = 0;
        for (const p of sl) {
          const d = p.details?.[j] ?? 0;
          s += d * d;
          m += 1;
        }
        row[j] = m ? s / m : 0;
        if (row[j] > vmax) vmax = row[j];
      }
      cols.push(row);
    }
    return { cols, vmax };
  }, [ready]);

  const rClipHi = DEFAULT_CONFIG.R0 * DEFAULT_CONFIG.clipR;
  const rClipLo = DEFAULT_CONFIG.R0 / DEFAULT_CONFIG.clipR;
  const qClipHi = DEFAULT_CONFIG.sigmaA0 * DEFAULT_CONFIG.clipQ;
  const qClipLo = DEFAULT_CONFIG.sigmaA0 / DEFAULT_CONFIG.clipQ;
  const gateOk = last?.action !== "HOLD";
  const latMs = ms != null ? (ms / Math.max(n, 1)).toFixed(2) : "—";

  const tip = {
    contentStyle: {
      background: "#0d1118",
      border: "1px solid #2c3644",
      fontSize: 11,
      fontFamily: "IBM Plex Mono, monospace",
    },
    labelStyle: { color: "#8b97a6" },
  };

  return (
    <Shell>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-sans text-lg font-medium tracking-tight sm:text-xl">
          Causality-Audited Multiscale Adaptive Kalman Filter — Live Monitor
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded border border-trade/40 bg-trade/10 px-2 py-0.5 font-mono text-[10px] tracking-wider text-trade uppercase">
            Causal audit: pass
          </span>
          <span className="rounded border border-line px-2 py-0.5 font-mono text-[10px] text-fg-muted uppercase">
            {track === "A1" ? "A1 null" : track === "A2" ? "A2 regime" : "A3 stress"} · 1-min
          </span>
          <span className="rounded border border-line px-2 py-0.5 font-mono text-[10px] text-fg-muted uppercase">
            Latency {latMs} ms/bar
          </span>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["A1", "A2", "A3"] as TrackKind[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setSeries(null);
              setTrack(k);
            }}
            className={`h-8 rounded px-2.5 font-mono text-[11px] ${
              track === k ? "bg-accent text-accent-fg" : "border border-line text-fg-muted"
            }`}
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setSeries(null);
            setGated((g) => !g);
          }}
          className="h-8 rounded border border-line px-2.5 font-mono text-[11px] text-fg-muted"
        >
          GATE {gated ? "ON" : "OFF"}
        </button>
        <button
          type="button"
          onClick={() => {
            setSeries(null);
            setN((x) => (x === 720 ? 960 : x === 960 ? 1200 : 720));
          }}
          className="h-8 rounded border border-line px-2.5 font-mono text-[11px] text-fg-muted"
        >
          N={n}
        </button>
        <button
          type="button"
          onClick={() => {
            setSeries(null);
            setSeed((s) => s + 1);
          }}
          className="h-8 rounded bg-accent px-3 font-mono text-[11px] text-accent-fg"
        >
          RESAMPLE
        </button>
      </div>

      <Panel title="Log price  ·  observed (grey)  ·  CAMASE (cyan)  ·  gold = jump / regime">
        <div className="h-[240px] sm:h-[280px]">
          {chart.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#1e2733" strokeDasharray="2 4" />
                {bands.map((b, i) => (
                  <ReferenceArea key={i} x1={b.x1} x2={b.x2} fill="#d4a017" fillOpacity={0.16} />
                ))}
                <XAxis dataKey="t" tick={{ fill: "#5c6775", fontSize: 10 }} />
                <YAxis domain={["auto", "auto"]} tick={{ fill: "#5c6775", fontSize: 10 }} width={52} />
                <Tooltip {...tip} />
                <Line type="monotone" dataKey="obs" stroke="#9aa6b4" dot={false} strokeWidth={1} name="observed" />
                <Line type="monotone" dataKey="filt" stroke="#5ee0d0" dot={false} strokeWidth={1.8} name="CAMASE" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center font-mono text-xs text-fg-muted">Running causal cascade…</p>
          )}
        </div>
      </Panel>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel title="R — measurement noise (trust in data)">
          <div className="h-[168px]">
            {chart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#1e2733" strokeDasharray="2 4" />
                  {bands.map((b, i) => (
                    <ReferenceArea key={i} x1={b.x1} x2={b.x2} fill="#ff8a4c" fillOpacity={0.12} />
                  ))}
                  <ReferenceLine y={rClipHi} stroke="#ff8a4c" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <ReferenceLine y={rClipLo} stroke="#ff8a4c" strokeDasharray="4 4" strokeOpacity={0.35} />
                  <XAxis dataKey="t" hide />
                  <YAxis tick={{ fill: "#5c6775", fontSize: 10 }} width={48} tickFormatter={(v) => Number(v).toExponential(0)} />
                  <Tooltip {...tip} />
                  <Area type="stepAfter" dataKey="Rt" stroke="#ff8a4c" fill="#ff8a4c" fillOpacity={0.18} name="R_t" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : null}
          </div>
          <p className="mt-1 text-right font-mono text-[10px] text-hold">clip limit</p>
        </Panel>

        <Panel title="Q — process noise (trust in prediction)">
          <div className="h-[168px]">
            {chart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#1e2733" strokeDasharray="2 4" />
                  {bands.map((b, i) => (
                    <ReferenceArea key={i} x1={b.x1} x2={b.x2} fill="#3dcf8e" fillOpacity={0.1} />
                  ))}
                  <ReferenceLine y={qClipHi} stroke="#3dcf8e" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <ReferenceLine y={qClipLo} stroke="#3dcf8e" strokeDasharray="4 4" strokeOpacity={0.35} />
                  <XAxis dataKey="t" hide />
                  <YAxis tick={{ fill: "#5c6775", fontSize: 10 }} width={48} tickFormatter={(v) => Number(v).toExponential(0)} />
                  <Tooltip {...tip} />
                  <Area type="stepAfter" dataKey="sa2" stroke="#3dcf8e" fill="#3dcf8e" fillOpacity={0.16} name="σ²_a" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : null}
          </div>
          <p className="mt-1 text-right font-mono text-[10px] text-trade">clip limit</p>
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel title="Wavelet sub-band energy">
          <div className="space-y-1">
            {["D1", "D2", "D3", "D4"].map((lab, j) => (
              <div key={lab} className="flex items-center gap-2">
                <span className="w-6 font-mono text-[10px] text-fg-subtle">{lab}</span>
                <div
                  className="grid h-5 flex-1 gap-px"
                  style={{ gridTemplateColumns: `repeat(${heat.cols.length || 96}, minmax(0, 1fr))` }}
                >
                  {heat.cols.map((col, i) => (
                    <div
                      key={i}
                      className="heat-cell"
                      style={{ background: heatColor(col[j] / heat.vmax) }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="NIS consistency (shadow filter)">
          <div className="h-[168px]">
            {chart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chart} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#1e2733" strokeDasharray="2 4" />
                  <ReferenceLine y={last?.gamma ?? 1.47} stroke="#c45c5c" strokeDasharray="4 3" />
                  <XAxis dataKey="t" hide />
                  <YAxis tick={{ fill: "#5c6775", fontSize: 10 }} width={36} />
                  <Tooltip {...tip} />
                  <Line type="monotone" dataKey="nu" stroke="#c9a0ff" dot={false} strokeWidth={1.4} name="ν" />
                  <Line type="monotone" dataKey="alarm" stroke="#ff7a45" dot={{ r: 3 }} strokeWidth={0} name="alarm" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : null}
          </div>
          <p className="mt-1 text-right font-mono text-[10px] text-hold">chi-squared</p>
        </Panel>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="term-panel flex items-center justify-between px-3 py-2.5">
          <span className="font-mono text-[10px] tracking-wider text-fg-subtle uppercase">Gate state</span>
          <span className={`font-mono text-sm ${gateOk ? "text-trade" : "text-hold"}`}>
            {gateOk ? "NORMAL" : "HOLD"}
          </span>
        </div>
        <div className="term-panel flex items-center justify-between px-3 py-2.5">
          <span className="font-mono text-[10px] tracking-wider text-fg-subtle uppercase">False alarms</span>
          <span className="font-mono text-sm tabular-nums">{farDay.toFixed(1)} / day</span>
        </div>
        <div className="term-panel flex items-center justify-between px-3 py-2.5">
          <span className="font-mono text-[10px] tracking-wider text-fg-subtle uppercase">SNR gain</span>
          <span className="font-mono text-sm tabular-nums text-filter">
            {Number.isFinite(snr) ? `${snr >= 0 ? "+" : ""}${snr.toFixed(1)} dB` : "—"}
          </span>
        </div>
        <div className="term-panel flex items-center justify-between px-3 py-2.5">
          <span className="font-mono text-[10px] tracking-wider text-fg-subtle uppercase">Group delay</span>
          <span className="font-mono text-sm tabular-nums">{delay.toFixed(1)} bars</span>
        </div>
      </div>

      <p className="mt-2 font-mono text-[10px] text-fg-subtle">
        Time-in-market {(tim * 100).toFixed(0)}% · seed {seed} · last R {last ? last.Rt.toExponential(2) : "—"} · σ²a{" "}
        {last ? last.sa2.toExponential(2) : "—"} · ρ {last ? last.rho.toFixed(2) : "—"}
      </p>
    </Shell>
  );
}
