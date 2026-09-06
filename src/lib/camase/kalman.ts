export type Vec2 = [number, number];

export function transition(dt: number): number[][] {
  return [
    [1, dt],
    [0, 1],
  ];
}

export function processCov(sa2: number, dt: number): number[][] {
  const dt2 = dt * dt;
  const dt3 = dt2 * dt;
  return [
    [(sa2 * dt3) / 3, (sa2 * dt2) / 2],
    [(sa2 * dt2) / 2, sa2 * dt],
  ];
}

function mm(A: number[][], B: number[][]): number[][] {
  return [
    [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
    [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]],
  ];
}

function mt(A: number[][]): number[][] {
  return [
    [A[0][0], A[1][0]],
    [A[0][1], A[1][1]],
  ];
}

function madd(A: number[][], B: number[][]): number[][] {
  return [
    [A[0][0] + B[0][0], A[0][1] + B[0][1]],
    [A[1][0] + B[1][0], A[1][1] + B[1][1]],
  ];
}

export class KalmanIRW {
  x: Vec2 = [0, 0];
  P: number[][] = [
    [1e-4, 0],
    [0, 1e-6],
  ];
  lastS = 1;
  lastInnov = 0;
  lastNis = 1;

  predict(F: number[][], Q: number[][]) {
    this.x = [F[0][0] * this.x[0] + F[0][1] * this.x[1], F[1][0] * this.x[0] + F[1][1] * this.x[1]];
    const FP = mm(F, this.P);
    this.P = madd(mm(FP, mt(F)), Q);
    const s = 0.5 * (this.P[0][1] + this.P[1][0]);
    this.P[0][1] = s;
    this.P[1][0] = s;
  }

  updateJoseph(y: number, R: number): number {
    const innov = y - this.x[0];
    let S = this.P[0][0] + R;
    if (S <= 1e-18) S = 1e-18;
    const K0 = this.P[0][0] / S;
    const K1 = this.P[1][0] / S;
    this.x[0] += K0 * innov;
    this.x[1] += K1 * innov;
    const IKH = [
      [1 - K0, 0],
      [-K1, 1],
    ];
    const mid = mm(mm(IKH, this.P), mt(IKH));
    const krk = [
      [K0 * R * K0, K0 * R * K1],
      [K1 * R * K0, K1 * R * K1],
    ];
    this.P = madd(mid, krk);
    const s = 0.5 * (this.P[0][1] + this.P[1][0]);
    this.P[0][1] = s;
    this.P[1][0] = s;
    this.lastS = S;
    this.lastInnov = innov;
    this.lastNis = (innov * innov) / S;
    return this.lastNis;
  }

  oneStepPred(F: number[][]): number {
    return F[0][0] * this.x[0] + F[0][1] * this.x[1];
  }
}
