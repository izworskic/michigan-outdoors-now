import { readFile } from "node:fs/promises";
import process from "node:process";
import { trailSearchPages } from "../src/lib/trail-search-pages";

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
    await readFile(new URL("benchmarks/trail-decision-stack.json", root), "utf8"),
  ) as Benchmark;

  const [intelligence, route, recommendations, dayPlan, dayApi, hub, trailPage, profiles, runtime, tests] =
    await Promise.all([
      readFile(new URL("src/lib/place-intelligence.ts", root), "utf8"),
      readFile(new URL("src/lib/route-intelligence.ts", root), "utf8"),
      readFile(new URL("src/app/api/recommendations/route.ts", root), "utf8"),
      readFile(new URL("src/lib/day-plan.ts", root), "utf8"),
      readFile(new URL("src/app/api/day-plan/route.ts", root), "utf8"),
      readFile(new URL("src/components/outdoor-intent-hub.tsx", root), "utf8"),
      readFile(new URL("src/app/hiking/[intent]/page.tsx", root), "utf8"),
      readFile(new URL("src/data/trail-profiles.ts", root), "utf8"),
      readFile(new URL("scripts/runtime-check.mjs", root), "utf8"),
      readFile(new URL("tests/result-flow-refinement.test.ts", root), "utf8"),
    ]);

  const checks: Record<string, boolean> = {
    routeSpecificTruth:
      intelligence.includes("TrailRouteTruth") &&
      intelligence.includes("relation(around:3500") &&
      intelligence.includes("way(r.routes)") &&
      hub.includes(">Trail Truth<") &&
      hub.includes("trailTruth.distanceMiles") &&
      hub.includes("canvas-result-trail-truth") &&
      hub.includes("selectTrailProfileForDiscovery") &&
      hub.includes("hike estimate"),
    routeProvenance:
      intelligence.includes('"osm-tag"') &&
      intelligence.includes('"osm-geometry"') &&
      intelligence.includes('"sampled-route"') &&
      intelligence.includes("mapped OSM relation members") &&
      hub.includes("mapped relation"),
    currentGoSignal:
      intelligence.includes("deriveGoSignal") &&
      intelligence.includes("recentRainInches") &&
      intelligence.includes("daylightHoursRemaining") &&
      intelligence.includes("outingWindow") &&
      hub.includes("Should I go?"),
    structuredPlannerRouting:
      recommendations.includes("fetchRoutedPoints") &&
      recommendations.includes('travelSource: "routed"') &&
      recommendations.includes('travelSource: "estimated"') &&
      route.includes("fetchRoutedPoints"),
    multiStopDayBuilder:
      dayPlan.includes("permutations") &&
      dayPlan.includes("bestOrder") &&
      dayPlan.includes("fetchRouteMatrix") &&
      dayApi.includes("day_plan_built") &&
      hub.includes("Build my day") &&
      hub.includes('fetch("/api/day-plan"'),
    officialTrailSearch:
      trailSearchPages.length === 6 &&
      trailSearchPages.every((page) => page.profiles.length >= 3) &&
      trailPage.includes("Trail Truth standard") &&
      profiles.includes("National Park Service") &&
      profiles.includes("Michigan DNR") &&
      profiles.includes("U.S. Forest Service") &&
      profiles.includes("selectTrailProfileForDiscovery") &&
      profiles.includes("Trailhead") &&
      hub.includes("Official access details available"),
    honestFallbacks:
      dayPlan.includes('source === "routed"') &&
      dayPlan.includes("straight-line planning estimates") &&
      intelligence.includes("Official land-manager maps and notices remain the final source") &&
      hub.includes("selected-route mileage"),
    runtimeCoverage:
      runtime.includes("/api/day-plan") &&
      runtime.includes("/hiking/10-mile-hikes-michigan") &&
      runtime.includes("goSignal") &&
      tests.includes("Decision Board can build a routed multi-stop day"),
  };

  const scored = benchmark.criteria.map((criterion) => ({
    ...criterion,
    passed: Boolean(checks[criterion.key]),
    score: checks[criterion.key] ? criterion.weight : 0,
  }));
  const score = scored.reduce((sum, item) => sum + item.score, 0);
  const criticalFailures = [
    "routeSpecificTruth",
    "currentGoSignal",
    "structuredPlannerRouting",
    "multiStopDayBuilder",
    "officialTrailSearch",
  ].filter((key) => !checks[key]);

  console.log(JSON.stringify({
    benchmark: benchmark.name,
    baselineScore: benchmark.baselineScore,
    score,
    releaseTarget: benchmark.releaseTarget,
    flagshipTarget: benchmark.flagshipTarget,
    deltaFromBaseline: score - benchmark.baselineScore,
    trailSearchPages: trailSearchPages.length,
    criteria: scored,
    criticalFailures,
  }, null, 2));

  if (score < benchmark.releaseTarget || criticalFailures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
