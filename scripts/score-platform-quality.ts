import { readFile } from "node:fs/promises";
import process from "node:process";

const root = new URL("../", import.meta.url);
const baseline = JSON.parse(await readFile(new URL("benchmarks/platform-quality.json", root), "utf8"));
const paths = [
  "src/lib/decision-engine.ts", "src/lib/live-data.ts", "src/lib/planner.ts", "src/lib/types.ts",
  "src/data/specialist-tools.ts", "src/app/page.tsx", "src/components/result-comparison.tsx",
  "src/components/trip-decision.tsx", "src/app/globals.css", "tests/decision-engine.test.ts"
];
const files = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await readFile(new URL(path, root), "utf8")])));
const has = (path: string, ...markers: string[]) => markers.every((marker) => files[path].includes(marker));

const dimensions: Array<[string, number, boolean]> = [
  ["decisionUsefulness", 20, has("src/lib/decision-engine.ts", "evaluateActivities", "bestWindowForActivity") && has("src/components/trip-decision.tsx", "decisionStatus", "bestWindow")],
  ["dataQualityFreshness", 15, has("src/lib/live-data.ts", "forecast_days", "revalidate", "hourlySignals", "us_aqi")],
  ["activitySpecificIntelligence", 10, has("src/lib/decision-engine.ts", "evaluateActivity", "waterActivities", "dark-sky")],
  ["safetyUncertainty", 10, has("src/lib/decision-engine.ts", "closure", "swimHazard", "danger", "insufficient", "hardStop")],
  ["searchIntentFit", 10, has("src/data/specialist-tools.ts", "Best Michigan Beaches Today", "Michigan Waterfall Conditions", "Michigan Fall Color")],
  ["technicalSeo", 10, has("src/app/page.tsx", "WebApplication", "FAQPage", "jsonLd")],
  ["mobileUx", 10, has("src/app/globals.css", "@media (max-width: 760px)", "@media (max-width: 560px)")],
  ["performanceResilience", 5, has("src/lib/live-data.ts", "AbortSignal.timeout", "Promise.allSettled", "revalidate")],
  ["explainabilityTrust", 5, has("src/lib/decision-engine.ts", "Decision status:", "confidence", "cautions")],
  ["platformIntegration", 5, has("src/app/page.tsx", "LIVE DECISION LAYER", "specialistTools")]
];

const fatal: string[] = [];
if (/\?\?\s*55|\|\|\s*55/.test(files["src/lib/decision-engine.ts"] + files["src/lib/planner.ts"])) fatal.push("missing-data default score");
if (!has("tests/decision-engine.test.ts", "hazard", "insufficient", "closure", "AQI", "best window")) fatal.push("required regression scenarios missing");
if (!has("src/lib/decision-engine.ts", 'score: null, status: "closed"', 'score: null, status: "danger"')) fatal.push("hard-stop override missing");

const rows = dimensions.map(([key, weight, passed]) => ({ key, weight, score: passed ? weight : 0 }));
const score = rows.reduce((sum, row) => sum + row.score, 0);
console.log(JSON.stringify({ benchmark: "platform-quality", score, target: baseline.releaseThreshold, flagshipTarget: baseline.flagshipTarget, rows, fatal }, null, 2));
if (score < baseline.releaseThreshold || fatal.length) process.exit(1);
