import { createFileRoute } from "@tanstack/react-router";
import { Panel, Shell, Stat } from "@/components/camase/shell";
import ablation from "@/lib/camase/published/ablation.json";
import pareto from "@/lib/camase/published/pareto.json";
import trackA from "@/lib/camase/published/track_a.json";
import trackB from "@/lib/camase/published/track_b.json";
import walkforward from "@/lib/camase/published/walkforward.json";

export const Route = createFileRoute("/results")({ component: ResultsPage });

function fmt(x: number | null | undefined, d = 4) {
  if (x == null || Number.isNaN(Number(x))) return "—";
  const n = Number(x);
  if (Math.abs(n) >= 100) return n.toFixed(1);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toExponential(d);
}

function ResultsPage() {
  const scores = (trackA as { scores: Array<Record<string, number | string>> }).scores;
  const ab = ablation as Array<Record<string, number | string>>;
  const wf = walkforward as {
    n: number;
    n_folds: number;
    warmup: number;
    l4: number;
    summary: Array<{
      model: string;
      mean_sharpe_net: number;
      deflated_sharpe: number;
      n_folds: number;
      sharpe_ci: { mean: number; lo: number; hi: number };
    }>;
    folds: Array<{ fold: number; train_end: number; test_start: number; test_end: number; embargo_end: number }>;
  };
  const tb = trackB as { synthetic: boolean; sha256: string; n: number; note: string };
  const pts = pareto as Array<{ name: string; delay_bars: number; rmse_p: number; snr_db: number }>;

  return (
    <Shell>
      <p className="font-mono text-[11px] tracking-[0.16em] text-fg-subtle uppercase">
        Objective 5–6 · committed tables
      </p>
      <h2 className="mt-1 font-display text-3xl tracking-tight">Published runs</h2>
      <p className="mt-2 max-w-2xl text-sm text-fg-muted">
        Numbers come from the Python package, not the browser demo. Regenerated with
        <span className="font-mono"> python3 -m camase</span>. Sharpe is minute-bar
        annualised and will look extreme on short folds — read Deflated Sharpe and
        time-in-market first.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Track A n" value={String((trackA as { n: number }).n)} hint="Heston A2" />
        <Stat label="WF folds" value={String(wf.n_folds)} hint={`purge ${wf.warmup} · embargo ${wf.l4}`} />
        <Stat label="Track B bars" value={String(tb.n)} hint={tb.synthetic ? "synthetic CSV" : "real CSV"} />
        <Stat label="Track B sha256" value={tb.sha256.slice(0, 10) + "…"} hint="hashed sample" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Track A · A2">
          <Table
            cols={["model", "rmse_p", "snr_db", "mean_nis", "time_in_market"]}
            rows={scores}
          />
        </Panel>
        <Panel title="Ablation · A2 n=1600">
          <Table cols={["model", "rmse_p", "snr_db", "mean_nis", "time_in_market"]} rows={ab} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Purged walk-forward summary">
          <table className="w-full text-left text-sm">
            <thead className="font-mono text-[11px] tracking-wider text-fg-subtle uppercase">
              <tr className="border-b border-line">
                <th className="py-2 pr-3">Model</th>
                <th className="py-2 pr-3">Mean SR net</th>
                <th className="py-2 pr-3">DSR</th>
                <th className="py-2">Folds</th>
              </tr>
            </thead>
            <tbody>
              {wf.summary.map((r) => (
                <tr key={r.model} className="border-b border-line/60">
                  <td className="py-2 pr-3 font-mono">{r.model}</td>
                  <td className="py-2 pr-3 font-mono">{fmt(r.mean_sharpe_net)}</td>
                  <td className="py-2 pr-3 font-mono">{fmt(r.deflated_sharpe)}</td>
                  <td className="py-2 font-mono">{r.n_folds}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-fg-subtle">
            Folds:{" "}
            {wf.folds.map((f) => `F${f.fold} train→${f.train_end} test ${f.test_start}–${f.test_end}`).join(" · ")}
          </p>
        </Panel>
        <Panel title="Group delay vs MA">
          <Table
            cols={["name", "delay_bars", "rmse_p", "snr_db"]}
            rows={pts as unknown as Array<Record<string, number | string>>}
          />
        </Panel>
      </div>

      <p className="mt-4 text-xs text-fg-subtle">{tb.note}</p>
    </Shell>
  );
}

function Table({
  cols,
  rows,
}: {
  cols: string[];
  rows: Array<Record<string, number | string>>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="font-mono text-[11px] tracking-wider text-fg-subtle uppercase">
          <tr className="border-b border-line">
            {cols.map((c) => (
              <th key={c} className="py-2 pr-3">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={String(r.model ?? r.name ?? i)} className="border-b border-line/60">
              {cols.map((c) => (
                <td key={c} className="py-2 pr-3 font-mono">
                  {typeof r[c] === "number" ? fmt(r[c] as number) : String(r[c] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
