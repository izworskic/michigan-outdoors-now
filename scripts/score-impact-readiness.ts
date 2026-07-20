import { readFile } from "node:fs/promises";
import process from "node:process";
import { destinations } from "../src/data/destinations";
import { guides } from "../src/data/guides";

async function main() {
const root = new URL("../", import.meta.url);
const baseline = JSON.parse(await readFile(new URL("benchmarks/impact-readiness-v2.json", root), "utf8"));
const paths = [
  "package.json",
  "src/components/planner.tsx",
  "src/components/result-comparison.tsx",
  "src/components/trip-decision.tsx",
  "src/components/destination-explorer.tsx",
  "src/components/place-conditions.tsx",
  "src/app/page.tsx",
  "src/app/layout.tsx",
  "src/app/explore/page.tsx",
  "src/app/places/[place]/page.tsx",
  "src/app/ideas/[guide]/page.tsx",
  "src/app/from/[origin]/page.tsx",
  "src/app/api/recommendations/route.ts",
  "src/app/api/conditions/[place]/route.ts",
  "src/app/sitemap.ts",
  "src/app/llms.txt/route.ts",
  "src/app/llms-full.txt/route.ts",
  "src/app/globals.css",
  "src/lib/planner.ts",
  "src/lib/live-data.ts",
  "scripts/check-seo.mjs",
  "scripts/runtime-check.mjs",
  "docs/search-growth-plan.md",
];
const files = Object.fromEntries(
  await Promise.all(paths.map(async (path) => [path, await readFile(new URL(path, root), "utf8")])),
);
const has = (path: string, ...markers: string[]) => markers.every((marker) => files[path].includes(marker));
const gates = baseline.outcomeGates as Record<string, boolean>;

type Category = { name: string; checks: Array<[number, boolean]> };

function calculate(categories: Category[]) {
  const results = categories.map((category) => ({
    name: category.name,
    score: category.checks.reduce((sum, [points, passed]) => sum + (passed ? points : 0), 0),
    possible: category.checks.reduce((sum, [points]) => sum + points, 0),
  }));
  return { results, score: results.reduce((sum, result) => sum + result.score, 0) };
}

const usefulness = calculate([
  {
    name: "Fast mobile start",
    checks: [
      [8, has("src/components/planner.tsx", "navigator.geolocation", "Use my location", "originCoordinates")],
      [6, has("src/components/planner.tsx", "City or ZIP code", "michigan-origins")],
      [6, has("src/components/planner.tsx", "Quick starts", "preset-grid")],
      [5, has("src/components/planner.tsx", "no_results_recovery", "Widen the drive window", "Clear extra requirements")],
      [5, has("src/components/planner.tsx", "not placed in the URL or analytics", "location only if you tap it")],
    ],
  },
  {
    name: "Destination discovery",
    checks: [
      [10, has("src/components/destination-explorer.tsx", "michigan-map", "explorer_filter_changed", "Practical needs")],
      [8, destinations.length >= 28 && has("src/app/sitemap.ts", "destinations.map", "/places/${destination.id}")],
      [7, has("src/components/place-conditions.tsx", "Rain chance", "Peak gusts", "Air quality")],
      [5, has("src/app/places/[place]/page.tsx", "nearbyDestinations", "NEARBY ALTERNATIVES")],
      [5, has("src/app/ideas/[guide]/page.tsx", "/places/${destination.id}") && has("src/app/from/[origin]/page.tsx", "/places/${destination.id}")],
    ],
  },
  {
    name: "Decision intelligence",
    checks: [
      [10, has("src/lib/planner.ts", "rankDestinations", "weatherAdjustment", ".slice(0, 3)")],
      [8, has("src/lib/planner.ts", "marine forecast", "cloud cover", "Air quality")],
      [7, has("src/components/planner.tsx", "Good with kids", "Dog allowed", "Lower-barrier access")],
      [8, has("src/components/result-comparison.tsx", "Compare before you commit") && has("src/components/trip-decision.tsx", "Primary plan", "Backup plan")],
      [7, has("src/app/places/[place]/page.tsx", "PlaceConditions", "Planner", "conditionConsiderations")],
    ],
  },
  {
    name: "Actionability, trust, and access",
    checks: [
      [8, has("src/app/places/[place]/page.tsx", "Open map", "Official details")],
      [8, has("src/components/planner.tsx", "navigator.share", "clipboard.writeText")],
      [8, destinations.every((destination) => destination.accessNote.length >= 80) && has("src/app/places/[place]/page.tsx", "Practical fit before the drive")],
      [8, has("src/app/places/[place]/page.tsx", '"@type": "Place"', "GeoCoordinates", "sameAs")],
      [8, has("src/components/destination-explorer.tsx", "aria-live", "aria-pressed") && has("src/components/planner.tsx", "<fieldset", "aria-live")],
      [7, has("src/app/globals.css", "@media (max-width: 560px)", "prefers-reduced-motion", "michigan-map")],
      [8, has("src/app/places/[place]/page.tsx", "relatedGuides") && has("src/lib/planner.ts", "relatedToolFor")],
    ],
  },
  {
    name: "Measurement and outcomes",
    checks: [
      [10, has("src/components/planner.tsx", "planner_started", "planner_completed", "outbound_official_opened") && has("src/components/destination-explorer.tsx", "explorer_filter_changed")],
      [8, has("package.json", "check:seo", "check:runtime", "score:impact") && has("scripts/runtime-check.mjs", "coordinateRecommendation", "conditionsPayload")],
      [7, has("docs/search-growth-plan.md", "10x", "qualified organic entries")],
      [5, gates.productionVerified === true],
      [5, gates.stableBaselineRecorded === true],
      [5, gates.tenXOutcomeReached === true],
    ],
  },
]);

const search = calculate([
  {
    name: "Demand and intent coverage",
    checks: [
      [10, guides.length >= 10],
      [8, has("src/app/explore/page.tsx", "Michigan Outdoor Map and Destination Finder", "Quick answer")],
      [8, destinations.length >= 28 && has("src/app/places/[place]/page.tsx", "generateStaticParams", "generateMetadata")],
      [7, has("src/app/from/[origin]/page.tsx", "generateStaticParams", "Michigan Day Trips from")],
      [7, has("src/components/destination-explorer.tsx", "activityIds", "regionIds", "Family fit")],
    ],
  },
  {
    name: "People-first content utility",
    checks: [
      [9, has("src/app/places/[place]/page.tsx", "destinationDirectAnswer", "Quick answer")],
      [9, destinations.every((destination) => destination.summary.length >= 100 && destination.accessNote.length >= 80)],
      [9, has("src/components/place-conditions.tsx", "Today at a glance", "Conditions are context")],
      [9, has("src/app/places/[place]/page.tsx", "officialUrl", "nearbyDestinations")],
      [9, has("src/app/places/[place]/page.tsx", "Planner", "relatedGuides")],
    ],
  },
  {
    name: "Crawl paths and internal architecture",
    checks: [
      [8, has("src/app/sitemap.ts", "/explore", "destinations.map", "guides.map", "origins.map")],
      [7, has("src/app/layout.tsx", "Explore map", "Destination map")],
      [7, has("src/app/ideas/[guide]/page.tsx", "/places/${destination.id}")],
      [7, has("src/app/places/[place]/page.tsx", "/places/${nearbyPlace.id}", "/ideas/${guide.slug}")],
      [6, has("src/app/explore/page.tsx", "destinations.map", "/places/${destination.id}")],
    ],
  },
  {
    name: "Metadata, entities, and AI answerability",
    checks: [
      [9, has("src/app/places/[place]/page.tsx", "alternates: { canonical", "openGraph", "twitter")],
      [9, has("src/app/places/[place]/page.tsx", "BreadcrumbList", '"@type": "Place"', "GeoCoordinates")],
      [9, has("src/app/explore/page.tsx", "CollectionPage", "ItemList")],
      [9, has("src/app/places/[place]/page.tsx", "Chris Izworski", "personSchema", "dateModified")],
      [9, has("src/app/llms.txt/route.ts", "Curated destination planning pages", "Interactive Michigan destination map") && has("src/app/llms-full.txt/route.ts", "Planning page:")],
    ],
  },
  {
    name: "Measurement and organic outcomes",
    checks: [
      [8, has("src/app/layout.tsx", "<Analytics", "<SpeedInsights") && has("src/components/planner.tsx", "planner_started", "planner_completed")],
      [7, has("docs/search-growth-plan.md", "Search Console", "qualified organic entries")],
      [5, has("scripts/check-seo.mjs", "53", "destination decision pages")],
      [5, gates.productionVerified === true],
      [5, gates.stableBaselineRecorded === true],
      [5, gates.tenXOutcomeReached === true],
    ],
  },
]);

function print(label: string, baselineScore: number, result: ReturnType<typeof calculate>) {
  console.log(`\n${label} v2 baseline: ${baselineScore}/${baseline.scale}`);
  for (const category of result.results) console.log(`${category.name}: ${category.score}/${category.possible}`);
  console.log(`${label} v2 preview: ${result.score}/${baseline.scale} (release target: ${baseline.releaseTarget})`);
}

print("Usefulness", baseline.priorPreview.usefulness, usefulness);
print("Search readiness", baseline.priorPreview.searchReadiness, search);
console.log(`\nOutcome gates held for production evidence: ${Object.values(gates).filter((value) => !value).length}/3 pending.`);

if (usefulness.score < baseline.releaseTarget || search.score < baseline.releaseTarget) {
  console.error("Impact-readiness v2 release gate failed.");
  process.exit(1);
}
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
