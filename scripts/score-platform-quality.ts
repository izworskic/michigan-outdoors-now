import { readFile } from "node:fs/promises";
import process from "node:process";

async function main() {
const root = new URL("../", import.meta.url);
const baseline = JSON.parse(await readFile(new URL("benchmarks/platform-quality.json", root), "utf8"));
const paths = [
  "src/lib/decision-engine.ts", "src/lib/live-data.ts", "src/lib/planner.ts", "src/lib/types.ts",
  "src/data/specialist-tools.ts", "src/app/page.tsx", "src/components/outdoor-intent-hub.tsx", "src/components/statewide-decision-board.tsx",
  "src/lib/statewide.ts", "src/components/result-comparison.tsx", "src/components/trip-decision.tsx",
  "src/app/globals.css", "src/app/explore/page.tsx", "src/components/destination-explorer.tsx",
  "src/components/michigan-destination-map.tsx", "src/lib/outdoor-universe.ts", "src/lib/boat-launches.ts",
  "tests/decision-engine.test.ts", "tests/statewide.test.ts", "tests/specialist-tools.test.ts", "tests/outdoor-universe.test.ts", "tests/boat-launches.test.ts"
];
const files = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await readFile(new URL(path, root), "utf8")])));
const has = (path: string, ...markers: string[]) => markers.every((marker) => files[path].includes(marker));

const dimensions: Array<[string, number, boolean]> = [
  ["decisionUsefulness", 20,
    has("src/lib/decision-engine.ts", "evaluateActivities", "bestWindowForActivity") &&
    has("src/lib/statewide.ts", "rankStatewideDestinations", "why", "watch") &&
    has("src/components/outdoor-intent-hub.tsx", "Go when", "Why it works", "Know before you go", "Good backups")
  ],
  ["dataQualityFreshness", 15, has("src/lib/live-data.ts", "forecast_days", "revalidate", "hourlySignals", "us_aqi")],
  ["activitySpecificIntelligence", 10, has("src/lib/decision-engine.ts", "evaluateActivity", "waterActivities", "dark-sky")],
  ["safetyUncertainty", 10, has("src/lib/decision-engine.ts", "closure", "swimHazard", "danger", "insufficient", "hardStop")],
  ["searchIntentFit", 10,
    has("src/data/specialist-tools.ts", "Michigan Beach Conditions", "Michigan Trout Report", "Northern Lights Michigan", "Michigan Fall Color") &&
    has("src/app/explore/page.tsx", "Explore Michigan outdoors.", "Michigan DNR Trails Open Data")
  ],
  ["technicalSeo", 10, has("src/app/page.tsx", "WebApplication", "FAQPage", "jsonLd")],
  ["mobileUx", 10, has("src/app/globals.css", "@media (max-width: 760px)", "@media (max-width: 560px)")],
  ["performanceResilience", 5, has("src/lib/live-data.ts", "AbortSignal.timeout", "Promise.allSettled", "revalidate")],
  ["explainabilityTrust", 5, has("src/lib/decision-engine.ts", "Decision status:", "confidence", "cautions")],
  ["platformIntegration", 5,
    has("src/app/page.tsx", "OutdoorIntentHub", "placeOptions") &&
    has("src/components/outdoor-intent-hub.tsx", "Find somewhere worth going.", "City or ZIP", "Drive up to", "Show me where to go", "specialistTools") &&
    has("src/lib/planner.ts", "great-lakes-beaches", "michigantroutreport.com", "northern-lights-michigan", "great-lakes-freighter-tracking") &&
    has("src/lib/outdoor-universe.ts", "DNRTrailsOPENDATA", "universeLayerIds", "fetchOutdoorUniverse", "longitude", "latitude") &&
    has("src/components/michigan-destination-map.tsx", "official-dnr-trail-systems", "trailSystemLayerId", "michigan-boat-launch-clusters", "michigan-boat-launch-points") &&
    has("src/lib/boat-launches.ts", "Michigan Boat Launches source-qualified inventory", "fails closed", "trailerParking") &&
    has("src/components/outdoor-intent-hub.tsx", "michiganLandscapes", "nearby through 8 hours away")
  ]
];

const fatal: string[] = [];
if (/\?\?\s*55|\|\|\s*55/.test(files["src/lib/decision-engine.ts"] + files["src/lib/planner.ts"])) fatal.push("missing-data default score");
if (!has("tests/decision-engine.test.ts", "hazard", "insufficient", "closure", "AQI", "best window")) fatal.push("required regression scenarios missing");
if (!has("src/lib/decision-engine.ts", 'score: null, status: "closed"', 'score: null, status: "danger"')) fatal.push("hard-stop override missing");
const retiredPaths = ["michigan-waterfall-conditions", "michigan-stargazing-tonight", "keweenaw-hiking-conditions", "michigan-snowshoe-conditions", "great-lakes-freighter-viewing"];
const specialistRegistry = files["src/data/specialist-tools.ts"].split("export const specialistTools")[1] ?? "";
const surfacedText = specialistRegistry + files["src/app/page.tsx"] + files["src/lib/planner.ts"];
if (retiredPaths.some((path) => surfacedText.includes(path))) fatal.push("retired or removed tool resurfaced");
if (!has("tests/specialist-tools.test.ts", "retired and removed specialist paths can never be resurfaced")) fatal.push("retired-tool regression test missing");
if (!has("tests/statewide.test.ts", "excludes specialist-only activity scoring", "does not invent scores")) fatal.push("statewide decision regressions missing");
const explorerSource = files["src/components/destination-explorer.tsx"] + files["src/components/michigan-destination-map.tsx"] + files["src/app/explore/page.tsx"];
if (/numbered pins|result-map-number|element\.textContent\s*=\s*String\(index \+ 1\)|Show all 28 places|See all 28 places/.test(explorerSource)) fatal.push("numbered-shortlist explorer resurfaced");
if (!has("tests/outdoor-universe.test.ts", "official DNR trail, closure, and reroute layers", "resultOffset", "group segments")) fatal.push("outdoor-universe regressions missing");
if (!has("tests/boat-launches.test.ts", "preserves unknown numeric fields", "drops unusable records")) fatal.push("boat-launch source-truth regressions missing");

const rows = dimensions.map(([key, weight, passed]) => ({ key, weight, score: passed ? weight : 0 }));
const score = rows.reduce((sum, row) => sum + row.score, 0);
console.log(JSON.stringify({ benchmark: "platform-quality", score, target: baseline.releaseThreshold, flagshipTarget: baseline.flagshipTarget, rows, fatal }, null, 2));
if (score < baseline.releaseThreshold || fatal.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
