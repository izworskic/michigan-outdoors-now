import { readFile } from "node:fs/promises";
import process from "node:process";

const baseline = JSON.parse(await readFile(new URL("../benchmarks/usefulness-baseline.json", import.meta.url), "utf8"));

const files = Object.fromEntries(
  await Promise.all(
    [
      "src/components/planner.tsx",
      "src/components/result-comparison.tsx",
      "src/components/trip-decision.tsx",
      "src/lib/planner.ts",
      "src/lib/planner-share.ts",
      "src/lib/live-data.ts",
      "src/app/globals.css",
      "src/app/layout.tsx",
      "src/app/page.tsx",
      "src/app/explore/page.tsx",
      "src/app/places/[place]/page.tsx",
      "src/components/destination-explorer.tsx",
    ].map(async (path) => [path, await readFile(new URL(`../${path}`, import.meta.url), "utf8")]),
  ),
);

const has = (path, ...markers) => markers.every((marker) => files[path].includes(marker));

const categories = [
  {
    name: "Decision quality",
    checks: [
      [5, has("src/lib/planner.ts", "rankDestinations", ".slice(0, 3)")],
      [5, has("src/lib/live-data.ts", "fetchWeatherSnapshots", "us_aqi")],
      [5, has("src/lib/planner.ts", "selected.has(\"dark-sky\")", "marine forecast")],
      [5, has("src/components/trip-decision.tsx", "Primary plan", "Backup plan")],
      [5, has("src/components/planner.tsx", "Open in Maps", "Official details")],
    ],
  },
  {
    name: "Interaction efficiency",
    checks: [
      [4, has("src/components/planner.tsx", "planner-form", "choice-group")],
      [4, has("src/components/planner.tsx", "Quick starts", "preset-grid")],
      [4, has("src/lib/planner-share.ts", "#plan=", "parsePlannerFragment")],
      [4, has("src/components/planner.tsx", "navigator.share", "clipboard.writeText")],
      [4, has("src/components/planner.tsx", "navigator.geolocation", "no_results_recovery", "Use my location")],
    ],
  },
  {
    name: "Result clarity",
    checks: [
      [5, has("src/components/result-comparison.tsx", "comparison-table", "Compare before you commit")],
      [5, has("src/components/planner.tsx", "mph gusts", "AQI", "% clouds")],
      [5, has("src/components/planner.tsx", "reason-list", "caution-box", "Access note")],
    ],
  },
  {
    name: "Trust and safety",
    checks: [
      [5, has("src/components/planner.tsx", "formatGeneratedTime", "Live conditions used", "Estimated fit")],
      [5, has("src/components/planner.tsx", "not a safety score", "Official details")],
      [5, has("src/components/planner.tsx", "location only if you tap it", "not placed in the URL or analytics") && has("src/lib/planner-share.ts", "#plan=")],
    ],
  },
  {
    name: "Mobile and accessibility",
    checks: [
      [5, has("src/components/planner.tsx", "<fieldset", "aria-pressed") && has("src/components/result-comparison.tsx", "<table")],
      [5, has("src/app/globals.css", "@media (max-width: 560px)", "overflow-x: auto")],
      [5, has("src/components/planner.tsx", "aria-live=\"polite\"", "tabIndex={-1}") && has("src/app/globals.css", "prefers-reduced-motion")],
    ],
  },
  {
    name: "Discoverability and measurement",
    checks: [
      [3, has("src/app/layout.tsx", "Metadata", "application/ld+json") && has("src/app/page.tsx", "WebApplication", "FAQPage")],
      [3, has("src/app/explore/page.tsx", "DestinationExplorer", "Quick answer") && has("src/app/places/[place]/page.tsx", "PlaceConditions", "nearbyDestinations")],
      [2, has("src/app/layout.tsx", "<Analytics", "<SpeedInsights") && has("src/components/planner.tsx", "planner_completed")],
      [2, has("src/app/layout.tsx", "Chris Izworski", "chrisizworski.com")],
    ],
  },
];

const results = categories.map((category) => ({
  name: category.name,
  score: category.checks.reduce((sum, [points, passed]) => sum + (passed ? points : 0), 0),
  possible: category.checks.reduce((sum, [points]) => sum + points, 0),
}));
const score = results.reduce((sum, result) => sum + result.score, 0);

console.log(`Usefulness baseline: ${baseline.baselineScore}/100`);
for (const result of results) console.log(`${result.name}: ${result.score}/${result.possible}`);
console.log(`Preview source score: ${score}/100 (release target: ${baseline.releaseTarget})`);
console.log(`Production outcome gate: ${baseline.productionVerified ? "verified" : "pending — intentionally separate from source readiness"}`);

if (score < baseline.releaseTarget) {
  console.error("Usefulness release gate failed.");
  process.exit(1);
}
