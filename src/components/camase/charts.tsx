type Series = { ys: number[]; color: string; width?: number };

type Band = { i0: number; i1: number; color: string; opacity?: number };

export function Tape({
  series,
  bands = [],
  height = 220,
  residual,
}: {
  series: Series[];
  bands?: Band[];
  height?: number;
  residual?: number[];
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
  const y = (v: number) => 6 + ((hi - v) / span) * (height - 12);
  const path = (ys: number[]) =>
    ys.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  let rLo = 0;
  let rHi = 1;
  if (residual && residual.length === n) {
    rLo = Math.min(...residual);
    rHi = Math.max(...residual);
    if (rHi === rLo) rHi = rLo + 1;
  }
  const ry = (v: number) => height - 4 - ((v - rLo) / (rHi - rLo)) * (height * 0.28);

  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
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
          d={`${residual.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${ry(v).toFixed(1)}`).join(" ")} L${w},${height} L0,${height} Z`}
          fill="#ff9900"
          opacity={0.16}
        />
      )}
      {series.map((s, k) => (
        <path key={k} d={path(s.ys)} fill="none" stroke={s.color} strokeWidth={s.width ?? 1.4} />
      ))}
    </svg>
  );
}

export function DualSpark({
  a,
  b,
  ca,
  cb,
  height = 90,
  href,
}: {
  a: number[];
  b?: number[];
  ca: string;
  cb?: string;
  height?: number;
  href?: number;
}) {
  const n = a.length;
  if (n < 2) return <div style={{ height }} />;
  const w = 400;
  const vals = [...a, ...(b ?? [])].filter((v) => Number.isFinite(v));
  const lo = Math.min(...vals, href ?? Infinity);
  const hi = Math.max(...vals, href ?? -Infinity);
  const span = hi - lo || 1;
  const x = (i: number) => (i / (n - 1)) * w;
  const y = (v: number) => 3 + ((hi - v) / span) * (height - 6);
  const d = (ys: number[]) =>
    ys.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} preserveAspectRatio="none">
      {href !== undefined && (
        <line x1={0} x2={w} y1={y(href)} y2={y(href)} stroke="#ff3d00" strokeDasharray="4 3" />
      )}
      <path d={d(a)} fill="none" stroke={ca} strokeWidth={1.4} />
      {b && <path d={d(b)} fill="none" stroke={cb ?? "#ffea00"} strokeWidth={1.1} />}
    </svg>
  );
}
