import { readFile } from "node:fs/promises";
import process from "node:process";

async function main() {
  const root = new URL("../", import.meta.url);
  const benchmark = JSON.parse(await readFile(new URL("benchmarks/interface-loss.json", root), "utf8"));
  const paths = [
    "src/app/page.tsx",
    "src/components/outdoor-intent-hub.tsx",
    "src/app/globals.css",
    "src/app/atlas.css",
    "src/data/specialist-tools.ts",
  ];
  const files = Object.fromEntries(
    await Promise.all(paths.map(async (path) => [path, await readFile(new URL(path, root), "utf8")])),
  );

  const page = files["src/app/page.tsx"];
  const hub = files["src/components/outdoor-intent-hub.tsx"];
  const css = files["src/app/globals.css"] + "\n" + files["src/app/atlas.css"];
  const specialists = files["src/data/specialist-tools.ts"];
  const penalties = [];

  const hasDirectExploration =
    hub.includes("MichiganDestinationMap") &&
    hub.includes("What are you after?") &&
    hub.includes("Best now") &&
    hub.includes("Water") &&
    hub.includes("Trail") &&
    hub.includes("River") &&
    hub.includes("After dark") &&
    hub.includes("Long haul") &&
    hub.includes("Weekend") &&
    hub.includes('className="canvas-pulls"');
  penalties.push({ key: "intentRecognition", max: 20, loss: hasDirectExploration ? 0 : 20 });

  const detachedMapFirst = page.includes("DestinationExplorer");
  const immediateCanvas =
    hub.includes("Drag the map. Tap anything.") &&
    hub.includes("Start from a city or ZIP") &&
    hub.includes("onActivate={setActiveId}") &&
    hub.includes("choosePull");
  penalties.push({ key: "timeToValue", max: 20, loss: detachedMapFirst ? 20 : immediateCanvas ? 0 : 10 });

  const primaryText = (page + hub).toLowerCase();
  const jargon = ["decision-ready", "decision ready", "dnr layer", "structured context", "data model", "discovery universe"]
    .filter((phrase) => primaryText.includes(phrase));
  penalties.push({ key: "architectureJargon", max: 15, loss: Math.min(15, jargon.length * 5) });

  const completeDecision =
    hub.includes("Why this one") &&
    hub.includes("Directions") &&
    hub.includes("Show another") &&
    hub.includes("Also making a case");
  penalties.push({ key: "decisionCompleteness", max: 15, loss: completeDecision ? 0 : 15 });

  const clearTravelRadius =
    hub.includes("Use my current location") &&
    hub.includes('id: "long"') &&
    hub.includes("driveHours: 8") &&
    hub.includes("Go farther") &&
    hub.includes("Stay closer");
  penalties.push({ key: "locationAndRadiusClarity", max: 10, loss: clearTravelRadius ? 0 : 10 });

  const activityTruth =
    hub.includes('activities: ["paddling", "beaches", "scenic"]') &&
    hub.includes('activities: ["fishing", "paddling", "scenic"]') &&
    hub.includes('activities: ["dark-sky", "scenic"]') &&
    specialists.includes("Michigan Beach Conditions") &&
    specialists.includes("Michigan Trout Report") &&
    specialists.includes("Michigan Birding Report") &&
    specialists.includes("Northern Lights Michigan");
  penalties.push({ key: "activityTruth", max: 10, loss: activityTruth ? 0 : 10 });

  const recovery =
    hub.includes("Go farther") &&
    hub.includes("Stay closer") &&
    hub.includes("Show another") &&
    hub.includes("Return to");
  penalties.push({ key: "recoveryAlternatives", max: 5, loss: recovery ? 0 : 5 });

  const hierarchy =
    css.includes(".michigan-canvas") &&
    css.includes(".canvas-topbar") &&
    css.includes(".canvas-pulls") &&
    css.includes(".canvas-sheet") &&
    css.includes("@media(max-width:700px)") &&
    page.includes("OutdoorIntentHub");
  penalties.push({ key: "visualHierarchy", max: 5, loss: hierarchy ? 0 : 5 });

  const total = penalties.reduce((sum, item) => sum + item.loss, 0);
  const fatal = [];
  if (detachedMapFirst) fatal.push("homepage falls back to the detached explorer instead of the integrated canvas");
  if (!hasDirectExploration) fatal.push("direct map exploration and meaningful pulls are missing");
  if (jargon.length >= 2) fatal.push("architecture jargon dominates primary user copy");
  if (!immediateCanvas || !clearTravelRadius) fatal.push("the persistent canvas cannot branch naturally from map exploration and a starting point");
  if (!completeDecision) fatal.push("map selection sheet lacks why/directions/alternate branches");
  if (!activityTruth) fatal.push("specialist-dependent activities are flattened");

  console.log(JSON.stringify({
    benchmark: "persona-task-interface-loss",
    direction: "lower-is-better",
    baselineLoss: benchmark.baselineLoss,
    loss: total,
    releaseTarget: benchmark.releaseTarget,
    flagshipTarget: benchmark.flagshipTarget,
    deltaFromBaseline: total - benchmark.baselineLoss,
    penalties,
    jargon,
    fatal,
  }, null, 2));

  if (total > benchmark.releaseTarget || fatal.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
