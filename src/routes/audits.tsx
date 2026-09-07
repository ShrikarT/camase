import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Panel, Shell, Stat } from "@/components/camase/shell";
import { auditA, auditB, auditC, AuditResult, supportTable } from "@/lib/camase/audits";

export const Route = createFileRoute("/audits")({ component: AuditsPage });

function AuditsPage() {
  const [results, setResults] = useState<AuditResult[] | null>(null);
  const [running, setRunning] = useState(false);
  const supports = supportTable();

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function run() {
    setRunning(true);
    window.setTimeout(() => {
      setResults([auditA(), auditB(), auditC()]);
      setRunning(false);
    }, 30);
  }

  return (
    <Shell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-fg-subtle uppercase">
            Objective 1 · Contribution C1
          </p>
          <h2 className="font-display text-3xl tracking-tight">Leakage audits</h2>
          <p className="mt-2 max-w-2xl text-sm text-fg-muted">
            Causality is not asserted. Audit A is bit-exact future perturbation. Audit B is
            prefix invariance. Audit C shows the circular twin is contaminated at the edge.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          className="h-11 rounded-[10px] bg-accent px-4 text-sm text-accent-fg"
        >
          {running ? "Checking…" : "Run Audits A / B / C"}
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {supports.map((s) => (
          <Stat key={s.j} label={`Level ${s.j} support`} value={`${s.Lj}`} hint={`history for k=64: ${s.history}`} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {(
          results ?? [
            { name: "A", passed: false, detail: "Not run", nChecked: 0 },
            { name: "B", passed: false, detail: "Not run", nChecked: 0 },
            { name: "C", passed: false, detail: "Not run", nChecked: 0 },
          ]
        ).map((r) => (
          <Panel key={r.name} title={`Audit ${r.name}`}>
            <p
              className={`font-mono text-sm ${
                results ? (r.passed ? "text-trade" : "text-hold") : "text-fg-subtle"
              }`}
            >
              {results ? (r.passed ? "PASS" : "FAIL") : "IDLE"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{r.detail}</p>
            <p className="mt-3 font-mono text-xs text-fg-subtle">{r.nChecked} checks</p>
          </Panel>
        ))}
      </div>

      <Panel title="Definitions" className="mt-4">
        <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-fg-muted">
          <li>
            <span className="text-fg">A — future perturbation.</span> Copy the series, smash every
            sample after t, recompute. Coefficients at t must be bitwise identical.
          </li>
          <li>
            <span className="text-fg">B — prefix invariance.</span> Streaming the series one sample
            at a time must match a fresh cascade on y[0..t], bitwise.
          </li>
          <li>
            <span className="text-fg">C — leakage premium exists.</span> Circular MODWT at the newest
            sample disagrees with the causal FIR. That disagreement is look-ahead.
          </li>
        </ol>
      </Panel>
    </Shell>
  );
}
