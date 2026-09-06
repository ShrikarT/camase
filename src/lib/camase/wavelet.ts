const INV_SQRT2 = 1 / Math.sqrt(2);

export const G0 = [
  -0.010597401784997278, 0.032883011666982945, 0.030841381835986965,
  -0.18703481171888114, -0.02798376941698385, 0.6308807679295904,
  0.7148465705525415, 0.23037781330885523,
].map((x) => x * INV_SQRT2);

export const H0 = [
  -0.23037781330885523, 0.7148465705525415, -0.6308807679295904,
  -0.02798376941698385, 0.18703481171888114, 0.030841381835986965,
  -0.032883011666982945, -0.010597401784997278,
].map((x) => x * INV_SQRT2);

export class CausalAtrous {
  J: number;
  nBuffer: number;
  approx: Float64Array[];
  details: Float64Array[];
  t = -1;

  constructor(J = 4, nBuffer = 512) {
    this.J = J;
    this.nBuffer = nBuffer;
    this.approx = Array.from({ length: J + 1 }, () => new Float64Array(nBuffer));
    this.details = Array.from({ length: J + 1 }, () => new Float64Array(nBuffer));
  }

  reset() {
    for (const b of this.approx) b.fill(0);
    for (const b of this.details) b.fill(0);
    this.t = -1;
  }

  step(y: number): Float64Array {
    this.t += 1;
    const idx = this.t % this.nBuffer;
    this.approx[0][idx] = y;
    const out = new Float64Array(this.J);
    for (let j = 1; j <= this.J; j++) {
      const dilation = 1 << (j - 1);
      let a = 0;
      let d = 0;
      for (let m = 0; m < G0.length; m++) {
        const lag = m * dilation;
        const val = lag > this.t ? 0 : this.approx[j - 1][(this.t - lag) % this.nBuffer];
        a += G0[m] * val;
        d += H0[m] * val;
      }
      this.approx[j][idx] = a;
      this.details[j][idx] = d;
      out[j - 1] = d;
    }
    return out;
  }

  history(level: number, k: number): number[] {
    const out = new Array<number>(k);
    for (let i = 0; i < k; i++) {
      out[i] = this.details[level][(this.t - (k - 1 - i) + this.nBuffer * 8) % this.nBuffer];
    }
    return out;
  }
}

export function batchCausalDetails(y: number[], J = 4): number[][] {
  const eng = new CausalAtrous(J, Math.max(512, y.length + 8));
  const D = Array.from({ length: J }, () => new Array<number>(y.length).fill(0));
  for (let t = 0; t < y.length; t++) {
    const d = eng.step(y[t]);
    for (let j = 0; j < J; j++) D[j][t] = d[j];
  }
  return D;
}

export function circularModwtDetails(y: number[], J = 4): number[][] {
  const T = y.length;
  let A = y.slice();
  const D = Array.from({ length: J }, () => new Array<number>(T).fill(0));
  const L = G0.length;
  const mid = Math.floor((L - 1) / 2);
  for (let j = 1; j <= J; j++) {
    const dilation = 1 << (j - 1);
    const nextA = new Array<number>(T);
    const det = new Array<number>(T);
    for (let t = 0; t < T; t++) {
      let a = 0;
      let d = 0;
      for (let m = 0; m < L; m++) {
        const src = (((t - (m - mid) * dilation) % T) + T) % T;
        a += G0[m] * A[src];
        d += H0[m] * A[src];
      }
      nextA[t] = a;
      det[t] = d;
    }
    D[j - 1] = det;
    A = nextA;
  }
  return D;
}
