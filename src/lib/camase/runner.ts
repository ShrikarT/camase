import { DEFAULT_CONFIG, warmup } from "./config";
import { generateHeston, TrackKind } from "./heston";
import { ModelName, runNamed, scoreRun, Score } from "./models";
import { CamaseEngine, EngineOutput } from "./pipeline";

export type LabPoint = EngineOutput & {
  t: number;
  latent: number;
  price: number;
  jump: boolean;
  regime: boolean;
};

export function runLab(n = 1400, track: TrackKind = "A2", seed = 42, gated = true) {
  const path = generateHeston(n, track, seed);
  const eng = new CamaseEngine(DEFAULT_CONFIG, gated);
  const series: LabPoint[] = [];
  for (let t = 0; t < n; t++) {
    const o = eng.step(path.price[t]);
    series.push({
      ...o,
      t,
      latent: path.latent[t],
      price: path.price[t],
      jump: path.jumpFlags[t],
      regime: path.regimeFlags[t],
    });
  }
  return { series, warmup: warmup(), track, n, path };
}

export function runLadder(n = 1100, track: TrackKind = "A2", seed = 42): Score[] {
  const path = generateHeston(n, track, seed);
  const names: ModelName[] = ["M0", "M1", "M2", "M5", "M6", "M7", "M5'"];
  return names.map((name) => {
    const run = runNamed(name, path.price);
    const nis = (run as { nis?: number[] }).nis;
    return scoreRun(run, path.logObs, path.latent, nis);
  });
}
