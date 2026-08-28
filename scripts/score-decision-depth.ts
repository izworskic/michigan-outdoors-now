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
    await readFile(new URL("benchmarks/decision-depth.json", root), "utf8"),
  ) as Benchmark;

  const files = Object.fromEntries(
    await Promise.all([
      "src/lib/discovery.ts",
      "src/app/api/discover/route.ts",
      "src/components/outdoor-intent-hub.tsx",
      "src/app/atlas.css",
      "tests/discovery.test.ts",
      "tests/result-flow-refinement.test.ts",
      "docs/decision-depth.md",
    ].map(async (path) => [path, await readFile(new URL(path, root), "utf8")])),
  ) as Record<string, string>;

  const discovery = files["src/lib/discovery.ts"];
  const route = files["src/app/api/discover/route.ts"];
  const hub = files["src/components/outdoor-intent-hub.tsx"];
  const css = files["src/app/atlas.css"];
  const discoveryTests = files["tests/discovery.test.ts"];
  const resultTests = files["tests/result-flow-refinement.test.ts"];
  const doc = files["docs/decision-depth.md"];

  const checks: Record<string, boolean> = {
    effortIntent:
      discovery.includes('| "long"') &&
      discovery.includes('["long", ["long hike", "long walk", "long trail"') &&
      discovery.includes("destinationEffortFit") &&
      discoveryTests.includes("long-hike intent favors stronger backcountry signals"),
    shortlistUpToThree:
      hub.includes("comparisonPlaces") &&
      hub.includes("if (comparisonPlaces.length >= 3)") &&
      hub.includes("Keep up to three places at a time") &&
      hub.includes("Keep to compare"),
    compareBoard:
      hub.includes('className="canvas-compare"') &&
      hub.includes("Compare before you commit.") &&
      hub.includes("comparisonPlaces.map((place)") &&
      css.includes(".canvas-compare{") &&
      css.includes(".canvas-compare-grid{"),
    shortlistSurvivesFartherSearch:
      hub.includes("runDiscovery(discovery.query, next, delta > 0 ? previousMax : 0)") &&
      !/function changeRange[\s\S]*?setComparisonPlaces\(\[\]\)/.test(hub) &&
      doc.includes("Keep those places while expanding the search farther"),
    planningDepthVisible:
      hub.includes('place.curatedPlaceId ? "Full guide" : "Mapped lead"') &&
      hub.includes("route length, access, and current conditions still need verification"),
    roughDriveHonesty:
      hub.includes("~{driveTimeLabel(place.driveHours)} drive") &&
      hub.includes("Drive times are rough planning estimates") &&
      route.includes("Drive times are rough planning estimates, not route-engine ETAs"),
    mapComparisonContinuity:
      hub.includes("setCompareOpen(false);") &&
      hub.includes("activateDiscovery(place.id)") &&
      hub.includes("View on map"),
    regressionCoverage:
      discoveryTests.includes("long hike language is preserved as effort intent") &&
      resultTests.includes("keep up to three semantic places") &&
      resultTests.includes("rough drive estimates and planning depth"),
  };

  const scored = benchmark.criteria.map((criterion) => ({
    ...criterion,
    passed: Boolean(checks[criterion.key]),
    score: checks[criterion.key] ? criterion.weight : 0,
  }));
  const score = scored.reduce((sum, item) => sum + item.score, 0);
  const criticalFailures = [
    "effortIntent",
    "compareBoard",
    "planningDepthVisible",
    "roughDriveHonesty",
  ].filter((key) => !checks[key]);

  console.log(JSON.stringify({
    benchmark: benchmark.name,
    baselineScore: benchmark.baselineScore,
    score,
    releaseTarget: benchmark.releaseTarget,
    flagshipTarget: benchmark.flagshipTarget,
    deltaFromBaseline: score - benchmark.baselineScore,
    criteria: scored,
    criticalFailures,
  }, null, 2));

  if (score < benchmark.releaseTarget || criticalFailures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
