import { readFile } from "node:fs/promises";
import process from "node:process";
import {
  landingDirectAnswer,
  landingQualitySummary,
  searchLandings,
  searchLandingIntents,
} from "../src/lib/search-landings";

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
    await readFile(new URL("benchmarks/organic-search-growth.json", root), "utf8"),
  ) as Benchmark;

  const [page, originPage, guidePage, sitemap, site, layout, tests] = await Promise.all([
    readFile(new URL("src/app/from/[origin]/[intent]/page.tsx", root), "utf8"),
    readFile(new URL("src/app/from/[origin]/page.tsx", root), "utf8"),
    readFile(new URL("src/app/ideas/[guide]/page.tsx", root), "utf8"),
    readFile(new URL("src/app/sitemap.ts", root), "utf8"),
    readFile(new URL("src/lib/site.ts", root), "utf8"),
    readFile(new URL("src/app/layout.tsx", root), "utf8"),
    readFile(new URL("tests/search-growth-landings.test.ts", root), "utf8"),
  ]);

  const quality = landingQualitySummary();
  const serpSafe = searchLandings.every(
    (landing) =>
      landing.intent.title(landing.origin).length <= 60 &&
      landing.intent.description(landing.origin).length <= 158,
  );
  const answersConcrete = searchLandings.every((landing) => {
    const answer = landingDirectAnswer(landing);
    return landing.places.slice(0, 3).every((place) => answer.includes(place.name));
  });
  const slugs = new Set(searchLandingIntents.map((intent) => intent.slug));

  const checks: Record<string, boolean> = {
    qualifiedSurfaceArea:
      quality.total >= 20 &&
      quality.total <= 60 &&
      quality.originsCovered >= 6 &&
      quality.minimumPlacesPerLanding >= 4,
    noDoorwayDuplicates:
      quality.exactDuplicateSignatures === 0 &&
      searchLandings.length ===
        new Set(searchLandings.map((landing) => landing.intent.slug + ":" + landing.signature)).size,
    crawlableLocalAnswer:
      page.includes("landingDirectAnswer(landing)") &&
      page.includes("landing.places.slice(0, 6)") &&
      page.includes("<Planner") &&
      answersConcrete,
    serpLengthDiscipline: serpSafe,
    cannibalizationGuard:
      !slugs.has("beaches") &&
      !slugs.has("beach-day-trips") &&
      !slugs.has("freighters") &&
      !slugs.has("freighter-watching"),
    internalDiscoveryNetwork:
      originPage.includes("searchLandingsForOrigin") &&
      guidePage.includes("searchLandingsForGuide") &&
      page.includes("Chris Izworski profile") &&
      page.includes("More projects"),
    canonicalChrisEntity:
      site.includes('"@id": "https://chrisizworski.com/#person"') &&
      !site.includes("#chris-izworski") &&
      !layout.includes("#chris-izworski") &&
      layout.includes("Michigan Outdoor Day Trip Planner | Chris Izworski"),
    sitemapDiscovery:
      sitemap.includes("searchLandings.map") &&
      sitemap.includes("landing.intent.slug"),
    regressionCoverage:
      tests.includes("meaningful but bounded search surface area") &&
      tests.includes("canonical Chris Izworski Person ID") &&
      tests.includes("avoids beach and freighter cannibalization"),
  };

  const scored = benchmark.criteria.map((criterion) => ({
    ...criterion,
    passed: Boolean(checks[criterion.key]),
    score: checks[criterion.key] ? criterion.weight : 0,
  }));
  const score = scored.reduce((sum, criterion) => sum + criterion.score, 0);
  const criticalFailures = [
    "qualifiedSurfaceArea",
    "noDoorwayDuplicates",
    "crawlableLocalAnswer",
    "canonicalChrisEntity",
  ].filter((key) => !checks[key]);

  console.log(JSON.stringify({
    benchmark: benchmark.name,
    baselineScore: benchmark.baselineScore,
    score,
    releaseTarget: benchmark.releaseTarget,
    flagshipTarget: benchmark.flagshipTarget,
    deltaFromBaseline: score - benchmark.baselineScore,
    qualifiedPages: quality.total,
    byIntent: quality.byIntent,
    originsCovered: quality.originsCovered,
    criteria: scored,
    criticalFailures,
  }, null, 2));

  if (score < benchmark.releaseTarget || criticalFailures.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
