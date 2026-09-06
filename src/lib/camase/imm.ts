import { KalmanIRW, processCov, transition } from "./kalman";

const SCALES = [0.3, 1.0, 3.0];
const N = 3;
const STAY = 0.92;

export function transitionMatrix(stay = STAY): number[][] {
  const off = (1 - stay) / (N - 1);
  return Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => (i === j ? stay : off)),
  );
}

export class IMMFilter {
  R0: number;
  sigmaA0: number;
  dt: number;
  mu: number[] = [1 / 3, 1 / 3, 1 / 3];
  filters: KalmanIRW[] = [new KalmanIRW(), new KalmanIRW(), new KalmanIRW()];
  Pi = transitionMatrix();
  lastNis = 1;
  lastPred = 0;
  private cbar = [1 / 3, 1 / 3, 1 / 3];

  constructor(R0: number, sigmaA0: number, dt = 1) {
    this.R0 = R0;
    this.sigmaA0 = sigmaA0;
    this.dt = dt;
  }

  get x(): [number, number] {
    return [
      this.mu[0] * this.filters[0].x[0] + this.mu[1] * this.filters[1].x[0] + this.mu[2] * this.filters[2].x[0],
      this.mu[0] * this.filters[0].x[1] + this.mu[1] * this.filters[1].x[1] + this.mu[2] * this.filters[2].x[1],
    ];
  }

  modeR(): number[] {
    return SCALES.map((s) => s * this.R0);
  }
  modeSa(): number[] {
    return SCALES.map((s) => s * this.sigmaA0);
  }

  mix() {
    const cbar = [0, 0, 0];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) cbar[j] += this.Pi[i][j] * this.mu[i];
      cbar[j] = Math.max(cbar[j], 1e-16);
    }
    this.cbar = cbar;
    const xs = this.filters.map((f) => [...f.x] as [number, number]);
    const Ps = this.filters.map((f) => f.P.map((row) => [...row]));
    for (let j = 0; j < N; j++) {
      const xj: [number, number] = [0, 0];
      for (let i = 0; i < N; i++) {
        const w = (this.Pi[i][j] * this.mu[i]) / cbar[j];
        xj[0] += w * xs[i][0];
        xj[1] += w * xs[i][1];
      }
      const Pj = [
        [0, 0],
        [0, 0],
      ];
      for (let i = 0; i < N; i++) {
        const w = (this.Pi[i][j] * this.mu[i]) / cbar[j];
        const d0 = xs[i][0] - xj[0];
        const d1 = xs[i][1] - xj[1];
        Pj[0][0] += w * (Ps[i][0][0] + d0 * d0);
        Pj[0][1] += w * (Ps[i][0][1] + d0 * d1);
        Pj[1][0] += w * (Ps[i][1][0] + d1 * d0);
        Pj[1][1] += w * (Ps[i][1][1] + d1 * d1);
      }
      this.filters[j].x = xj;
      this.filters[j].P = Pj;
    }
  }

  step(y: number): [number, number] {
    const F = transition(this.dt);
    const x = this.x;
    this.lastPred = F[0][0] * x[0] + F[0][1] * x[1];
    this.mix();
    const likes = [0, 0, 0];
    const R = this.modeR();
    const sa = this.modeSa();
    for (let j = 0; j < N; j++) {
      this.filters[j].predict(F, processCov(sa[j], this.dt));
      this.filters[j].updateJoseph(y, R[j]);
      const S = Math.max(this.filters[j].lastS, 1e-18);
      const inn = this.filters[j].lastInnov;
      likes[j] = Math.exp(-0.5 * (inn * inn) / S) / Math.sqrt(2 * Math.PI * S);
    }
    let s = 0;
    const post = this.cbar.map((c, j) => {
      const v = likes[j] * c;
      s += v;
      return v;
    });
    this.mu = s > 0 ? post.map((v) => v / s) : [1 / 3, 1 / 3, 1 / 3];
    let Sm = 0;
    for (let j = 0; j < N; j++) Sm += this.mu[j] * this.filters[j].lastS;
    const innov = y - this.lastPred;
    this.lastNis = (innov * innov) / Math.max(Sm, 1e-18);
    return this.x;
  }
}
