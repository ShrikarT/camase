import { batchCausalDetails, CausalAtrous, circularModwtDetails } from "./wavelet";
import { supportLength } from "./config";

export type AuditResult = {
  name: string;
  passed: boolean;
  detail: string;
  nChecked: number;
};

function walk(n: number, seed: number): number[] {
  let s = seed >>> 0;
  const u = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const y = new Array<number>(n);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += (u() * 2 - 1) * 0.001;
    y[i] = acc;
  }
  return y;
}

export function auditA(n = 180, J = 4): AuditResult {
  const y = walk(n, 7);
  const D = batchCausalDetails(y, J);
  let nChecked = 0;
  const step = Math.max(1, Math.floor((n - 48) / 10));
  for (let t = 40; t < n - 8; t += step) {
    const y2 = y.slice();
    for (let s = t + 1; s < n; s++) y2[s] = 1e9;
    const D2 = batchCausalDetails(y2, J);
    nChecked += J;
    for (let j = 0; j < J; j++) {
      if (D[j][t] !== D2[j][t]) {
        return { name: "A", passed: false, detail: `mismatch at t=${t} level ${j + 1}`, nChecked };
      }
    }
  }
  return { name: "A", passed: true, detail: `bitwise match across probes × ${J} levels`, nChecked };
}

export function auditB(n = 90, J = 4): AuditResult {
  const y = walk(n, 11);
  const stream = new CausalAtrous(J, Math.max(512, n + 8));
  let nChecked = 0;
  for (let t = 0; t < n; t++) {
    const dStream = stream.step(y[t]);
    const fresh = new CausalAtrous(J, Math.max(512, t + 16));
    let dPrefix = new Float64Array(J);
    for (let s = 0; s <= t; s++) dPrefix = fresh.step(y[s]);
    nChecked += J;
    for (let j = 0; j < J; j++) {
      if (dStream[j] !== dPrefix[j]) {
        return { name: "B", passed: false, detail: `mismatch at t=${t}`, nChecked };
      }
    }
  }
  return { name: "B", passed: true, detail: `streaming ≡ prefix on ${n} samples`, nChecked };
}

export function auditC(n = 256, J = 4): AuditResult {
  const y = walk(n, 3);
  const causal = batchCausalDetails(y, J);
  const leaky = circularModwtDetails(y, J);
  let edge = 0;
  for (let j = 0; j < J; j++) {
    edge = Math.max(edge, Math.abs(causal[j][0] - leaky[j][0]), Math.abs(causal[j][n - 1] - leaky[j][n - 1]));
  }
  return {
    name: "C",
    passed: edge > 0,
    detail: `boundary max|Δ|=${edge.toExponential(3)} (nonzero = leakage present in circular twin)`,
    nChecked: n,
  };
}

export function runAllAudits(): AuditResult[] {
  return [auditA(), auditB(), auditC()];
}

export function supportTable() {
  return [1, 2, 3, 4].map((j) => ({
    j,
    Lj: supportLength(j),
    history: supportLength(j) + 64 - 1,
  }));
}
