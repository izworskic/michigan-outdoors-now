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

  const hasAdventureChoice =
    hub.includes("Choose your adventure") &&
    hub.includes("Keep it close") &&
    hub.includes("Find water") &&
    hub.includes("Head north") &&
    hub.includes("Disappear for a while") &&
    hub.includes("Chase sunset") &&
    hub.includes("Give me a river") &&
    hub.includes("Make it a big day") &&
    hub.includes("Wait for dark") &&
    hub.includes("Make a weekend of it") &&
    hub.includes("Surprise me") &&
    hub.includes('className="adventure-deck"');
  penalties.push({ key: "intentRecognition", max: 20, loss: hasAdventureChoice ? 0 : 20 });

  const mapFirst = page.includes("DestinationExplorer") || page.includes("MichiganDestinationMap");
  const tripScopeFirst =
    hub.includes("Starting from") &&
    hub.includes("Pick a pull") &&
    hub.includes("chooseAdventure") &&
    hub.includes("No setup wizard");
  penalties.push({ key: "timeToValue", max: 20, loss: mapFirst ? 20 : tripScopeFirst ? 0 : 10 });

  const primaryText = (page + hub).toLowerCase();
  const jargon = ["decision-ready", "decision ready", "dnr layer", "structured context", "data model", "discovery universe"]
    .filter((phrase) => primaryText.includes(phrase));
  penalties.push({ key: "architectureJargon", max: 15, loss: Math.min(15, jargon.length * 5) });

  const completeDecision =
    hub.includes("Why now") &&
    hub.includes("Best window") &&
    hub.includes("One thing to watch") &&
    hub.includes("Keep wandering");
  penalties.push({ key: "decisionCompleteness", max: 15, loss: completeDecision ? 0 : 15 });

  const clearTravelRadius =
    hub.includes("Use my current location") &&
    hub.includes("driveHours: 8") &&
    hub.includes("What if we kept driving?") &&
    hub.includes("Bring it closer") &&
    hub.includes("one way");
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
    hub.includes("What if we kept driving?") &&
    hub.includes("Bring it closer") &&
    hub.includes("Change the vibe") &&
    hub.includes("Nothing is making a strong case yet");
  penalties.push({ key: "recoveryAlternatives", max: 5, loss: recovery ? 0 : 5 });

  const hierarchy =
    css.includes(".adventure-deck") &&
    css.includes(".adventure-lead") &&
    css.includes(".adventure-wander") &&
    css.includes(".adventure-free-roam") &&
    css.includes("@media(max-width:700px)") &&
    page.includes("OutdoorIntentHub");
  penalties.push({ key: "visualHierarchy", max: 5, loss: hierarchy ? 0 : 5 });

  const total = penalties.reduce((sum, item) => sum + item.loss, 0);
  const fatal = [];
  if (mapFirst) fatal.push("homepage starts with the map instead of user intent");
  if (!hasAdventureChoice) fatal.push("adventure branches are missing");
  if (jargon.length >= 2) fatal.push("architecture jargon dominates primary user copy");
  if (!tripScopeFirst || !clearTravelRadius) fatal.push("adventure choice cannot branch naturally from a starting point");
  if (!completeDecision) fatal.push("primary answer lacks why/window/watch-out/wandering alternatives");
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
