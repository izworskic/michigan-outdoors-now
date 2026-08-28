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
    await readFile(new URL("benchmarks/skeptic-conversion.json", root), "utf8"),
  ) as Benchmark;

  const files = Object.fromEntries(
    await Promise.all([
      "src/app/api/discover/route.ts",
      "src/components/outdoor-intent-hub.tsx",
      "src/app/atlas.css",
      "tests/result-flow-refinement.test.ts",
      "scripts/runtime-check.mjs",
      "docs/skeptic-conversion.md",
    ].map(async (path) => [path, await readFile(new URL(path, root), "utf8")])),
  ) as Record<string, string>;

  const route = files["src/app/api/discover/route.ts"];
  const hub = files["src/components/outdoor-intent-hub.tsx"];
  const css = files["src/app/atlas.css"];
  const tests = files["tests/result-flow-refinement.test.ts"];
  const runtime = files["scripts/runtime-check.mjs"];
  const doc = files["docs/skeptic-conversion.md"];

  const checks: Record<string, boolean> = {
    surpriseDiscovery:
      route.includes("HOUSEHOLD_MICHIGAN_DESTINATION_PATTERNS") &&
      route.includes("surpriseRank") &&
      route.includes("surpriseMode?: boolean") &&
      hub.includes("Surprise me · something I probably don’t know") &&
      runtime.includes('assert.equal(surprisePayload.mode, "surprise")'),
    dismissWithoutAccount:
      hub.includes("dismissedDiscoveryIds") &&
      hub.includes("Not for me") &&
      hub.includes("excludePlaceIds: dismissedDiscoveryIds") &&
      runtime.includes("dismissed surprise place returned again") &&
      !hub.includes("sign in to dismiss"),
    whyThisOne:
      hub.includes("buildDecisionArgument") &&
      hub.includes("Why this one over the others?") &&
      hub.includes("Show {decisionArgument.alternative.name} instead"),
    tradeoffVisible:
      hub.includes("driveDeltaMinutes") &&
      hub.includes("minimizing windshield time matters more") &&
      hub.includes("Drive time is essentially a wash"),
    departureMode:
      hub.includes("Get me out of here") &&
      hub.includes('className="canvas-departure"') &&
      hub.includes("arrive around {arrivalTimeLabel(activeDiscovery)} if you leave now") &&
      hub.includes("Start directions") &&
      css.includes(".has-departure .canvas-topbar"),
    provenanceLedger:
      hub.includes("Why should I trust this?") &&
      hub.includes("OSRM road route") &&
      hub.includes("Open-Meteo point forecast + AQI") &&
      hub.includes("Michigan DNR nearby trail, closure and reroute layers") &&
      hub.includes("Still unknown"),
    noPostDecisionClutter:
      css.includes(".has-departure .canvas-result-dock") &&
      css.includes(".has-departure .canvas-pulls") &&
      css.includes("visibility:hidden") &&
      !/canvas-departure[\s\S]*?you may also like/i.test(hub),
    regressionCoverage:
      tests.includes("skeptic flow exposes surprise discovery") &&
      tests.includes("explain why this choice beats a serious alternative") &&
      tests.includes("provenance ledger exposes sources") &&
      tests.includes("Get me out of here becomes a sparse departure mode") &&
      doc.includes("Discover → understand → believe → commit → leave"),
  };

  const scored = benchmark.criteria.map((criterion) => ({
    ...criterion,
    passed: Boolean(checks[criterion.key]),
    score: checks[criterion.key] ? criterion.weight : 0,
  }));
  const score = scored.reduce((sum, item) => sum + item.score, 0);
  const criticalFailures = [
    "surpriseDiscovery",
    "whyThisOne",
    "departureMode",
    "provenanceLedger",
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
