type Series = { ys: number[]; color: string; width?: number; name?: string };

type Band = { i0: number; i1: number; color: string; opacity?: number };

function fmt(v: number): string {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a === 0) return "0";
  if (a >= 100) return v.toFixed(1);
  if (a >= 1) return v.toFixed(3);
  if (a >= 0.01) return v.toFixed(4);
  return v.toExponential(2);
}

function ticks(lo: number, hi: number, n = 4): number[] {
  const span = hi - lo || 1;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(hi - (span * i) / (n - 1));
  return out;
}

export function Tape({
  series,
  bands = [],
  height = 220,
  residual,
  t0 = 0,
}: {
  series: Series[];
  bands?: Band[];
  height?: number;
  residual?: number[];
  t0?: number;
}) {
  const n = series[0]?.ys.length ?? 0;
  if (n < 2) {
    return (
      <div className="flex items-center text-[11px] text-[#8a8a8a]" style={{ height }}>
        no samples yet
      </div>
    );
  }
  const w = 900;
  const all = series.flatMap((s) => s.ys).filter((v) => Number.isFinite(v));
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const x = (i: number) => (i / (n - 1)) * w;
  const y = (v: number) => 4 + ((hi - v) / span) * (height - 8);
  const path = (ys: number[]) =>
    ys.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const yTicks = ticks(lo, hi, 5);
  const lastVals = series.map((s) => s.ys[s.ys.length - 1]);

  return (
    <div>
      <div className="flex gap-1">
        <div className="flex w-14 shrink-0 flex-col justify-between py-0.5 text-right font-mono text-[10px] tabular-nums text-[#8a8a8a]">
          {yTicks.map((v) => (
            <span key={v}>{fmt(v)}</span>
          ))}
        </div>
        <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" className="flex-1">
          {yTicks.map((v) => (
            <line key={v} x1={0} x2={w} y1={y(v)} y2={y(v)} stroke="#1c1c1c" />
          ))}
          {bands.map((b, k) => (
            <rect
              key={k}
              x={x(b.i0)}
              y={0}
              width={Math.max(1, x(b.i1) - x(b.i0))}
              height={height}
              fill={b.color}
              opacity={b.opacity ?? 0.18}
            />
          ))}
          {residual && residual.length === n && (
            <path
              d={`${residual
                .map((v, i) => {
                  const rLo = Math.min(...residual);
                  const rHi = Math.max(...residual);
                  const ry = height - 4 - ((v - rLo) / (rHi - rLo || 1)) * (height * 0.25);
                  return `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${ry.toFixed(1)}`;
                })
                .join(" ")} L${w},${height} L0,${height} Z`}
              fill="#ff9900"
              opacity={0.14}
            />
          )}
          {series.map((s, k) => (
            <path key={k} d={path(s.ys)} fill="none" stroke={s.color} strokeWidth={s.width ?? 1.4} />
          ))}
        </svg>
        <div className="flex w-[72px] shrink-0 flex-col justify-center gap-1 font-mono text-[10px] tabular-nums">
          {series.map((s, i) => (
            <span key={i} style={{ color: s.color }}>
              {(s.name ?? i) + " " + fmt(lastVals[i])}
            </span>
          ))}
        </div>
      </div>
      <div className="ml-14 mr-[72px] flex justify-between font-mono text-[10px] text-[#8a8a8a]">
        <span>t={t0}</span>
        <span>t={t0 + Math.floor(n / 2)}</span>
        <span>t={t0 + n - 1}</span>
      </div>
    </div>
  );
}

export function DualSpark({
  a,
  b,
  ca,
  cb,
  height = 90,
  href,
  na = "A",
  nb = "B",
}: {
  a: number[];
  b?: number[];
  ca: string;
  cb?: string;
  height?: number;
  href?: number;
  na?: string;
  nb?: string;
}) {
  const n = a.length;
  if (n < 2) return <div style={{ height }} className="text-[10px] text-[#8a8a8a]">warming</div>;
  const w = 400;
  const vals = [...a, ...(b ?? [])].filter((v) => Number.isFinite(v));
  const lo = Math.min(...vals, href ?? Infinity);
  const hi = Math.max(...vals, href ?? -Infinity);
  const span = hi - lo || 1;
  const x = (i: number) => (i / (n - 1)) * w;
  const y = (v: number) => 3 + ((hi - v) / span) * (height - 6);
  const d = (ys: number[]) =>
    ys.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const yTicks = ticks(lo, hi, 3);
  return (
    <div>
      <div className="flex gap-1">
        <div className="flex w-12 shrink-0 flex-col justify-between text-right font-mono text-[10px] tabular-nums text-[#8a8a8a]">
          {yTicks.map((v) => (
            <span key={v}>{fmt(v)}</span>
          ))}
        </div>
        <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none" className="flex-1">
          {yTicks.map((v) => (
            <line key={v} x1={0} x2={w} y1={y(v)} y2={y(v)} stroke="#1c1c1c" />
          ))}
          {href !== undefined && (
            <line x1={0} x2={w} y1={y(href)} y2={y(href)} stroke="#ff3d00" strokeDasharray="4 3" />
          )}
          <path d={d(a)} fill="none" stroke={ca} strokeWidth={1.4} />
          {b && <path d={d(b)} fill="none" stroke={cb ?? "#ffea00"} strokeWidth={1.1} />}
        </svg>
      </div>
      <div className="ml-12 flex justify-between font-mono text-[10px] text-[#8a8a8a]">
        <span style={{ color: ca }}>
          {na} {fmt(a[a.length - 1])}
        </span>
        {b ? (
          <span style={{ color: cb }}>
            {nb} {fmt(b[b.length - 1])}
          </span>
        ) : null}
        {href !== undefined ? <span className="text-hold">γ {fmt(href)}</span> : null}
      </div>
    </div>
  );
}
