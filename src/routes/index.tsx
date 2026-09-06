import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel, Shell, Stat } from "@/components/camase/shell";
import { DEFAULT_CONFIG, warmup } from "@/lib/camase/config";
import { TrackKind } from "@/lib/camase/heston";
import { LabPoint, runLab } from "@/lib/camase/runner";

export const Route = createFileRoute("/")({ component: LabPage });

function fmt(x: number, d = 4) {
  if (!Number.isFinite(x)) return "—";
  return x.toExponential(d);
}

function LabPage() {
  const [track, setTrack] = useState<TrackKind>("A2");
  const [gated, setGated] = useState(true);
  const [n, setN] = useState(640);
  const [seed, setSeed] = useState(42);
  const [series, setSeries] = useState<LabPoint[] | null>(null);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSeries(runLab(n, track, seed, gated).series);
    }, 20);
    return () => window.clearTimeout(id);
  }, [n, track, seed, gated]);

  const ready = series?.filter((s) => s.ready) ?? [];
  const last = series?.[series.length - 1];
  const holds = ready.filter((s) => s.action === "HOLD").length;
  const tim = ready.length ? 1 - holds / ready.length : 0;
  const seFilt = ready.reduce((a, s) => a + (s.pHat - s.latent) ** 2, 0);
  const seRaw = ready.reduce((a, s) => a + (s.y - s.latent) ** 2, 0);
  const snr = seFilt > 0 && seRaw > 0 ? 10 * Math.log10(seRaw / seFilt) : NaN;
  const meanNis = ready.length
    ? ready.reduce((a, s) => a + s.nisShadow, 0) / ready.length
    : NaN;

  const chart = ready.filter((_, i) => i % 3 === 0).map((s) => ({
    t: s.t,
    obs: s.y,
    filt: s.pHat,
    latent: s.latent,
    Rt: s.Rt * 1e8,
    sa2: s.sa2 * 1e8,
    nu: s.nu,
    gamma: s.gamma,
    nisS: Math.min(s.nisShadow, 12),
  }));

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-fg-subtle uppercase">
            Track A · Heston with jumps
          </p>
          <h2 className="font-display text-3xl tracking-tight">Filter console</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["A1", "A2", "A3"] as TrackKind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setSeries(null);
                setTrack(k);
              }}
              className={`h-11 rounded-[10px] px-3 text-sm ${
                track === k ? "bg-accent text-accent-fg" : "border border-line text-fg-muted"
              }`}
            >
              {k === "A1" ? "A1 null" : k === "A2" ? "A2 regime" : "A3 stress"}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setSeries(null);
              setGated((g) => !g);
            }}
            className="h-11 rounded-[10px] border border-line px-3 text-sm text-fg-muted"
          >
            Gate {gated ? "on" : "off"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSeries(null);
              setSeed((s) => s + 1);
            }}
            className="h-11 rounded-[10px] bg-accent px-4 text-sm text-accent-fg"
          >
            Resample
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="SNR gain" value={Number.isFinite(snr) ? `${snr.toFixed(2)} dB` : "…"} hint="vs observation" />
        <Stat
          label="Gate"
          value={last?.action ?? "…"}
          tone={last?.action === "HOLD" ? "hold" : "trade"}
          hint={`${(tim * 100).toFixed(0)}% time-in-market`}
        />
        <Stat label="Mean shadow NIS" value={Number.isFinite(meanNis) ? meanNis.toFixed(2) : "…"} hint="null ≈ 1" />
        <Stat label="Warm-up" value={`${warmup()} bars`} hint={`N=${DEFAULT_CONFIG.nBuffer} J=4 k=64`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Log-price" className="lg:col-span-2">
          <div className="h-64 sm:h-72">
            {chart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#2a2d33" strokeDasharray="3 3" />
                  <XAxis dataKey="t" hide />
                  <YAxis domain={["auto", "auto"]} tick={{ fill: "#9a9d96", fontSize: 11 }} width={48} />
                  <Tooltip
                    contentStyle={{ background: "#13151a", border: "1px solid #2a2d33", fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="obs" stroke="#c5c1b4" dot={false} strokeWidth={1} name="observed" />
                  <Line type="monotone" dataKey="latent" stroke="#7f93a8" dot={false} strokeWidth={1.2} name="latent" />
                  <Line type="monotone" dataKey="filt" stroke="#d8c48a" dot={false} strokeWidth={1.6} name="CAMASE" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center text-sm text-fg-muted">Running causal cascade…</p>
            )}
          </div>
          <p className="mt-2 text-xs text-fg-subtle">
            Observed · latent · filter. Warm-up discarded. Length {n} · seed {seed}.
          </p>
        </Panel>

        <Panel title="Last sample">
          <dl className="space-y-2 font-mono text-sm tabular-nums">
            <Row k="y / p̂" v={`${last ? last.y.toFixed(5) : "—"} / ${last ? last.pHat.toFixed(5) : "—"}`} />
            <Row k="R_t" v={last ? fmt(last.Rt) : "—"} />
            <Row k="σ²_a,t" v={last ? fmt(last.sa2) : "—"} />
            <Row k="ρ roughness" v={last ? last.rho.toFixed(3) : "—"} />
            <Row k="ν / γ" v={last ? `${last.nu.toFixed(2)} / ${last.gamma.toFixed(2)}` : "—"} />
            <Row k="CUSUM g" v={last ? last.cusum.toFixed(2) : "—"} />
          </dl>
          <button
            type="button"
            className="mt-4 h-11 w-full rounded-[10px] border border-line text-sm text-fg-muted"
            onClick={() => {
              setSeries(null);
              setN((x) => (x === 640 ? 900 : x === 900 ? 1200 : 640));
            }}
          >
            N = {n}
          </button>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Adapted covariances × 1e8">
          <div className="h-52">
            {chart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart}>
                  <CartesianGrid stroke="#2a2d33" strokeDasharray="3 3" />
                  <XAxis dataKey="t" hide />
                  <YAxis tick={{ fill: "#9a9d96", fontSize: 11 }} width={36} />
                  <Tooltip contentStyle={{ background: "#13151a", border: "1px solid #2a2d33" }} />
                  <Line type="monotone" dataKey="Rt" stroke="#c17a62" dot={false} name="R_t" />
                  <Line type="monotone" dataKey="sa2" stroke="#8fa58a" dot={false} name="σ²_a" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-fg-muted">Waiting for run…</p>
            )}
          </div>
        </Panel>
        <Panel title="Shadow NIS window vs χ² band">
          <div className="h-52">
            {chart.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart}>
                  <CartesianGrid stroke="#2a2d33" strokeDasharray="3 3" />
                  <XAxis dataKey="t" hide />
                  <YAxis tick={{ fill: "#9a9d96", fontSize: 11 }} width={36} />
                  <Tooltip contentStyle={{ background: "#13151a", border: "1px solid #2a2d33" }} />
                  <Line type="monotone" dataKey="nu" stroke="#d8c48a" dot={false} name="ν" />
                  <Line type="monotone" dataKey="gamma" stroke="#c17a62" dot={false} name="γ" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="nisS" stroke="#7f93a8" dot={false} name="NIS shadow" strokeWidth={0.8} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-fg-muted">Waiting for run…</p>
            )}
          </div>
        </Panel>
      </div>
    </Shell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-line py-1.5">
      <dt className="text-fg-subtle">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}
