import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { DualSpark, Tape } from "@/components/camase/charts";
import { Shell } from "@/components/camase/shell";
import { Box, Gauge, Hist, Kv, Ladder, Leds, Spark } from "@/components/camase/widgets";
import { DEFAULT_CONFIG } from "@/lib/camase/config";
import { TrackKind } from "@/lib/camase/heston";
import { LabPoint, runLab } from "@/lib/camase/runner";

export const Route = createFileRoute("/")({ component: Monitor });

function heatColor(v: number) {
  const x = Math.min(1, Math.max(0, v));
  return `rgb(${Math.round(20 + 235 * x)},${Math.round(40 + 140 * x)},0)`;
}

function runSafe(n: number, track: TrackKind, seed: number, gated: boolean) {
  const t0 = typeof performance !== "undefined" ? performance.now() : 0;
  try {
    const series = runLab(n, track, seed, gated).series;
    const ms = typeof performance !== "undefined" ? performance.now() - t0 : 0;
    return { series, ms, err: "" };
  } catch (e) {
    return { series: [] as LabPoint[], ms: 0, err: e instanceof Error ? e.message : String(e) };
  }
}

function Monitor() {
  const [track, setTrack] = useState<TrackKind>("A2");
  const [gated, setGated] = useState(true);
  const [n, setN] = useState(520);
  const [seed, setSeed] = useState(42);

  const pack = useMemo(() => runSafe(n, track, seed, gated), [n, track, seed, gated]);
  const series = pack.series;
  const ready = useMemo(() => series.filter((s) => s.ready), [series]);
  const last = series[series.length - 1];
  const prev = series.length > 2 ? series[series.length - 2] : last;

  const holds = ready.filter((s) => s.action === "HOLD").length;
  const tim = ready.length ? 1 - holds / ready.length : 0;
  const seF = ready.reduce((a, s) => a + (s.pHat - s.latent) ** 2, 0);
  const seR = ready.reduce((a, s) => a + (s.y - s.latent) ** 2, 0);
  const snr = seF > 0 && seR > 0 ? 10 * Math.log10(seR / seF) : NaN;
  const far = ready.length ? holds / Math.max(ready.length / 1440, 1e-9) : 0;

  let k1 = 0.18;
  if (ready.length > 40) {
    let num = 0;
    let den = 0;
    for (let i = 1; i < ready.length; i++) {
      const inn = ready[i].y - ready[i - 1].y;
      num += (ready[i].pHat - ready[i - 1].pHat) * inn;
      den += inn * inn;
    }
    if (den > 0) k1 = Math.min(0.85, Math.max(0.03, num / den));
  }
  const delay = (1 - k1) / k1;

  const obs = ready.map((s) => s.y);
  const filt = ready.map((s) => s.pHat);
  const resid = ready.map((s) => (s.y - s.pHat) * 1e4);
  const innov = ready.map((s) => s.y - s.pHat);
  const vel = ready.map((s) => s.vHat);
  const rt = ready.map((s) => s.Rt);
  const sa = ready.map((s) => s.sa2);
  const nu = ready.map((s) => s.nu);
  const cu = ready.map((s) => s.cusum);
  const gamma = last?.gamma ?? 1.47;

  const bands = useMemo(() => {
    const out: { i0: number; i1: number; color: string; opacity: number }[] = [];
    const push = (pred: (s: LabPoint) => boolean, color: string, opacity: number) => {
      let a = -1;
      for (let i = 0; i <= ready.length; i++) {
        const on = i < ready.length && pred(ready[i]);
        if (on && a < 0) a = i;
        if (!on && a >= 0) {
          out.push({ i0: a, i1: i - 1, color, opacity });
          a = -1;
        }
      }
    };
    push((s) => s.regime, "#5a4500", 0.45);
    push((s) => s.jump, "#ff9900", 0.22);
    push((s) => s.action === "HOLD", "#ff3d00", 0.16);
    return out;
  }, [ready]);

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

  const heat = useMemo(() => {
    const cols = 72;
    if (!ready.length) return { cols: [] as number[][], vmax: 1 };
    const out: number[][] = [];
    const stride = Math.max(1, Math.floor(ready.length / cols));
    let vmax = 1e-18;
    for (let c = 0; c < cols; c++) {
      const sl = ready.slice(c * stride, Math.min(ready.length, (c + 1) * stride + 4));
      const row = [0, 0, 0, 0];
      for (let j = 0; j < 4; j++) {
        let s = 0;
        for (const p of sl) s += (p.details?.[j] ?? 0) ** 2;
        row[j] = sl.length ? s / sl.length : 0;
        if (row[j] > vmax) vmax = row[j];
      }
      out.push(row);
    }
    return { cols: out, vmax };
  }, [ready]);

  const lastE = [0, 0, 0, 0];
  if (last?.details) for (let j = 0; j < 4; j++) lastE[j] = Math.abs(last.details[j] ?? 0);

  const leds = ready.slice(-36).map((s) => s.nu > s.gamma);
  const persistHits = leds.slice(-5).filter(Boolean).length;
  const chg = last && prev ? last.y - prev.y : 0;
  const px = last ? Math.exp(last.y) : 0;
  const mid = last ? last.pHat : 0;
  const spr = last ? Math.sqrt(Math.max(last.Rt, 1e-16)) : 0;
  const lat = pack.ms ? (pack.ms / Math.max(n, 1)).toFixed(2) : "—";

  return (
    <Shell>
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
        <span className="text-[#8a8a8a]">
          {track} {ready.length}/{n}b
        </span>
        <span className="ml-auto text-[#8a8a8a]">{lat} ms/bar</span>
      </div>
      {pack.err ? <p className="mb-1 text-[11px] text-hold">{pack.err}</p> : null}

      <div className="mb-1 flex flex-wrap gap-1 font-mono text-[10px]">
        {(["A1", "A2", "A3"] as TrackKind[]).map((k) => (
          <button
            key={k}
            type="button"
            className={`h-6 px-2 ${track === k ? "bg-accent text-black" : "border border-[#2a2a2a] text-[#c4c4c4]"}`}
            onClick={() => setTrack(k)}
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          className="h-6 border border-[#2a2a2a] px-2 text-[#c4c4c4]"
          onClick={() => setGated((g) => !g)}
        >
          GATE {gated ? "1" : "0"}
        </button>
        <button
          type="button"
          className="h-6 border border-[#2a2a2a] px-2 text-[#c4c4c4]"
          onClick={() => setN((x) => (x === 520 ? 720 : x === 720 ? 400 : 520))}
        >
          LEN {n}
        </button>
        <button type="button" className="h-6 bg-accent px-2 text-black" onClick={() => setSeed((s) => s + 1)}>
          RESAMPLE
        </button>
        <button
          type="button"
          className="h-6 border border-accent px-2 text-accent"
          onClick={() => {
            setTrack("A3");
            setSeed(7);
            setN(720);
          }}
        >
          STORY A3
        </button>
      </div>

      <div className="grid gap-1 lg:grid-cols-12">
        <Box code="HP GO" title="log price (ln)  grey tape  cyan CAMASE  gold jump  red HOLD" className="lg:col-span-8">
          <Tape
            height={230}
            t0={ready[0]?.t ?? 0}
            series={[
              { ys: obs, color: "#9a9a9a", width: 1, name: "tape" },
              { ys: filt, color: "#00e5ff", width: 1.8, name: "filt" },
              { ys: ready.map((s) => s.latent), color: "#7eb6ff", width: 1, name: "latent" },
            ]}
            bands={bands}
            residual={resid}
          />
        </Box>

        <Box code="QTE" title="synthetic book from sqrt(R)" className="lg:col-span-4">
          <div className="mb-2 text-center">
            <p className="text-[10px] text-[#8a8a8a]">MID p-hat</p>
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
            <Kv k="SPREAD sqrt(R)" v={spr.toExponential(2)} tone="amber" />
            <Kv k="VEL x1e4" v={last ? (last.vHat * 1e4).toFixed(3) : "—"} tone={(last?.vHat ?? 0) > 0 ? "up" : "dn"} />
            <Kv k="rho E_hi/(E_hi+E_lo)" v={last ? last.rho.toFixed(3) : "—"} />
            <Kv k="CUSUM / H" v={last ? `${last.cusum.toFixed(1)} / ${DEFAULT_CONFIG.cusumH}` : "—"} />
          </div>
        </Box>

        <Box code="R T" title="measurement noise — high-scale energy distrusts the tape" className="lg:col-span-4">
          <Spark ys={rt} color="#ff9100" fill="#ff9100" h={88} />
          <div className="mt-1 flex justify-between text-[10px] text-[#8a8a8a]">
            <span>{(DEFAULT_CONFIG.R0 / DEFAULT_CONFIG.clipR).toExponential(1)}</span>
            <span className="text-accent">{last ? last.Rt.toExponential(2) : "—"}</span>
            <span>{(DEFAULT_CONFIG.R0 * DEFAULT_CONFIG.clipR).toExponential(1)}</span>
          </div>
        </Box>

        <Box code="Q T" title="process noise — low-scale energy lets the state run" className="lg:col-span-4">
          <Spark ys={sa} color="#69f0ae" fill="#69f0ae" h={88} />
          <div className="mt-1 flex justify-between text-[10px] text-[#8a8a8a]">
            <span>{(DEFAULT_CONFIG.sigmaA0 / DEFAULT_CONFIG.clipQ).toExponential(1)}</span>
            <span className="text-trade">{last ? last.sa2.toExponential(2) : "—"}</span>
            <span>{(DEFAULT_CONFIG.sigmaA0 * DEFAULT_CONFIG.clipQ).toExponential(1)}</span>
          </div>
        </Box>

        <Box code="GGE" title="live thermostats" className="lg:col-span-4">
          <div className="flex justify-around">
            <Gauge value={last?.rho ?? 0} label="rho rough" warn={(last?.rho ?? 0) > 0.7} />
            <Gauge value={last?.nu ?? 1} min={0} max={3} label="nu window" warn={(last?.nu ?? 0) > gamma} />
            <Gauge
              value={last?.cusum ?? 0}
              min={0}
              max={DEFAULT_CONFIG.cusumH}
              label="CUSUM"
              warn={(last?.cusum ?? 0) > DEFAULT_CONFIG.cusumH * 0.7}
            />
          </div>
        </Box>

        <Box code="WVLT" title="D1-D2 tape noise drives R · D3-D4 drift drives Q" className="lg:col-span-5">
          <div className="space-y-1">
            {["D1 hi", "D2", "D3", "D4 lo"].map((lab, j) => (
              <div key={lab} className="flex items-center gap-2">
                <span className="w-10 text-[10px] text-[#8a8a8a]">{lab}</span>
                <div
                  className="grid h-4 flex-1 gap-px"
                  style={{ gridTemplateColumns: `repeat(${heat.cols.length || 72}, minmax(0,1fr))` }}
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

        <Box code="NIS" title="purple window NIS · yellow CUSUM · red chi-squared" className="lg:col-span-4">
          <DualSpark a={nu} b={cu} ca="#ea80fc" cb="#ffea00" height={92} href={gamma} na="nu" nb="g" />
        </Box>

        <Box code="3/5" title="persistence strip — red when nu exceeds gamma" className="lg:col-span-3">
          <Leds flags={leds} />
          <p className="mt-2 text-[11px]">
            last 5: <span className={persistHits >= 3 ? "text-hold" : "text-trade"}>{persistHits}/5</span>
          </p>
          <p className="text-[10px] text-[#8a8a8a]">alarm fires at 3-of-5 or CUSUM above H</p>
        </Box>

        <Box code="INN" title="innovation y minus p-hat — should be centred if R is honest" className="lg:col-span-4">
          <Hist values={innov} color="#ff9900" />
          <p className="mt-1 text-[10px] text-[#8a8a8a]">
            mean {(innov.reduce((a, b) => a + b, 0) / Math.max(innov.length, 1)).toExponential(2)}
          </p>
        </Box>

        <Box code="VEL" title="velocity state — long when positive and gate TRADE" className="lg:col-span-4">
          <Spark ys={vel} color="#00e676" fill="#00e676" h={80} baseline={0} />
        </Box>

        <Box code="PNL" title="next-bar long/flat · 20 bp round-trip" className="lg:col-span-4">
          <Spark ys={equity} color={eq >= 0 ? "#00e676" : "#ff3d00"} fill={eq >= 0 ? "#00e676" : "#ff3d00"} h={80} />
          <p className="mt-1 text-[10px] text-[#8a8a8a]">
            cum log {eq.toExponential(3)} · TiM {(tim * 100).toFixed(0)}%
          </p>
        </Box>
      </div>

      <div className="mt-1 grid grid-cols-2 gap-1 font-mono text-[11px] lg:grid-cols-4">
        <div className="bb-box flex justify-between px-2 py-1">
          <span className="text-[#8a8a8a]">F1 GATE</span>
          <span className={last?.action === "HOLD" ? "text-hold" : "text-trade"}>
            {last?.action === "HOLD" ? "HOLD" : "NORMAL"}
          </span>
        </div>
        <div className="bb-box flex justify-between px-2 py-1">
          <span className="text-[#8a8a8a]">F2 HOLDS/1440</span>
          <span className="text-accent">{far.toFixed(2)} /d</span>
        </div>
        <div className="bb-box flex justify-between px-2 py-1">
          <span className="text-[#8a8a8a]">F3 SNR</span>
          <span className="text-[#00e5ff]">
            {Number.isFinite(snr) ? `${snr >= 0 ? "+" : ""}${snr.toFixed(1)} dB` : "—"}
          </span>
        </div>
        <div className="bb-box flex justify-between px-2 py-1">
          <span className="text-[#8a8a8a]">F4 DELAY</span>
          <span className="text-accent">{delay.toFixed(1)} bar</span>
        </div>
      </div>
    </Shell>
  );
}
