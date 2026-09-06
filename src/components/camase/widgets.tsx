import { cn } from "@/lib/utils";

export function Box({
  code,
  title,
  children,
  className,
}: {
  code: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("bb-box flex flex-col", className)}>
      <header className="bb-hd flex items-baseline justify-between gap-2">
        <span>{code}</span>
        <span className="tracking-normal text-[#8a8a8a] normal-case">{title}</span>
      </header>
      <div className="min-h-0 flex-1 p-2">{children}</div>
    </section>
  );
}

export function Spark({
  ys,
  color = "#ff9900",
  fill,
  h = 72,
  baseline,
}: {
  ys: number[];
  color?: string;
  fill?: string;
  h?: number;
  baseline?: number;
}) {
  if (ys.length < 2) return <div style={{ height: h }} />;
  const w = 320;
  const finite = ys.filter((v) => Number.isFinite(v));
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  const span = hi - lo || 1;
  const pts = ys
    .map((y, i) => {
      const x = (i / (ys.length - 1)) * w;
      const yy = h - 4 - ((y - lo) / span) * (h - 8);
      return `${x.toFixed(1)},${yy.toFixed(1)}`;
    })
    .join(" ");
  const y0 =
    baseline === undefined
      ? null
      : h - 4 - ((baseline - lo) / span) * (h - 8);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
      {fill && (
        <polygon
          points={`0,${h} ${pts} ${w},${h}`}
          fill={fill}
          opacity={0.22}
        />
      )}
      {y0 !== null && (
        <line x1={0} x2={w} y1={y0} y2={y0} stroke="#333" strokeDasharray="3 3" />
      )}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.4} />
    </svg>
  );
}

export function Gauge({
  value,
  min = 0,
  max = 1,
  label,
  warn,
}: {
  value: number;
  min?: number;
  max?: number;
  label: string;
  warn?: boolean;
}) {
  const t = Math.min(1, Math.max(0, (value - min) / (max - min || 1)));
  const ang = Math.PI * (1 - t);
  const x = 40 + 32 * Math.cos(ang);
  const y = 42 - 32 * Math.sin(ang);
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 80 50" className="h-14 w-24">
        <path d="M8 42 A32 32 0 0 1 72 42" fill="none" stroke="#222" strokeWidth="6" />
        <path
          d="M8 42 A32 32 0 0 1 72 42"
          fill="none"
          stroke={warn ? "#ff3d00" : "#ff9900"}
          strokeWidth="6"
          strokeDasharray={`${t * 100.5} 120`}
        />
        <circle cx={x} cy={y} r="2.4" fill="#fff" />
      </svg>
      <p className="font-mono text-[10px] text-[#8a8a8a]">{label}</p>
      <p className={cn("font-mono text-sm tabular-nums", warn ? "text-hold" : "text-accent")}>
        {Number.isFinite(value) ? value.toFixed(2) : "—"}
      </p>
    </div>
  );
}

export function Leds({ flags }: { flags: boolean[] }) {
  return (
    <div className="flex flex-wrap gap-0.5">
      {flags.map((on, i) => (
        <span
          key={i}
          className="inline-block h-3 w-2"
          style={{ background: on ? "#ff3d00" : "#1b3d24" }}
          title={on ? "exceed" : "ok"}
        />
      ))}
    </div>
  );
}

export function Hist({
  values,
  bins = 24,
  color = "#ea80fc",
}: {
  values: number[];
  bins?: number;
  color?: string;
}) {
  const xs = values.filter((v) => Number.isFinite(v));
  if (xs.length < 8) return <p className="text-[10px] text-[#8a8a8a]">warming up</p>;
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const span = hi - lo || 1;
  const counts = new Array(bins).fill(0);
  for (const v of xs) {
    const i = Math.min(bins - 1, Math.floor(((v - lo) / span) * bins));
    counts[i] += 1;
  }
  const m = Math.max(...counts, 1);
  return (
    <div className="flex h-20 items-end gap-px">
      {counts.map((c, i) => (
        <div
          key={i}
          className="flex-1"
          style={{ height: `${(c / m) * 100}%`, background: color, opacity: 0.35 + 0.65 * (c / m) }}
        />
      ))}
    </div>
  );
}

export function Ladder({
  rows,
}: {
  rows: { side: string; px: string; sz: number; max: number; tone: "bid" | "ask" | "mid" }[];
}) {
  return (
    <div className="space-y-0.5 font-mono text-[10px]">
      {rows.map((r) => (
        <div key={r.side} className="flex items-center gap-2">
          <span className="w-6 text-[#8a8a8a]">{r.side}</span>
          <div className="relative h-3 flex-1 bg-[#111]">
            <div
              className="absolute inset-y-0 left-0"
              style={{
                width: `${Math.min(100, (r.sz / r.max) * 100)}%`,
                background: r.tone === "ask" ? "#3d1510" : r.tone === "bid" ? "#0d2a18" : "#2a2208",
              }}
            />
          </div>
          <span className={r.tone === "ask" ? "text-hold" : r.tone === "bid" ? "text-trade" : "text-accent"}>
            {r.px}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Kv({ k, v, tone }: { k: string; v: string; tone?: "up" | "dn" | "amber" }) {
  const c =
    tone === "up" ? "text-trade" : tone === "dn" ? "text-hold" : tone === "amber" ? "text-accent" : "text-fg";
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-[#1a1a1a] py-0.5">
      <span className="text-[10px] text-[#8a8a8a]">{k}</span>
      <span className={cn("text-[12px] tabular-nums", c)}>{v}</span>
    </div>
  );
}
