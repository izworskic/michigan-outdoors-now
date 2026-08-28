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
    await readFile(new URL("benchmarks/growth-operating-system.json", root), "utf8"),
  ) as Benchmark;

  const paths = [
    "src/lib/growth-contract.ts",
    "src/lib/growth-analytics.ts",
    "src/lib/growth-opportunities.ts",
    "src/components/search-landing-tracker.tsx",
    "src/components/planner.tsx",
    "src/components/outdoor-intent-hub.tsx",
    "src/app/from/[origin]/[intent]/page.tsx",
    "src/app/from/[origin]/[intent]/opengraph-image.tsx",
    "src/app/opengraph-image.tsx",
    "src/app/growth-manifest.json/route.ts",
    "scripts/report-growth-opportunities.ts",
    "tests/growth-operating-system.test.ts",
    "docs/growth-operating-system.md",
  ];
  const files = Object.fromEntries(
    await Promise.all(paths.map(async (path) => [path, await readFile(new URL(path, root), "utf8")])),
  ) as Record<string, string>;

  const contract = files["src/lib/growth-contract.ts"];
  const analytics = files["src/lib/growth-analytics.ts"];
  const model = files["src/lib/growth-opportunities.ts"];
  const landing = files["src/app/from/[origin]/[intent]/page.tsx"];
  const planner = files["src/components/planner.tsx"];
  const hub = files["src/components/outdoor-intent-hub.tsx"];
  const manifest = files["src/app/growth-manifest.json/route.ts"];
  const og = files["src/app/opengraph-image.tsx"];
  const localOg = files["src/app/from/[origin]/[intent]/opengraph-image.tsx"];
  const report = files["scripts/report-growth-opportunities.ts"];
  const tests = files["tests/growth-operating-system.test.ts"];
  const doc = files["docs/growth-operating-system.md"];

  const checks: Record<string, boolean> = {
    attributedSeoFunnel:
      landing.includes('surface: "location_intent"') &&
      landing.includes("analyticsContext={analyticsContext}") &&
      planner.includes("trackGrowthEvent(name, analyticsContext, properties)") &&
      contract.includes('"search_landing_viewed"') &&
      contract.includes('"planner_completed"'),
    semanticDecisionFunnel:
      [
        "semantic_search_started",
        "semantic_search_completed",
        "semantic_result_opened",
        "place_kept",
        "comparison_opened",
        "decision_argument_opened",
        "proof_ledger_opened",
        "departure_mode_opened",
        "directions_opened",
      ].every((event) => hub.includes(`"${event}"`)),
    privacyBoundary:
      !/latitude|longitude|coordinates|freeText|queryText/.test(analytics) &&
      hub.includes("queryLength: query.length") &&
      !hub.includes("queryText:"),
    searchProductJoin:
      model.includes('"PUSH_CTR"') &&
      model.includes('"BUILD_AUTHORITY"') &&
      model.includes('"UX_REPAIR"') &&
      report.includes("scoreSearchOpportunity") &&
      report.includes("productByPage"),
    familyExpansionGate:
      model.includes("impressions >= 250") &&
      model.includes("clicks >= 5") &&
      model.includes("plannerCompletions >= 10") &&
      model.includes("directions >= 3") &&
      model.includes('"DO_NOT_EXPAND"'),
    machineReadableContract:
      manifest.includes('version: "1.0.0"') &&
      manifest.includes("growthEventNames") &&
      manifest.includes('"X-Robots-Tag": "noindex, nofollow"'),
    ctrCreative:
      !/Three practical Michigan plans/i.test(og) &&
      localOg.includes("Worth the drive?") &&
      localOg.includes("landing?.origin.name"),
    centralPortfolioHandoff:
      doc.includes("ChrisIzworski.com remains the portfolio source of truth") &&
      doc.includes("Tool Network Registry") &&
      doc.includes("Search Authority Portfolio"),
    regressionCoverage:
      tests.includes("query scoring separates CTR, authority, and UX problems") &&
      tests.includes("family expansion requires search demand and downstream decision value") &&
      tests.includes("growth analytics contract excludes precise location"),
  };

  const scored = benchmark.criteria.map((criterion) => ({
    ...criterion,
    passed: Boolean(checks[criterion.key]),
    score: checks[criterion.key] ? criterion.weight : 0,
  }));
  const score = scored.reduce((sum, criterion) => sum + criterion.score, 0);
  const criticalFailures = [
    "attributedSeoFunnel",
    "semanticDecisionFunnel",
    "privacyBoundary",
    "searchProductJoin",
    "familyExpansionGate",
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
