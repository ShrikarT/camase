import { createFileRoute } from "@tanstack/react-router";
import { Panel, Shell } from "@/components/camase/shell";

export const Route = createFileRoute("/paper")({ component: PaperPage });

function PaperPage() {
  return (
    <Shell>
      <p className="font-mono text-[11px] tracking-[0.16em] text-fg-subtle uppercase">
        Specification v2.1 · 19 August 2026
      </p>
      <h2 className="mt-1 font-display text-3xl tracking-tight">
        Causality-audited multiscale adaptive state estimation
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-fg-muted">
        High-frequency prices are non-stationary and contaminated by microstructure noise.
        Fixed-parameter smoothers cannot reject that noise and still follow a genuine
        repricing. This project specifies a strictly causal estimator, proves the causality
        with tests, and reports every metric only where it is well-posed.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Panel title="Six objectives">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-fg-muted">
            <li>Causal à trous cascade + Audits A/B (db4, J=4, N=512, k=64).</li>
            <li>Two-sided adaptation: E^H → R_t, E^L → σ²_a. Joseph IRW filter.</li>
            <li>Shadow NIS gate, 3-of-5 + CUSUM, ~1 false alarm / session.</li>
            <li>Ablation M0–M9 and leaky twins M5′–M7′.</li>
            <li>Track A Heston truth; Track B prediction / economics only.</li>
            <li>Purged walk-forward, 20 bp costs, Deflated Sharpe, reproducible code.</li>
          </ol>
        </Panel>
        <Panel title="What is not claimed">
          <ul className="space-y-2 text-sm text-fg-muted">
            <li>Causal wavelets are not new (Quilty & Adamowski 2018; Shensa 1992).</li>
            <li>Two-sided Q/R adaptation is not new (Akhlaghi 2017; Hajiyev 2013).</li>
            <li>The filter is not zero-lag. Group delay is measured.</li>
            <li>Profit after costs is a hypothesis, not a result.</li>
          </ul>
        </Panel>
      </div>

      <Panel title="Contributions that remain defensible" className="mt-4">
        <div className="grid gap-3 text-sm text-fg-muted md:grid-cols-2">
          <p><span className="text-fg">C1</span> — executable bit-exact audit; HFT transfer; leakage priced in economic units.</p>
          <p><span className="text-fg">C2</span> — scale-band attribution of variance to R vs Q from a signal exogenous to the filter.</p>
          <p><span className="text-fg">C3</span> — shadow filter so adaptation cannot cancel the gate.</p>
          <p><span className="text-fg">C4</span> — dual-track protocol and leaky-twin arm that can refute C1–C3.</p>
        </div>
      </Panel>

      <Panel title="Literature spine" className="mt-4">
        <ul className="space-y-2 text-sm text-fg-muted">
          <li>Debnath & Kim 2026 — wavelet + adaptive KF architecture (rPPG base paper in Review-1).</li>
          <li>Ahmad & Alkhammash 2024 — OAKF ratchet; no decrease branch, no attribution.</li>
          <li>Quilty & Adamowski 2018 — leakage diagnosis; à trous prescribed.</li>
          <li>Renaud, Starck & Murtagh 2005 — à trous + Kalman on financial series (predictor, not covariances).</li>
          <li>Mehra 1970 / Sage–Husa 1969 — classical adaptive rungs M3 / M4.</li>
          <li>Aït-Sahalia, Mykland & Zhang 2005 — microstructure observation model.</li>
          <li>Bailey & López de Prado 2014 — Deflated Sharpe.</li>
        </ul>
      </Panel>
      <Panel title="Published findings on this repo (honest)" className="mt-4">
        <ul className="space-y-2 text-sm text-fg-muted">
          <li>Audits A and B pass bit-exact. Audit C shows the circular twin leaks at the wrap.</li>
          <li>
            Under paper defaults M6 does not beat M2 on the current Heston generator. M8 (IMM) often
            does. Calibration log: results/calibration.json.
          </li>
          <li>A1 null FAR is 0 HOLD in 2331 ready bars — gate is conservative, not ~1/session yet.</li>
          <li>
            Track B uses 6000 public Binance BTCUSDT 1m bars. Walk-forward Sharpe is per bar and
            negative after 20 bp — economics are a hypothesis.
          </li>
          <li>sharpe_net is per bar. sharpe_net_ann is a separate column. Do not mix them with DSR.</li>
        </ul>
      </Panel>
    </Shell>
  );
}
