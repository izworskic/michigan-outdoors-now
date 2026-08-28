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
    await readFile(new URL("benchmarks/field-confidence.json", root), "utf8"),
  ) as Benchmark;

  const files = Object.fromEntries(
    await Promise.all([
      "src/lib/route-intelligence.ts",
      "src/lib/place-intelligence.ts",
      "src/app/api/discover/route.ts",
      "src/app/api/place-intelligence/route.ts",
      "src/components/outdoor-intent-hub.tsx",
      "src/app/atlas.css",
      "tests/route-intelligence.test.ts",
      "tests/result-flow-refinement.test.ts",
      "scripts/runtime-check.mjs",
      "docs/field-confidence.md",
    ].map(async (path) => [path, await readFile(new URL(path, root), "utf8")])),
  ) as Record<string, string>;

  const routing = files["src/lib/route-intelligence.ts"];
  const intelligence = files["src/lib/place-intelligence.ts"];
  const discoveryRoute = files["src/app/api/discover/route.ts"];
  const placeRoute = files["src/app/api/place-intelligence/route.ts"];
  const hub = files["src/components/outdoor-intent-hub.tsx"];
  const css = files["src/app/atlas.css"];
  const routingTests = files["tests/route-intelligence.test.ts"];
  const resultTests = files["tests/result-flow-refinement.test.ts"];
  const runtime = files["scripts/runtime-check.mjs"];
  const doc = files["docs/field-confidence.md"];

  const checks: Record<string, boolean> = {
    batchedRoutedTravel:
      routing.includes("/table/v1/driving/") &&
      routing.includes("sources=0") &&
      routing.includes("annotations=duration,distance") &&
      routing.includes("900") &&
      discoveryRoute.includes("fetchRoutedTravel") &&
      discoveryRoute.includes("applyRoutedTravel"),
    routingFallback:
      routing.includes('travelSource: "estimated" as const') &&
      routingTests.includes("fallback places stay explicitly estimated") &&
      hub.includes('place.travelSource === "routed"'),
    currentWeather:
      intelligence.includes("api.open-meteo.com/v1/forecast") &&
      intelligence.includes("air-quality-api.open-meteo.com") &&
      hub.includes("Weather now") &&
      hub.includes("Open-Meteo weather + air quality"),
    nearbyOfficialTrailData:
      intelligence.includes("DNR_TRAIL_SERVICE") &&
      intelligence.includes("esriGeometryEnvelope") &&
      intelligence.includes("SegmentLengthMiles") &&
      hub.includes("DNR mapped mi in the nearby window"),
    terrainElevation:
      intelligence.includes("api.open-meteo.com/v1/elevation") &&
      intelligence.includes("rangeFeet") &&
      hub.includes("nearby elevation span") &&
      doc.includes("not represented as total route gain"),
    osmDifficultyMetadata:
      intelligence.includes('["route"~"^(hiking|foot)$"]') &&
      intelligence.includes("sac_scale") &&
      intelligence.includes("trail_visibility") &&
      intelligence.includes("surface") &&
      hub.includes("Difficulty/surface tags not available here"),
    officialAccessChanges:
      intelligence.includes("DNR_TRAIL_CLOSURES_SERVICE") &&
      intelligence.includes("DNR_TRAIL_REROUTES_SERVICE") &&
      hub.includes("DNR closure item") &&
      hub.includes("Official DNR access-change layer checked within about 5 miles"),
    visibleConfidenceUI:
      hub.includes('className="canvas-field-intelligence"') &&
      hub.includes("What we know before you leave.") &&
      css.includes(".canvas-field-intelligence{"),
    runtimeCoverage:
      runtime.includes("/api/place-intelligence") &&
      resultTests.includes("selected semantic places load current trip confidence intelligence") &&
      placeRoute.includes("fetchPlaceIntelligence"),
  };

  const scored = benchmark.criteria.map((criterion) => ({
    ...criterion,
    passed: Boolean(checks[criterion.key]),
    score: checks[criterion.key] ? criterion.weight : 0,
  }));
  const score = scored.reduce((sum, item) => sum + item.score, 0);
  const criticalFailures = [
    "batchedRoutedTravel",
    "routingFallback",
    "nearbyOfficialTrailData",
    "officialAccessChanges",
    "visibleConfidenceUI",
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
