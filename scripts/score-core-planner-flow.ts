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
    await readFile(new URL("benchmarks/core-planner-flow.json", root), "utf8"),
  ) as Benchmark;
  const files = Object.fromEntries(
    await Promise.all([
      "src/components/outdoor-intent-hub.tsx",
      "src/app/api/origin/route.ts",
      "src/app/api/discover/route.ts",
      "src/app/atlas.css",
      "scripts/runtime-check.mjs",
    ].map(async (path) => [path, await readFile(new URL(path, root), "utf8")])),
  );

  const hub = files["src/components/outdoor-intent-hub.tsx"];
  const originRoute = files["src/app/api/origin/route.ts"];
  const discoverRoute = files["src/app/api/discover/route.ts"];
  const css = files["src/app/atlas.css"];
  const runtime = files["scripts/runtime-check.mjs"];

  const checks = {
    typedOriginResolution:
      originRoute.includes("resolveMichiganOrigin") &&
      originRoute.includes("export async function POST") &&
      hub.includes('fetch("/api/origin"') &&
      hub.includes("setOriginCoordinates(coordinates)") &&
      hub.includes("setFocusPoint("),
    explicitOriginState:
      hub.includes('useState<"idle" | "resolving" | "resolved" | "error">') &&
      hub.includes("canvas-origin-status") &&
      hub.includes('setOriginStatus("resolved")') &&
      hub.includes('setOriginStatus("error")'),
    deviceOriginParity:
      hub.includes('setOrigin("My location")') &&
      hub.includes('setOriginFeedback("Starting from your current location")') &&
      hub.includes("setOriginCoordinates(coordinates)") &&
      hub.includes("setUserLocation(coordinates)"),
    fastDiscoveryFallback:
      discoverRoute.includes("Promise.any(attempts)") &&
      discoverRoute.includes("1_600") &&
      discoverRoute.indexOf("const curated = curatedDiscoveryPlaces") <
        discoverRoute.indexOf("const elements = await fetchOverpass"),
    searchDoesNotAutoOpenSheet:
      !hub.includes("setActiveDiscoveryId(result.places[0]") &&
      hub.includes('setActiveDiscoveryId("");'),
    visibleSearchResults:
      hub.includes('className="canvas-wish-results"') &&
      hub.includes("discovery.places.slice(0, 3)") &&
      hub.includes("possibilities"),
    responsiveNonOverlap:
      hub.includes('className="canvas-query-stack"') &&
      css.includes(".canvas-query-stack{") &&
      css.includes(".canvas-wish{\n  position:static;") &&
      css.includes(".canvas-message-inline{\n  position:static;") &&
      /@media\(max-width:700px\)[\s\S]*?\.canvas-sheet\{\s*top:auto;\s*bottom:56px;/.test(css),
    runtimeEndpointCoverage:
      runtime.includes("/api/origin") &&
      runtime.includes("/api/discover") &&
      runtime.includes("discoveryElapsed <= 3_000"),
  };

  const scored = benchmark.criteria.map((criterion) => ({
    ...criterion,
    passed: Boolean(checks[criterion.key]),
    score: checks[criterion.key] ? criterion.weight : 0,
  }));
  const score = scored.reduce((sum, item) => sum + item.score, 0);

  const critical = [
    "typedOriginResolution",
    "fastDiscoveryFallback",
    "searchDoesNotAutoOpenSheet",
    "responsiveNonOverlap",
    "runtimeEndpointCoverage",
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
