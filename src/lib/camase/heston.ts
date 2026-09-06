export type TrackKind = "A1" | "A2" | "A3";

export type HestonPath = {
  latent: number[];
  drift: number[];
  variance: number[];
  price: number[];
  logObs: number[];
  jumpFlags: boolean[];
  regimeFlags: boolean[];
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randn(u: () => number) {
  const a = Math.max(u(), 1e-12);
  const b = u();
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * b);
}

export function generateHeston(
  n = 1800,
  track: TrackKind = "A2",
  seed = 42,
  s0 = 65000,
): HestonPath {
  const u = mulberry32(seed);
  const dt = 1 / (365 * 24 * 60);
  let kappa = 2,
    theta = 0.04,
    xi = 0.35,
    rho = -0.55;
  let jumpRate = 0;
  if (track === "A2") jumpRate = 4;
  if (track === "A3") {
    jumpRate = 8;
    xi = 0.55;
    theta = 0.09;
  }
  const scheduled = new Set<number>();
  if (track === "A2" && n > 800) {
    scheduled.add(Math.floor(n / 5));
    scheduled.add(Math.floor(n / 2));
    scheduled.add(Math.floor((3 * n) / 4));
  }
  let v = theta;
  let logP = Math.log(s0);
  const latent: number[] = [];
  const drift: number[] = [];
  const variance: number[] = [];
  const jumpFlags: boolean[] = [];
  const regimeFlags: boolean[] = [];
  const jumpMu = -0.008;
  const jumpSig = 0.012;

  for (let i = 0; i < n; i++) {
    const inRegime = track === "A2" && i >= n / 3 && i < n / 3 + n / 8;
    regimeFlags.push(inRegime);
    const thetaT = inRegime ? theta * 3.5 : theta;
    const z1 = randn(u);
    const z2 = rho * z1 + Math.sqrt(Math.max(1 - rho * rho, 0)) * randn(u);
    v = Math.max(
      v + kappa * (thetaT - v) * dt + xi * Math.sqrt(Math.max(v, 1e-12)) * Math.sqrt(dt) * z2,
      1e-10,
    );
    let dlog = (0 - 0.5 * v) * dt + Math.sqrt(v) * Math.sqrt(dt) * z1;
    let jumped = false;
    if (scheduled.has(i) || (jumpRate > 0 && u() < jumpRate * dt)) {
      dlog += jumpMu + jumpSig * randn(u);
      jumped = true;
    }
    logP += dlog;
    latent.push(logP);
    drift.push(dlog / dt);
    variance.push(v);
    jumpFlags.push(jumped);
  }

  const med = variance.slice().sort((a, b) => a - b)[Math.floor(n / 2)] || 1e-4;
  const logObs: number[] = [];
  for (let i = 0; i < n; i++) {
    const vs = Math.sqrt(Math.max(variance[i], 1e-12)) / Math.sqrt(med);
    const eta = 0.00018 * vs * randn(u);
    const bounce = (u() < 0.5 ? 1 : -1) * 0.00004 * vs;
    const tick = 1e-5 * randn(u);
    logObs.push(latent[i] + eta + bounce + tick);
  }
  if (track !== "A1") {
    const nOut = Math.max(2, Math.floor(n / 400));
    for (let k = 0; k < nOut; k++) {
      const idx = Math.floor(u() * n);
      logObs[idx] += (u() < 0.5 ? -1 : 1) * (0.004 + u() * 0.008);
    }
  }
  return {
    latent,
    drift,
    variance,
    price: logObs.map(Math.exp),
    logObs,
    jumpFlags,
    regimeFlags,
  };
}
