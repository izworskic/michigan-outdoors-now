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
    await readFile(new URL("benchmarks/persona-taste-result-first.json", root), "utf8"),
  ) as Benchmark;

  const files = Object.fromEntries(
    await Promise.all([
      "src/components/outdoor-intent-hub.tsx",
      "src/app/atlas.css",
      "tests/result-flow-refinement.test.ts",
      "docs/persona-taste-system.md",
    ].map(async (path) => [path, await readFile(new URL(path, root), "utf8")])),
  ) as Record<string, string>;

  const hub = files["src/components/outdoor-intent-hub.tsx"];
  const css = files["src/app/atlas.css"];
  const tests = files["tests/result-flow-refinement.test.ts"];
  const taste = files["docs/persona-taste-system.md"];

  const checks: Record<string, boolean> = {
    resultFirstHierarchy:
      hub.includes("has-discovery-results") &&
      hub.includes('className="canvas-result-dock"') &&
      css.includes(".canvas-result-dock{\n  position:fixed;") &&
      css.includes("top:74px;") &&
      taste.includes("Returned data wins"),
    brandYieldsToTask:
      css.includes(".has-discovery-results .canvas-brand strong{\n  display:none;") &&
      /@media\(max-width:700px\)[\s\S]*?\.has-discovery-results \.canvas-brand,[\s\S]*?\.has-discovery-results \.canvas-links\{\s*display:none;/.test(css),
    allReturnedPlacesReachable:
      hub.includes("discovery.places.map((place, index)") &&
      !hub.includes("discovery.places.slice(0, 8)") &&
      taste.includes("All real results are reachable"),
    decisionDenseCards:
      hub.includes("canvas-result-rank") &&
      hub.includes("canvas-result-facts") &&
      hub.includes("discoveryDriveLabel(place)") &&
      hub.includes("{place.categoryLabel}") &&
      hub.includes("<p>{place.why}</p>"),
    continuousResultNavigation:
      hub.includes("function moveDiscoverySelection(delta: number)") &&
      hub.includes('className="canvas-detail-nav"') &&
      hub.includes("moveDiscoverySelection(-1)") &&
      hub.includes("moveDiscoverySelection(1)") &&
      hub.includes('inline: "center"'),
    progressiveDetail:
      css.includes(".has-active-discovery .canvas-sheet h1{") &&
      css.includes("font-size:clamp(25px,2.7vw,32px);") &&
      css.includes(".has-active-discovery .canvas-sheet-summary{") &&
      css.includes("background:#eef4f1;"),
    mobileViewportPriority:
      /@media\(max-width:700px\)[\s\S]*?\.canvas-result-dock\{[\s\S]*?position:fixed;[\s\S]*?top:103px;/.test(css) &&
      /@media\(max-width:700px\)[\s\S]*?\.has-discovery-results \.canvas-brand,[\s\S]*?display:none;/.test(css),
    regressionCoverage:
      tests.includes("every returned destination") &&
      tests.includes("continuous previous and next navigation") &&
      tests.includes("mobile search explicitly reveals returned result cards"),
  };

  const scored = benchmark.criteria.map((criterion) => ({
    ...criterion,
    passed: Boolean(checks[criterion.key]),
    score: checks[criterion.key] ? criterion.weight : 0,
  }));
  const score = scored.reduce((sum, item) => sum + item.score, 0);
  const criticalFailures = [
    "resultFirstHierarchy",
    "allReturnedPlacesReachable",
    "continuousResultNavigation",
    "mobileViewportPriority",
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
