export type CamaseConfig = {
  nBuffer: number;
  J: number;
  kVar: number;
  L: number;
  jHigh: number[];
  jLow: number[];
  weights: number[];
  ewmaLambda: number;
  alpha: number;
  beta: number;
  clipR: number;
  clipQ: number;
  R0: number;
  sigmaA0: number;
  dt: number;
  nisWindow: number;
  persistK: number;
  persistM: number;
  chi2Alpha: number;
  cusumKappa: number;
  cusumH: number;
  costRtBp: number;
  maFast: number;
  maSlow: number;
  rollWin: number;
  iaeWin: number;
};

export const DEFAULT_CONFIG: CamaseConfig = {
  nBuffer: 512,
  J: 4,
  kVar: 64,
  L: 8,
  jHigh: [1, 2],
  jLow: [3, 4],
  weights: [1, 1, 1, 1],
  ewmaLambda: 0.992,
  alpha: 1,
  beta: 1,
  clipR: 10,
  clipQ: 10,
  R0: 1.2e-7,
  sigmaA0: 2.5e-7,
  dt: 1,
  nisWindow: 60,
  persistK: 3,
  persistM: 5,
  chi2Alpha: 0.005,
  cusumKappa: 1.6,
  cusumH: 36,
  costRtBp: 20,
  maFast: 8,
  maSlow: 32,
  rollWin: 64,
  iaeWin: 30,
};

export function supportLength(j: number, L = 8): number {
  return (2 ** j - 1) * (L - 1) + 1;
}

export function warmup(cfg: CamaseConfig = DEFAULT_CONFIG): number {
  return supportLength(cfg.J, cfg.L) + cfg.kVar - 1;
}
