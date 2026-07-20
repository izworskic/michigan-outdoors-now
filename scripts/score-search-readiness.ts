import { readFile } from "node:fs/promises";
import process from "node:process";
import { guides } from "../src/data/guides";

async function main() {
const root = new URL("../", import.meta.url);
const baseline = JSON.parse(await readFile(new URL("benchmarks/search-readiness-baseline.json", root), "utf8"));
const paths = [
  "src/app/page.tsx",
  "src/app/layout.tsx",
  "src/app/sitemap.ts",
  "src/app/from/[origin]/page.tsx",
  "src/app/ideas/page.tsx",
  "src/app/ideas/[guide]/page.tsx",
  "src/app/llms.txt/route.ts",
  "src/app/llms-full.txt/route.ts",
  "src/app/explore/page.tsx",
  "src/app/places/[place]/page.tsx",
  "src/components/destination-explorer.tsx",
  "docs/search-growth-plan.md",
];
const files = Object.fromEntries(
  await Promise.all(paths.map(async (path) => [path, await readFile(new URL(path, root), "utf8")])),
);
const has = (path: string, ...markers: string[]) => markers.every((marker) => files[path].includes(marker));
const allGuides = (test: (guide: (typeof guides)[number]) => boolean) => guides.every(test);

const categories = [
  {
    name: "Search intent and personas",
    checks: [
      [10, guides.length >= 10 && new Set(guides.map((guide) => guide.slug)).size === guides.length],
      [10, allGuides((guide) => guide.audience.length >= 80 && guide.entryLabel.length >= 10 && guide.directAnswer.length >= 180)],
    ],
  },
  {
    name: "People-first content depth",
    checks: [
      [10, allGuides((guide) => guide.tips.length === 3 && guide.checklist.length >= 4 && guide.faqs.length === 3)],
      [10, allGuides((guide) => guide.destinationIds.length >= 5 && guide.planner.activities.length >= 1)],
    ],
  },
  {
    name: "Crawl paths and internal links",
    checks: [
      [5, has("src/app/sitemap.ts", "guides.map", "/ideas/${guide.slug}")],
      [5, has("src/app/page.tsx", "persona-section", "/ideas/${guide.slug}") && has("src/app/layout.tsx", "Trip ideas")],
      [5, has("src/app/from/[origin]/page.tsx", "localGuides", "Explore Michigan trip guides") && has("src/app/ideas/[guide]/page.tsx", "relatedGuides")],
    ],
  },
  {
    name: "Metadata and structured meaning",
    checks: [
      [5, has("src/app/ideas/[guide]/page.tsx", "generateMetadata", "alternates: { canonical", "openGraph")],
      [5, has("src/app/ideas/[guide]/page.tsx", "BreadcrumbList", "ItemList", "FAQPage")],
      [5, has("src/app/ideas/page.tsx", "CollectionPage", "ItemList") && allGuides((guide) => guide.description.length >= 120)],
    ],
  },
  {
    name: "AI answerability and entity clarity",
    checks: [
      [5, has("src/app/ideas/[guide]/page.tsx", "Quick answer", "guide.directAnswer")],
      [5, has("src/app/ideas/[guide]/page.tsx", "Chris Izworski", "dateModified", "Official source")],
      [5, has("src/app/llms.txt/route.ts", "People-first planning guides", "llms-full.txt") && has("src/app/llms-full.txt/route.ts", "expanded reference", "Official source")],
    ],
  },
  {
    name: "Measurement and release safety",
    checks: [
      [5, has("src/app/layout.tsx", "<Analytics", "<SpeedInsights")],
      [5, has("docs/search-growth-plan.md", "Search Console", "qualified organic entries", "cannot be guaranteed")],
      [5, has("src/app/explore/page.tsx", "CollectionPage", "DestinationExplorer") && has("src/app/places/[place]/page.tsx", '"@type": "Place"', "GeoCoordinates", "PlaceConditions")],
    ],
  },
] as const;

const results = categories.map((category) => ({
  name: category.name,
  score: category.checks.reduce((sum, [points, passed]) => sum + (passed ? points : 0), 0),
  possible: category.checks.reduce((sum, [points]) => sum + points, 0),
}));
const score = results.reduce((sum, result) => sum + result.score, 0);

console.log(`Search-readiness baseline: ${baseline.baselineScore}/100`);
for (const result of results) console.log(`${result.name}: ${result.score}/${result.possible}`);
console.log(`Preview source score: ${score}/100 (release target: ${baseline.releaseTarget})`);
console.log(`Production crawl/index gate: ${baseline.productionVerified ? "verified" : "pending, intentionally separate from source readiness"}`);

if (score < baseline.releaseTarget) {
  console.error("Search-readiness release gate failed.");
  process.exit(1);
}
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
