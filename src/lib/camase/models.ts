import { CamaseConfig, DEFAULT_CONFIG, warmup } from "./config";
import { KalmanIRW, processCov, transition } from "./kalman";
import { CamaseEngine } from "./pipeline";
import { batchCausalDetails, circularModwtDetails } from "./wavelet";
import { IMMFilter } from "./imm";
import { UnscentedIRW } from "./ukf";

export type ModelName =
  | "M0"
  | "M1"
  | "M2"
  | "M3"
  | "M4"
  | "M4b"
  | "M5"
  | "M6"
  | "M7"
  | "M5'"
  | "M6'"
  | "M8"
  | "M9";

export type ModelRun = {
  name: string;
  pHat: number[];
  vHat: number[];
  ready: boolean[];
  action: ("TRADE" | "HOLD")[];
  pred: number[];
};

function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1);
}

export type Score = {
  model: string;
  rmseP: number;
  snrDb: number;
  meanNis: number;
  mspe: number;
  timeInMarket: number;
};

export function scoreRun(
  run: ModelRun,
  logObs: number[],
  latent: number[],
  nis?: number[],
): Score {
  let se = 0,
    n = 0,
    num = 0,
    den = 0,
    mspe = 0,
    nm = 0,
    nisSum = 0,
    nisN = 0,
    trade = 0;
  for (let t = 0; t < run.pHat.length; t++) {
    if (!run.ready[t] || !Number.isFinite(run.pHat[t])) continue;
    const e = run.pHat[t] - latent[t];
    se += e * e;
    num += (logObs[t] - latent[t]) ** 2;
    den += e * e;
    n += 1;
    if (Number.isFinite(run.pred[t]) && t > 0) {
      mspe += (logObs[t] - run.pred[t]) ** 2;
      nm += 1;
    }
    if (nis && Number.isFinite(nis[t])) {
      nisSum += nis[t];
      nisN += 1;
    }
    if (run.action[t] === "TRADE") trade += 1;
  }
  return {
    model: run.name,
    rmseP: n ? Math.sqrt(se / n) : NaN,
    snrDb: den > 0 && num > 0 ? 10 * Math.log10(num / den) : NaN,
    meanNis: nisN ? nisSum / nisN : NaN,
    mspe: nm ? mspe / nm : NaN,
    timeInMarket: n ? trade / n : 0,
  };
}

export function runM0(prices: number[], cfg: CamaseConfig = DEFAULT_CONFIG): ModelRun {
  const y = prices.map((p) => Math.log(Math.max(p, 1e-12)));
  const n = y.length;
  const pHat = new Array(n).fill(NaN);
  const vHat = new Array(n).fill(NaN);
  const ready = new Array(n).fill(false);
  const action: ("TRADE" | "HOLD")[] = Array(n).fill("HOLD");
  const pred = new Array(n).fill(NaN);
  const c = [0];
  for (let i = 0; i < n; i++) c.push(c[i] + y[i]);
  for (let t = 0; t < n; t++) {
    if (t + 1 < cfg.maSlow) continue;
    const mf = (c[t + 1] - c[t + 1 - cfg.maFast]) / cfg.maFast;
    const ms = (c[t + 1] - c[t + 1 - cfg.maSlow]) / cfg.maSlow;
    pHat[t] = mf;
    vHat[t] = mf - ms;
    pred[t] = mf;
    ready[t] = true;
    action[t] = mf > ms ? "TRADE" : "HOLD";
  }
  return { name: "M0", pHat, vHat, ready, action, pred };
}

function runStatic(prices: number[], cfg: CamaseConfig, name: string): ModelRun {
  const y = prices.map((p) => Math.log(Math.max(p, 1e-12)));
  const n = y.length;
  const kf = new KalmanIRW();
  const F = transition(cfg.dt);
  const Q = processCov(cfg.sigmaA0, cfg.dt);
  const pHat = new Array(n).fill(NaN);
  const vHat = new Array(n).fill(0);
  const ready = new Array(n).fill(false);
  const action: ("TRADE" | "HOLD")[] = Array(n).fill("TRADE");
  const pred = new Array(n).fill(NaN);
  const nis: number[] = [];
  for (let t = 0; t < n; t++) {
    pred[t] = kf.oneStepPred(F);
    kf.predict(F, Q);
    kf.updateJoseph(y[t], cfg.R0);
    pHat[t] = kf.x[0];
    vHat[t] = kf.x[1];
    ready[t] = t >= 2;
    nis.push(kf.lastNis);
  }
  const run = { name, pHat, vHat, ready, action, pred };
  (run as ModelRun & { nis: number[] }).nis = nis;
  return run;
}

export function runEngine(prices: number[], cfg: CamaseConfig, name: "M6" | "M7"): ModelRun {
  const eng = new CamaseEngine(cfg, name === "M7");
  const n = prices.length;
  const F = transition(cfg.dt);
  let prev: [number, number] = [0, 0];
  const pHat = new Array(n).fill(NaN);
  const vHat = new Array(n).fill(0);
  const ready = new Array(n).fill(false);
  const action: ("TRADE" | "HOLD")[] = Array(n).fill("HOLD");
  const pred = new Array(n).fill(NaN);
  const nis: number[] = [];
  for (let t = 0; t < n; t++) {
    pred[t] = F[0][0] * prev[0] + F[0][1] * prev[1];
    const o = eng.step(prices[t]);
    prev = [o.pHat, o.vHat];
    pHat[t] = o.pHat;
    vHat[t] = o.vHat;
    ready[t] = o.ready;
    action[t] = o.action;
    nis.push(o.nisAdapt);
  }
  const run = { name, pHat, vHat, ready, action, pred };
  (run as ModelRun & { nis: number[] }).nis = nis;
  return run;
}

export function runM2(prices: number[], cfg: CamaseConfig = DEFAULT_CONFIG): ModelRun {
  const y = prices.map((p) => Math.log(Math.max(p, 1e-12)));
  const n = y.length;
  const kf = new KalmanIRW();
  const F = transition(cfg.dt);
  const pHat = new Array(n).fill(NaN);
  const vHat = new Array(n).fill(0);
  const ready = new Array(n).fill(false);
  const action: ("TRADE" | "HOLD")[] = Array(n).fill("TRADE");
  const pred = new Array(n).fill(NaN);
  const nis: number[] = [];
  const dy = y.map((v, i) => (i === 0 ? 0 : v - y[i - 1]));
  for (let t = 0; t < n; t++) {
    const w0 = Math.max(0, t - cfg.rollWin + 1);
    const sl = dy.slice(w0, t + 1);
    const sig = sl.length > 5 ? Math.sqrt(variance(sl)) : Math.sqrt(cfg.R0);
    const R = Math.min(cfg.R0 * cfg.clipR, Math.max(cfg.R0 / cfg.clipR, sig * sig));
    pred[t] = kf.oneStepPred(F);
    kf.predict(F, processCov(cfg.sigmaA0, cfg.dt));
    kf.updateJoseph(y[t], R);
    pHat[t] = kf.x[0];
    vHat[t] = kf.x[1];
    ready[t] = t >= cfg.rollWin;
    nis.push(kf.lastNis);
  }
  const run = { name: "M2", pHat, vHat, ready, action, pred };
  (run as ModelRun & { nis: number[] }).nis = nis;
  return run;
}

export function runM5(
  prices: number[],
  cfg: CamaseConfig = DEFAULT_CONFIG,
  leaky = false,
): ModelRun {
  const y = prices.map((p) => Math.log(Math.max(p, 1e-12)));
  const D = leaky ? circularModwtDetails(y, cfg.J) : batchCausalDetails(y, cfg.J);
  const n = y.length;
  const kf = new KalmanIRW();
  const F = transition(cfg.dt);
  const pHat = new Array(n).fill(NaN);
  const vHat = new Array(n).fill(0);
  const ready = new Array(n).fill(false);
  const action: ("TRADE" | "HOLD")[] = Array(n).fill("TRADE");
  const pred = new Array(n).fill(NaN);
  const nis: number[] = [];
  let bar: number | null = null;
  const warm = leaky ? cfg.kVar : warmup(cfg);
  for (let t = 0; t < n; t++) {
    let R = cfg.R0;
    const ok = t >= warm;
    if (ok) {
      const sl = D[0].slice(t - cfg.kVar + 1, t + 1);
      const e = variance(sl);
      bar = bar === null ? e : cfg.ewmaLambda * bar + (1 - cfg.ewmaLambda) * e;
      const ratio = Math.min(cfg.clipR, Math.max(1 / cfg.clipR, (e / Math.max(bar, 1e-18)) ** cfg.alpha));
      R = cfg.R0 * ratio;
    }
    pred[t] = kf.oneStepPred(F);
    kf.predict(F, processCov(cfg.sigmaA0, cfg.dt));
    kf.updateJoseph(y[t], R);
    pHat[t] = kf.x[0];
    vHat[t] = kf.x[1];
    ready[t] = ok;
    nis.push(kf.lastNis);
  }
  const run = { name: leaky ? "M5'" : "M5", pHat, vHat, ready, action, pred };
  (run as ModelRun & { nis: number[] }).nis = nis;
  return run;
}

export function runM8(prices: number[], cfg: CamaseConfig = DEFAULT_CONFIG): ModelRun {
  const y = prices.map((p) => Math.log(Math.max(p, 1e-12)));
  const n = y.length;
  const imm = new IMMFilter(cfg.R0, cfg.sigmaA0, cfg.dt);
  const pHat = new Array(n).fill(NaN);
  const vHat = new Array(n).fill(0);
  const ready = new Array(n).fill(false);
  const action: ("TRADE" | "HOLD")[] = Array(n).fill("TRADE");
  const pred = new Array(n).fill(NaN);
  const nis: number[] = [];
  for (let t = 0; t < n; t++) {
    pred[t] = imm.lastPred;
    const x = imm.step(y[t]);
    pHat[t] = x[0];
    vHat[t] = x[1];
    ready[t] = t >= 5;
    nis.push(imm.lastNis);
  }
  const run = { name: "M8", pHat, vHat, ready, action, pred };
  (run as ModelRun & { nis: number[] }).nis = nis;
  return run;
}

export function runM9(prices: number[], cfg: CamaseConfig = DEFAULT_CONFIG): ModelRun {
  const y = prices.map((p) => Math.log(Math.max(p, 1e-12)));
  const n = y.length;
  const ukf = new UnscentedIRW();
  const F = transition(cfg.dt);
  const Q = processCov(cfg.sigmaA0, cfg.dt);
  const pHat = new Array(n).fill(NaN);
  const vHat = new Array(n).fill(0);
  const ready = new Array(n).fill(false);
  const action: ("TRADE" | "HOLD")[] = Array(n).fill("TRADE");
  const pred = new Array(n).fill(NaN);
  const nis: number[] = [];
  for (let t = 0; t < n; t++) {
    pred[t] = ukf.oneStepPred(F);
    ukf.predict(F, Q);
    ukf.update(y[t], cfg.R0);
    pHat[t] = ukf.x[0];
    vHat[t] = ukf.x[1];
    ready[t] = t >= 2;
    nis.push(ukf.lastNis);
  }
  const run = { name: "M9", pHat, vHat, ready, action, pred };
  (run as ModelRun & { nis: number[] }).nis = nis;
  return run;
}

export function runNamed(name: ModelName, prices: number[], cfg: CamaseConfig = DEFAULT_CONFIG): ModelRun {
  switch (name) {
    case "M0":
      return runM0(prices, cfg);
    case "M1":
      return runStatic(prices, cfg, "M1");
    case "M2":
      return runM2(prices, cfg);
    case "M3":
      return runStatic(prices, cfg, "M3");
    case "M4":
      return runStatic(prices, cfg, "M4");
    case "M4b":
      return runStatic(prices, cfg, "M4b");
    case "M5":
      return runM5(prices, cfg, false);
    case "M5'":
      return runM5(prices, cfg, true);
    case "M6":
      return runEngine(prices, cfg, "M6");
    case "M6'":
      return runM5(prices, cfg, true);
    case "M7":
      return runEngine(prices, cfg, "M7");
    case "M8":
      return runM8(prices, cfg);
    case "M9":
      return runM9(prices, cfg);
    default:
      return runStatic(prices, cfg, name);
  }
}
