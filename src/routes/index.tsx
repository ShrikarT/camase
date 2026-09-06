import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Shell } from "@/components/camase/shell";
import { Box, Gauge, Hist, Kv, Ladder, Leds, Spark } from "@/components/camase/widgets";
import { DEFAULT_CONFIG } from "@/lib/camase/config";
import { TrackKind } from "@/lib/camase/heston";
import { LabPoint, runLab } from "@/lib/camase/runner";

export const Route = createFileRoute("/")({ component: Monitor });

type Band = { x1: number; x2: number };

function clusters(series: LabPoint[], pred: (s: LabPoint) => boolean): Band[] {
  const out: Band[] = [];
  let a: number | null = null;
  let last = 0;
  for (const s of series) {
    if (pred(s)) {
      if (a === null) a = s.t;
      last = s.t;
    } else if (a !== null) {
      if (last - a >= 1) out.push({ x1: a, x2: Math.max(last, a + 1) });
      a = null;
    }
  }
  if (a !== null) out.push({ x1: a, x2: last });
  return out.slice(0, 10);
}

function heatColor(v: number) {
  const x = Math.min(1, Math.max(0, v));
  return `rgb(${Math.round(20 + 235 * x)},${Math.round(40 + 140 * x)},${Math.round(0)})`;
}

function Monitor() {
  const [track, setTrack] = useState<TrackKind>("A2");
  const [gated, setGated] = useState(true);
  const [n, setN] = useState(760);
  const [seed, setSeed] = useState(42);
  const [series, setSeries] = useState<LabPoint[] | null>(null);
  const [ms, setMs] = useState<number | null>(null);
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => setClock(new Date().toISOString().slice(11, 19) + "Z");
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const t0 = performance.now();
      setSeries(runLab(n, track, seed, gated).series);
      setMs(performance.now() - t0);
    }, 10);
    return () => window.clearTimeout(id);
  }, [n, track, seed, gated]);

  const ready = series?.filter((s) => s.ready) ?? [];
  const last = series?.[series.length - 1];
  const prev = series && series.length > 2 ? series[series.length - 2] : last;
  const holds = ready.filter((s) => s.action === "HOLD").length;
  const tim = ready.length ? 1 - holds / ready.length : 0;
  const seF = ready.reduce((a, s) => a + (s.pHat - s.latent) ** 2, 0);
  const seR = ready.reduce((a, s) => a + (s.y - s.latent) ** 2, 0);
  const snr = seF > 0 && seR > 0 ? 10 * Math.log10(seR / seF) : NaN;
  const far = ready.length ? holds / Math.max(ready.length / 1440, 1e-9) : 0;

  let k1 = 0.18;
  if (ready.length > 50) {
    let num = 0,
      den = 0;
    for (let i = 1; i < ready.length; i++) {
      const inn = ready[i].y - ready[i - 1].y;
      num += (ready[i].pHat - ready[i - 1].pHat) * inn;
      den += inn * inn;
    }
    if (den > 0) k1 = Math.min(0.85, Math.max(0.03, num / den));
  }
  const delay = (1 - k1) / k1;

  const step = ready.length > 420 ? 2 : 1;
  const tape = ready.filter((_, i) => i % step === 0).map((s, i, arr) => {
    const p = i ? arr[i - 1] : s;
    return {
      t: s.t,
      obs: s.y,
      filt: s.pHat,
      resid: (s.y - s.pHat) * 1e4,
      vel: s.vHat * 1e4,
      Rt: s.Rt,
      sa2: s.sa2,
      nu: s.nu,
      gamma: s.gamma,
      cusum: s.cusum,
      pos: s.action === "TRADE" && s.vHat > 0 ? 1 : 0,
      hold: s.action === "HOLD" ? 1 : 0,
    };
  });

  const jumpB = useMemo(() => (series ? clusters(series, (s) => s.jump) : []), [series]);
  const holdB = useMemo(() => (series ? clusters(series, (s) => s.ready && s.action === "HOLD") : []), [series]);
  const regimeB = useMemo(() => (series ? clusters(series, (s) => s.regime) : []), [series]);

  const innov = ready.map((s) => s.y - s.pHat);
  const nis = ready.map((s) => s.nisShadow);
  const cusum = ready.map((s) => s.cusum);
  const vel = ready.map((s) => s.vHat);
  const rt = ready.map((s) => s.Rt);
  const sa = ready.map((s) => s.sa2);

  let eq = 0;
  const equity: number[] = [];
  for (let i = 1; i < ready.length; i++) {
    const pos = ready[i - 1].action === "TRADE" && ready[i - 1].vHat > 0 ? 1 : 0;
    const r = ready[i].y - ready[i - 1].y;
    const flip =
      Number(ready[i].action === "TRADE" && ready[i].vHat > 0) !==
      Number(ready[i - 1].action === "TRADE" && ready[i - 1].vHat > 0);
    eq += pos * r - (flip ? DEFAULT_CONFIG.costRtBp * 1e-4 * 0.5 : 0);
    equity.push(eq);
  }

  const heatCols = 80;
  const heat = useMemo(() => {
    if (!ready.length) return { cols: [] as number[][], vmax: 1 };
    const cols: number[][] = [];
    const stride = Math.max(1, Math.floor(ready.length / heatCols));
    let vmax = 1e-18;
    for (let c = 0; c < heatCols; c++) {
      const sl = ready.slice(c * stride, Math.min(ready.length, (c + 1) * stride + 6));
      const row = [0, 0, 0, 0];
      for (let j = 0; j < 4; j++) {
        let s = 0;
        for (const p of sl) s += (p.details?.[j] ?? 0) ** 2;
        row[j] = sl.length ? s / sl.length : 0;
        if (row[j] > vmax) vmax = row[j];
      }
      cols.push(row);
    }
    return { cols, vmax };
  }, [ready]);

  const lastE = [0, 0, 0, 0];
  if (last?.details) {
    for (let j = 0; j < 4; j++) lastE[j] = Math.abs(last.details[j] ?? 0);
  }
  const eMax = Math.max(...lastE, 1e-12);

  const leds = ready.slice(-36).map((s) => s.nu > s.gamma);
  const persistHits = leds.slice(-5).filter(Boolean).length;

  const chg = last && prev ? last.y - prev.y : 0;
  const px = last ? Math.exp(last.y) : 0;
  const mid = last ? last.pHat : 0;
  const spr = last ? Math.sqrt(Math.max(last.Rt, 1e-16)) : 0;
  const lat = ms != null ? (ms / Math.max(n, 1)).toFixed(2) : "—";
  const tip = {
    contentStyle: { background: "#000", border: "1px solid #333", fontSize: 10, fontFamily: "IBM Plex Mono" },
  };

  return (
    <Shell>
      {/* ticker */}
      <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 border border-[#2a2a2a] bg-[#0a0a0a] px-2 py-1 font-mono text-[11px]">
        <span className="text-accent">BTCUSD</span>
        <span className="text-xl tabular-nums text-white">{px ? px.toFixed(2) : "—"}</span>
        <span className={chg >= 0 ? "text-trade" : "text-hold"}>
          {chg >= 0 ? "+" : ""}
          {(chg * 1e4).toFixed(2)} bp
        </span>
        <span className="text-[#8a8a8a]">LOG {last ? last.y.toFixed(5) : "—"}</span>
        <span className="text-[#8a8a8a]">FILT {last ? last.pHat.toFixed(5) : "—"}</span>
        <span className={last?.action === "HOLD" ? "text-hold" : "text-trade"}>
          {last?.action === "HOLD" ? "GATE HOLD" : "GATE TRADE"}
        </span>
        <span className="text-trade">AUDT PASS</span>
        <span className="text-[#8a8a8a]">{track} {n}b</span>
        <span className="ml-auto text-[#8a8a8a]">
          {clock} · {lat} ms/bar
        </span>
      </div>

      <div className="mb-1 flex flex-wrap gap-1 font-mono text-[10px]">
        {(["A1", "A2", "A3"] as TrackKind[]).map((k) => (
          <button
            key={k}
            type="button"
            className={`h-6 px-2 ${track === k ? "bg-accent text-black" : "border border-[#2a2a2a] text-[#c4c4c4]"}`}
            onClick={() => {
              setSeries(null);
              setTrack(k);
            }}
          >
            {k}
          </button>
        ))}
        <button
          className="h-6 border border-[#2a2a2a] px-2 text-[#c4c4c4]"
          onClick={() => {
            setSeries(null);
            setGated((g) => !g);
          }}
        >
          GATE {gated ? "1" : "0"}
        </button>
        <button
          className="h-6 border border-[#2a2a2a] px-2 text-[#c4c4c4]"
          onClick={() => {
            setSeries(null);
            setN((x) => (x === 760 ? 1000 : x === 1000 ? 560 : 760));
          }}
        >
          LEN {n}
        </button>
        <button
          className="h-6 bg-accent px-2 text-black"
          onClick={() => {
            setSeries(null);
            setSeed((s) => s + 1);
          }}
        >
          RESAMPLE
        </button>
      </div>

      <div className="grid gap-1 lg:grid-cols-12">
        {/* PRICE TAPE */}
        <Box code="HP <GO>" title="log π  ·  grey tape  ·  cyan CAMASE  ·  red HOLD  ·  gold jump" className="lg:col-span-8">
          <div className="h-[250px]">
            {tape.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={tape} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
                  {regimeB.map((b, i) => (
                    <ReferenceArea key={"r" + i} x1={b.x1} x2={b.x2} fill="#3d3000" fillOpacity={0.55} />
                  ))}
                  {jumpB.map((b, i) => (
                    <ReferenceArea key={"j" + i} x1={b.x1} x2={b.x2} fill="#ff9900" fillOpacity={0.18} />
                  ))}
                  {holdB.map((b, i) => (
                    <ReferenceArea key={"h" + i} x1={b.x1} x2={b.x2} fill="#ff3d00" fillOpacity={0.12} />
                  ))}
                  <XAxis dataKey="t" tick={{ fill: "#666", fontSize: 9 }} />
                  <YAxis yAxisId="p" domain={["auto", "auto"]} tick={{ fill: "#888", fontSize: 9 }} width={46} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fill: "#555", fontSize: 9 }} width={28} />
                  <Tooltip {...tip} />
                  <Line yAxisId="p" dataKey="obs" stroke="#8a8a8a" dot={false} strokeWidth={1} name="tape" />
                  <Line yAxisId="p" dataKey="filt" stroke="#00e5ff" dot={false} strokeWidth={1.7} name="filt" />
                  <Area yAxisId="r" dataKey="resid" stroke="none" fill="#ff9900" fillOpacity={0.15} name="resid bp" />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <p className="p-4 text-[11px] text-[#8a8a8a]">loading cascade…</p>
            )}
          </div>
        </Box>

        {/* QUOTE / STATE */}
        <Box code="QTE" title="synthetic book from √R" className="lg:col-span-4">
          <div className="mb-2 text-center">
            <p className="text-[10px] text-[#8a8a8a]">MID p̂</p>
            <p className="text-2xl tabular-nums text-accent">{last ? last.pHat.toFixed(6) : "—"}</p>
          </div>
          <Ladder
            rows={[
              { side: "A2", px: last ? (mid + 2 * spr).toFixed(6) : "—", sz: 0.3, max: 1, tone: "ask" },
              { side: "A1", px: last ? (mid + spr).toFixed(6) : "—", sz: 0.6, max: 1, tone: "ask" },
              { side: "MID", px: last ? mid.toFixed(6) : "—", sz: 1, max: 1, tone: "mid" },
              { side: "B1", px: last ? (mid - spr).toFixed(6) : "—", sz: 0.6, max: 1, tone: "bid" },
              { side: "B2", px: last ? (mid - 2 * spr).toFixed(6) : "—", sz: 0.3, max: 1, tone: "bid" },
            ]}
          />
          <div className="mt-2">
            <Kv k="SPREAD √R" v={spr.toExponential(2)} tone="amber" />
            <Kv k="VEL ×1e4" v={last ? (last.vHat * 1e4).toFixed(3) : "—"} tone={(last?.vHat ?? 0) > 0 ? "up" : "dn"} />
            <Kv k="ρ  Eᴴ/(Eᴴ+Eᴸ)" v={last ? last.rho.toFixed(3) : "—"} />
            <Kv k="CUSUM / H" v={last ? `${last.cusum.toFixed(1)} / ${DEFAULT_CONFIG.cusumH}` : "—"} />
          </div>
        </Box>

        {/* R thermostat */}
        <Box code="R <T>" title="measurement noise — high-scale energy drives distrust of tape" className="lg:col-span-4">
          <div className="h-[88px]">
            <Spark ys={rt} color="#ff9100" fill="#ff9100" h={88} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[#8a8a8a]">
            <span>floor { (DEFAULT_CONFIG.R0 / DEFAULT_CONFIG.clipR).toExponential(1) }</span>
            <span className="text-accent">{last ? last.Rt.toExponential(2) : "—"}</span>
            <span>ceil { (DEFAULT_CONFIG.R0 * DEFAULT_CONFIG.clipR).toExponential(1) }</span>
          </div>
        </Box>

        {/* Q thermostat */}
        <Box code="Q <T>" title="process noise — low-scale energy lets the state run" className="lg:col-span-4">
          <div className="h-[88px]">
            <Spark ys={sa} color="#69f0ae" fill="#69f0ae" h={88} />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[#8a8a8a]">
            <span>floor {(DEFAULT_CONFIG.sigmaA0 / DEFAULT_CONFIG.clipQ).toExponential(1)}</span>
            <span className="text-trade">{last ? last.sa2.toExponential(2) : "—"}</span>
            <span>ceil {(DEFAULT_CONFIG.sigmaA0 * DEFAULT_CONFIG.clipQ).toExponential(1)}</span>
          </div>
        </Box>

        {/* gauges */}
        <Box code="GGE" title="live thermostats" className="lg:col-span-4">
          <div className="flex justify-around">
            <Gauge value={last?.rho ?? 0} label="ρ rough" warn={(last?.rho ?? 0) > 0.7} />
            <Gauge
              value={last?.nu ?? 1}
              min={0}
              max={3}
              label="ν window"
              warn={(last?.nu ?? 0) > (last?.gamma ?? 1.5)}
            />
            <Gauge
              value={last?.cusum ?? 0}
              min={0}
              max={DEFAULT_CONFIG.cusumH}
              label="CUSUM"
              warn={(last?.cusum ?? 0) > DEFAULT_CONFIG.cusumH * 0.7}
            />
          </div>
        </Box>

        {/* spectrogram */}
        <Box code="WVLT" title="D1–D2 = tape noise → R    D3–D4 = drift → Q" className="lg:col-span-5">
          <div className="space-y-1">
            {["D1 hi", "D2", "D3", "D4 lo"].map((lab, j) => (
              <div key={lab} className="flex items-center gap-2">
                <span className="w-10 text-[10px] text-[#8a8a8a]">{lab}</span>
                <div
                  className="grid h-4 flex-1 gap-px"
                  style={{ gridTemplateColumns: `repeat(${heat.cols.length || 80}, minmax(0,1fr))` }}
                >
                  {heat.cols.map((col, i) => (
                    <div key={i} style={{ background: heatColor(col[j] / heat.vmax) }} />
                  ))}
                </div>
                <span className="w-14 text-right text-[10px] text-accent">{lastE[j].toExponential(1)}</span>
              </div>
            ))}
          </div>
        </Box>

        {/* NIS + CUSUM */}
        <Box code="NIS" title="shadow consistency  ·  χ² band  ·  CUSUM tank" className="lg:col-span-4">
          <div className="h-[92px]">
            {tape.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={tape} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <ReferenceLine y={last?.gamma ?? 1.47} stroke="#ff3d00" strokeDasharray="3 3" />
                  <YAxis hide domain={[0, "auto"]} />
                  <XAxis dataKey="t" hide />
                  <Line dataKey="nu" stroke="#ea80fc" dot={false} strokeWidth={1.3} />
                  <Area dataKey="cusum" stroke="#ffea00" fill="#ffea00" fillOpacity={0.12} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : null}
          </div>
          <p className="mt-1 text-[10px] text-[#8a8a8a]">
            yellow = CUSUM g · purple = window NIS · red dash = γ
          </p>
        </Box>

        {/* persistence LEDs */}
        <Box code="3/5" title="persistence strip — red when nu exceeds gamma" className="lg:col-span-3">
          <Leds flags={leds} />
          <p className="mt-2 text-[11px]">
            last 5: <span className={persistHits >= 3 ? "text-hold" : "text-trade"}>{persistHits}/5</span>
          </p>
          <p className="text-[10px] text-[#8a8a8a]">alarm fires at 3-of-5 or CUSUM above H</p>
        </Box>

        {/* residual hist */}
        <Box code="INN" title="innovation y−p̂  ·  should be centred if R is honest" className="lg:col-span-4">
          <Hist values={innov} color="#ff9900" />
          <p className="mt-1 text-[10px] text-[#8a8a8a]">
            mean {(innov.reduce((a, b) => a + b, 0) / Math.max(innov.length, 1)).toExponential(2)}
          </p>
        </Box>

        <Box code="VEL" title="velocity state — long when positive and gate TRADE" className="lg:col-span-4">
          <div className="h-[80px]">
            <Spark ys={vel} color="#00e676" fill="#00e676" h={80} baseline={0} />
          </div>
        </Box>

        <Box code="PNL" title="next-bar long/flat  ·  20 bp round-trip" className="lg:col-span-4">
          <div className="h-[80px]">
            <Spark ys={equity} color={eq >= 0 ? "#00e676" : "#ff3d00"} fill={eq >= 0 ? "#00e676" : "#ff3d00"} h={80} />
          </div>
          <p className="mt-1 text-[10px] text-[#8a8a8a]">
            cum log {eq.toExponential(3)} · TiM {(tim * 100).toFixed(0)}%
          </p>
        </Box>
      </div>

      {/* function tape */}
      <div className="mt-1 grid grid-cols-2 gap-1 font-mono text-[11px] lg:grid-cols-4">
        <div className="bb-box flex justify-between px-2 py-1">
          <span className="text-[#8a8a8a]">F1 GATE</span>
          <span className={last?.action === "HOLD" ? "text-hold" : "text-trade"}>
            {last?.action === "HOLD" ? "HOLD" : "NORMAL"}
          </span>
        </div>
        <div className="bb-box flex justify-between px-2 py-1">
          <span className="text-[#8a8a8a]">F2 FAR</span>
          <span className="text-accent">{far.toFixed(2)} /d</span>
        </div>
        <div className="bb-box flex justify-between px-2 py-1">
          <span className="text-[#8a8a8a]">F3 SNR</span>
          <span className="text-[#00e5ff]">{Number.isFinite(snr) ? `${snr >= 0 ? "+" : ""}${snr.toFixed(1)} dB` : "—"}</span>
        </div>
        <div className="bb-box flex justify-between px-2 py-1">
          <span className="text-[#8a8a8a]">F4 DELAY</span>
          <span className="text-accent">{delay.toFixed(1)} bar</span>
        </div>
      </div>
    </Shell>
  );
}
