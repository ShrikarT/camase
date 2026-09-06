import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, FileText, ShieldCheck, Table2, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "MONITOR", icon: Activity },
  { to: "/ablation", label: "LADDER", icon: Table2 },
  { to: "/audits", label: "AUDITS", icon: ShieldCheck },
  { to: "/results", label: "RESULTS", icon: LineChart },
  { to: "/paper", label: "SPEC", icon: FileText },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="border-b border-line bg-[#0a0e14]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[10px] tracking-[0.22em] text-accent uppercase">CAMASE</span>
            <span className="hidden font-mono text-[10px] text-fg-subtle sm:inline">
              ECE · 118 · v2.1 · LIVE
            </span>
          </div>
          <nav className="flex flex-wrap gap-0.5">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded px-2.5 font-mono text-[11px] tracking-wide transition-colors",
                    active
                      ? "bg-accent text-accent-fg"
                      : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
                  )}
                >
                  <Icon className="size-3.5" strokeWidth={1.6} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1440px] px-3 py-4 sm:px-4 sm:py-5">{children}</main>
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "trade" | "hold" | "default";
}) {
  const color =
    tone === "trade" ? "text-trade" : tone === "hold" ? "text-hold" : "text-fg";
  return (
    <div className="term-panel px-3 py-2.5">
      <p className="font-mono text-[10px] tracking-[0.16em] text-fg-subtle uppercase">{label}</p>
      <p className={cn("mt-1 font-mono text-lg tabular-nums", color)}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

export function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("term-panel p-3 sm:p-4", className)}>
      <h2 className="mb-2 font-mono text-[11px] tracking-[0.14em] text-fg-muted uppercase">{title}</h2>
      {children}
    </section>
  );
}
