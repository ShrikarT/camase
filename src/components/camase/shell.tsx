import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "MON <GO>" },
  { to: "/ablation", label: "ABLN" },
  { to: "/audits", label: "AUDT" },
  { to: "/results", label: "RSLT" },
  { to: "/paper", label: "SPEC" },
] as const;

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-dvh bg-black text-fg">
      <header className="border-b border-[#2a2a2a] bg-black">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-2 py-1">
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="bg-accent px-1.5 py-0.5 font-semibold text-black">CAMASE</span>
            <span className="text-accent">HP 118</span>
            <span className="text-[#8a8a8a]">v2.1</span>
          </div>
          <nav className="flex">
            {NAV.map(({ to, label }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    "h-7 px-2.5 font-mono text-[11px] leading-7 tracking-wide",
                    active ? "bg-accent text-black" : "text-[#c4c4c4] hover:bg-[#1a1a1a] hover:text-accent",
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-2 py-2">{children}</main>
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
    tone === "trade" ? "text-trade" : tone === "hold" ? "text-hold" : "text-accent";
  return (
    <div className="bb-box px-2 py-1.5">
      <p className="text-[10px] tracking-[0.14em] text-[#8a8a8a] uppercase">{label}</p>
      <p className={cn("font-mono text-lg tabular-nums", color)}>{value}</p>
      {hint ? <p className="text-[10px] text-[#8a8a8a]">{hint}</p> : null}
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
    <section className={cn("bb-box", className)}>
      <h2 className="bb-hd">{title}</h2>
      <div className="p-2">{children}</div>
    </section>
  );
}
