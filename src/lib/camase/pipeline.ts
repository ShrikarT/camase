import { CamaseConfig, DEFAULT_CONFIG, warmup } from "./config";
import { KalmanIRW, processCov, transition } from "./kalman";
import { CausalAtrous } from "./wavelet";

function variance(xs: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  let m = 0;
  for (const x of xs) m += x;
  m /= n;
  let s = 0;
  for (const x of xs) s += (x - m) * (x - m);
  return s / (n - 1);
}

function clipRatio(ratio: number, cap: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.min(cap, Math.max(1 / cap, ratio));
}

/** χ²_{60, 0.99} / 60 ≈ 1.473 — fixed for the default M, α pair. */
export const GAMMA_M60 = 1.473;

export type EngineOutput = {
  ready: boolean;
  action: "TRADE" | "HOLD";
  y: number;
  pHat: number;
  vHat: number;
  Rt: number;
  sa2: number;
  rho: number;
  nisAdapt: number;
  nisShadow: number;
  nu: number;
  gamma: number;
  cusum: number;
  alarm: boolean;
  details: number[];
};

export class CamaseEngine {
  cfg: CamaseConfig;
  gated: boolean;
  cascade: CausalAtrous;
  ad = new KalmanIRW();
  sh = new KalmanIRW();
  t = -1;
  readyT: number;
  barH = 0;
  barL = 0;
  primed = false;
  nisWin: number[] = [];
  exceed: boolean[] = [];
  g = 0;
  gamma: number;

  constructor(cfg: CamaseConfig = DEFAULT_CONFIG, gated = true) {
    this.cfg = cfg;
    this.gated = gated;
    this.cascade = new CausalAtrous(cfg.J, cfg.nBuffer);
    this.readyT = warmup(cfg);
    this.gamma = GAMMA_M60;
  }

  reset() {
    this.cascade.reset();
    this.ad = new KalmanIRW();
    this.sh = new KalmanIRW();
    this.t = -1;
    this.barH = 0;
    this.barL = 0;
    this.primed = false;
    this.nisWin = [];
    this.exceed = [];
    this.g = 0;
  }

  step(price: number, dt?: number): EngineOutput {
    const dtt = dt ?? this.cfg.dt;
    const y = Math.log(Math.max(price, 1e-12));
    this.t += 1;
    const details = Array.from(this.cascade.step(y));
    const F = transition(dtt);
    const Q0 = processCov(this.cfg.sigmaA0, dtt);

    if (this.t < this.readyT) {
      this.ad.predict(F, Q0);
      this.ad.updateJoseph(y, this.cfg.R0);
      this.sh.predict(F, Q0);
      this.sh.updateJoseph(y, this.cfg.R0);
      return {
        ready: false,
        action: "HOLD",
        y,
        pHat: this.ad.x[0],
        vHat: this.ad.x[1],
        Rt: this.cfg.R0,
        sa2: this.cfg.sigmaA0,
        rho: 0.5,
        nisAdapt: this.ad.lastNis,
        nisShadow: this.sh.lastNis,
        nu: 1,
        gamma: this.gamma,
        cusum: 0,
        alarm: false,
        details,
      };
    }

    const varsJ: number[] = [];
    for (let j = 1; j <= this.cfg.J; j++) {
      varsJ.push(variance(this.cascade.history(j, this.cfg.kVar)));
    }
    let eH = 0;
    let eL = 0;
    for (const j of this.cfg.jHigh) eH += this.cfg.weights[j - 1] * varsJ[j - 1];
    for (const j of this.cfg.jLow) eL += this.cfg.weights[j - 1] * varsJ[j - 1];
    if (!this.primed) {
      this.barH = Math.max(eH, 1e-18);
      this.barL = Math.max(eL, 1e-18);
      this.primed = true;
    } else {
      const lam = this.cfg.ewmaLambda;
      this.barH = lam * this.barH + (1 - lam) * eH;
      this.barL = lam * this.barL + (1 - lam) * eL;
    }
    const Rt =
      this.cfg.R0 *
      clipRatio((eH / Math.max(this.barH, 1e-18)) ** this.cfg.alpha, this.cfg.clipR);
    const sa2 =
      this.cfg.sigmaA0 *
      clipRatio((eL / Math.max(this.barL, 1e-18)) ** this.cfg.beta, this.cfg.clipQ);
    const rho = eH / (eH + eL + 1e-18);

    this.ad.predict(F, processCov(sa2, dtt));
    const nisAd = this.ad.updateJoseph(y, Rt);

    this.sh.predict(F, Q0);
    const S0 = this.sh.P[0][0] + this.cfg.R0;
    const nis0 = ((y - this.sh.x[0]) ** 2) / (S0 || 1e-18);
    this.sh.updateJoseph(y, this.cfg.R0);

    this.nisWin.push(nis0);
    if (this.nisWin.length > this.cfg.nisWindow) this.nisWin.shift();
    const nu = this.nisWin.reduce((a, b) => a + b, 0) / this.nisWin.length;
    this.g = Math.max(0, this.g + nis0 - this.cfg.cusumKappa);
    const over = nu > this.gamma;
    this.exceed.push(over);
    if (this.exceed.length > this.cfg.persistM) this.exceed.shift();
    const hits = this.exceed.filter(Boolean).length;
    const persist = hits >= this.cfg.persistK && this.exceed.length >= this.cfg.persistK;
    const alarm = this.gated && (persist || this.g > this.cfg.cusumH);

    return {
      ready: true,
      action: alarm ? "HOLD" : "TRADE",
      y,
      pHat: this.ad.x[0],
      vHat: this.ad.x[1],
      Rt,
      sa2,
      rho,
      nisAdapt: nisAd,
      nisShadow: nis0,
      nu,
      gamma: this.gamma,
      cusum: this.g,
      alarm,
      details,
    };
  }
}
