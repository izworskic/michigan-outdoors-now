import { readFile } from "node:fs/promises";
import process from "node:process";

type Criterion = { key: string; weight: number };
type Benchmark = {
  name: string;
  baselineScore: number;
  releaseTarget: number;
  flagshipTarget: number;
  criteria: Criterion[];
};

async function main() {
  const root = new URL("../", import.meta.url);
  const benchmark = JSON.parse(
    await readFile(new URL("benchmarks/result-flow-refinement.json", root), "utf8"),
  ) as Benchmark;

  const files = Object.fromEntries(
    await Promise.all([
      "src/components/outdoor-intent-hub.tsx",
      "src/app/api/discover/route.ts",
      "src/app/atlas.css",
      "tests/result-flow-refinement.test.ts",
      "scripts/runtime-check.mjs",
    ].map(async (path) => [path, await readFile(new URL(path, root), "utf8")])),
  ) as Record<string, string>;

  const hub = files["src/components/outdoor-intent-hub.tsx"];
  const route = files["src/app/api/discover/route.ts"];
  const css = files["src/app/atlas.css"];
  const tests = files["tests/result-flow-refinement.test.ts"];
  const runtime = files["scripts/runtime-check.mjs"];

  const checks: Record<string, boolean> = {
    persistentResultDock:
      hub.includes('className="canvas-result-dock"') &&
      hub.includes('className="canvas-result-rail"') &&
      hub.includes("discovery.places.slice(0, 8)") &&
      css.includes(".canvas-result-dock{") &&
      css.includes("scroll-snap-type:x proximity"),
    detailReturnsToDock:
      hub.includes("canvas-sheet-discovery") &&
      hub.includes('aria-label="Close place detail"') &&
      hub.includes("activateDiscovery(place.id)") &&
      css.includes(".canvas-sheet-discovery{"),
    fartherUsesNewBand:
      hub.includes("const previousMax = driveHours") &&
      hub.includes("delta > 0 ? previousMax : 0") &&
      hub.includes("minDriveHours: minDriveOverride") &&
      route.includes("minDriveHours?: number"),
    newlyUnlockedResultsFirst:
      route.includes("place.driveHours + 0.05 >= minDriveHours") &&
      route.includes("metrics.driveHours + 0.05 < args.minDriveHours") &&
      runtime.includes("minDriveHours: 2") &&
      runtime.includes("farther-band discovery returned a place inside the previous travel range"),
    rangeStateVisible:
      hub.includes("Farther-out results") &&
      hub.includes("Up to " + "$" + "{driveHours} hr from your start") &&
      hub.includes("Show all within {driveHours} hr"),
    responsiveNonOverlap:
      css.includes(".canvas-sheet-discovery{\n  bottom:154px;") &&
      css.includes(".canvas-result-dock{") &&
      /@media\(max-width:700px\)[\s\S]*?\.canvas-sheet-discovery\{[\s\S]*?position:fixed;[\s\S]*?bottom:148px;[\s\S]*?max-height:44svh;/.test(css),
    regressionCoverage:
      tests.includes("persistent map dock") &&
      tests.includes("newly unlocked distance band") &&
      runtime.includes("fartherDiscovery"),
  };

  const scored = benchmark.criteria.map((criterion) => ({
    ...criterion,
    passed: Boolean(checks[criterion.key]),
    score: checks[criterion.key] ? criterion.weight : 0,
  }));
  const score = scored.reduce((sum, item) => sum + item.score, 0);
  const critical = [
    "persistentResultDock",
    "fartherUsesNewBand",
    "newlyUnlockedResultsFirst",
    "responsiveNonOverlap",
  ].filter((key) => !checks[key]);

  console.log(JSON.stringify({
    benchmark: benchmark.name,
    baselineScore: benchmark.baselineScore,
    score,
    releaseTarget: benchmark.releaseTarget,
    flagshipTarget: benchmark.flagshipTarget,
    deltaFromBaseline: score - benchmark.baselineScore,
    criteria: scored,
    criticalFailures: critical,
  }, null, 2));

  if (score < benchmark.releaseTarget || critical.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
