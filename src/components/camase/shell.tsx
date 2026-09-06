import { Link, useRouterState } from "@tanstack/react-router";
import { Activity, FileText, ShieldCheck, Table2, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Lab", icon: Activity },
  { to: "/ablation", label: "Ablation", icon: Table2 },
  { to: "/audits", label: "Audits", icon: ShieldCheck },
  { to: "/results", label: "Results", icon: LineChart },
  { to: "/paper", label: "Paper", icon: FileText },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-fg-subtle uppercase">
              ECE · Batch 118 · v2.1
            </p>
            <h1 className="font-display text-2xl leading-tight tracking-tight text-fg sm:text-[1.7rem]">
              CAMASE
            </h1>
            <p className="mt-1 max-w-xl text-sm text-fg-muted">
              Causal multiscale adaptive state estimation — live instrument.
            </p>
          </div>
          <nav className="flex flex-wrap gap-1">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-[10px] px-3 text-sm transition-colors duration-150",
                    active
                      ? "bg-accent text-accent-fg"
                      : "text-fg-muted hover:bg-bg-subtle hover:text-fg",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.6} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
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
    <div className="rounded-[18px] border border-line bg-bg-elevated p-4">
      <p className="font-mono text-[10px] tracking-[0.16em] text-fg-subtle uppercase">{label}</p>
      <p className={cn("mt-2 font-mono text-xl tabular-nums", color)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-fg-subtle">{hint}</p> : null}
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
    <section className={cn("rounded-[18px] border border-line bg-bg-elevated p-4 sm:p-5", className)}>
      <h2 className="mb-3 font-display text-lg tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
