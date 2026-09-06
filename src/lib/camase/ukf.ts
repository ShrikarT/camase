import { processCov, transition } from "./kalman";

function cholPsd(P: number[][]): number[][] {
  const a = 0.5 * (P[0][0] + P[0][0]);
  const b = 0.5 * (P[0][1] + P[1][0]);
  const c = P[1][1];
  const S = [
    [a, b],
    [b, c],
  ];
  // 2x2 Cholesky
  const l00 = Math.sqrt(Math.max(S[0][0], 1e-18));
  const l10 = S[1][0] / l00;
  const l11 = Math.sqrt(Math.max(S[1][1] - l10 * l10, 1e-18));
  return [
    [l00, 0],
    [l10, l11],
  ];
}

export class UnscentedIRW {
  x: [number, number] = [0, 0];
  P: number[][] = [
    [1e-4, 0],
    [0, 1e-6],
  ];
  alpha = 1e-3;
  beta = 2;
  kappa = 0;
  lastNis = 1;

  get nSigma() {
    return 5;
  }

  weights(): { wm: number[]; wc: number[]; c: number } {
    const n = 2;
    const lam = this.alpha * this.alpha * (n + this.kappa) - n;
    const c = n + lam;
    const wm = Array(5).fill(1 / (2 * c));
    const wc = [...wm];
    wm[0] = lam / c;
    wc[0] = lam / c + (1 - this.alpha * this.alpha + this.beta);
    return { wm, wc, c };
  }

  sigmaPoints(): number[][] {
    const { c } = this.weights();
    const L = cholPsd([
      [c * this.P[0][0], c * this.P[0][1]],
      [c * this.P[1][0], c * this.P[1][1]],
    ]);
    // columns of L
    const c0: [number, number] = [L[0][0], L[1][0]];
    const c1: [number, number] = [L[0][1], L[1][1]];
    return [
      [this.x[0], this.x[1]],
      [this.x[0] + c0[0], this.x[1] + c0[1]],
      [this.x[0] + c1[0], this.x[1] + c1[1]],
      [this.x[0] - c0[0], this.x[1] - c0[1]],
      [this.x[0] - c1[0], this.x[1] - c1[1]],
    ];
  }

  predict(F: number[][], Q: number[][]) {
    const { wm, wc } = this.weights();
    const sig = this.sigmaPoints();
    const prop = sig.map((s) => [F[0][0] * s[0] + F[0][1] * s[1], F[1][0] * s[0] + F[1][1] * s[1]]);
    this.x = [0, 0];
    for (let i = 0; i < 5; i++) {
      this.x[0] += wm[i] * prop[i][0];
      this.x[1] += wm[i] * prop[i][1];
    }
    this.P = [
      [Q[0][0], Q[0][1]],
      [Q[1][0], Q[1][1]],
    ];
    for (let i = 0; i < 5; i++) {
      const d0 = prop[i][0] - this.x[0];
      const d1 = prop[i][1] - this.x[1];
      this.P[0][0] += wc[i] * d0 * d0;
      this.P[0][1] += wc[i] * d0 * d1;
      this.P[1][0] += wc[i] * d1 * d0;
      this.P[1][1] += wc[i] * d1 * d1;
    }
  }

  update(y: number, R: number) {
    const { wm, wc } = this.weights();
    const sig = this.sigmaPoints();
    const yi = sig.map((s) => s[0]);
    let yhat = 0;
    for (let i = 0; i < 5; i++) yhat += wm[i] * yi[i];
    let S = R;
    let Pxy0 = 0;
    let Pxy1 = 0;
    for (let i = 0; i < 5; i++) {
      const dy = yi[i] - yhat;
      S += wc[i] * dy * dy;
      Pxy0 += wc[i] * (sig[i][0] - this.x[0]) * dy;
      Pxy1 += wc[i] * (sig[i][1] - this.x[1]) * dy;
    }
    if (S <= 1e-18) S = 1e-18;
    const K0 = Pxy0 / S;
    const K1 = Pxy1 / S;
    const innov = y - yhat;
    this.x[0] += K0 * innov;
    this.x[1] += K1 * innov;
    this.P[0][0] -= S * K0 * K0;
    this.P[0][1] -= S * K0 * K1;
    this.P[1][0] -= S * K1 * K0;
    this.P[1][1] -= S * K1 * K1;
    this.lastNis = (innov * innov) / S;
    return this.lastNis;
  }

  oneStepPred(F: number[][]) {
    return F[0][0] * this.x[0] + F[0][1] * this.x[1];
  }
}

export { processCov, transition };
