import { readFile } from "node:fs/promises";
import process from "node:process";

async function main() {
  const root = new URL("../", import.meta.url);
  const benchmark = JSON.parse(await readFile(new URL("benchmarks/interface-loss.json", root), "utf8"));
  const paths = [
    "src/app/page.tsx",
    "src/components/outdoor-intent-hub.tsx",
    "src/app/globals.css",
    "src/data/specialist-tools.ts",
  ];
  const files = Object.fromEntries(
    await Promise.all(paths.map(async (path) => [path, await readFile(new URL(path, root), "utf8")])),
  );

  const page = files["src/app/page.tsx"];
  const hub = files["src/components/outdoor-intent-hub.tsx"];
  const css = files["src/app/globals.css"];
  const specialists = files["src/data/specialist-tools.ts"];
  const penalties = [];

  const hasFourIntents =
    hub.includes("I want to get outside today") &&
    hub.includes("Help me plan this weekend") &&
    hub.includes("I already know the place") &&
    hub.includes("I know what I want to do");
  penalties.push({ key: "intentRecognition", max: 20, loss: hasFourIntents ? 0 : 20 });

  const mapFirst = page.includes("DestinationExplorer") || page.includes("MichiganDestinationMap");
  const tripScopeFirst =
    hub.includes("Where are you starting, and how far would you go?") &&
    hub.includes("Starting city or ZIP") &&
    hub.includes("Maximum one-way drive") &&
    hub.includes("Find my best options within");
  penalties.push({ key: "timeToValue", max: 20, loss: mapFirst ? 20 : tripScopeFirst ? 0 : 10 });

  const primaryText = (page + hub).toLowerCase();
  const jargon = ["decision-ready", "decision ready", "dnr layer", "structured context", "data model", "discovery universe"]
    .filter((phrase) => primaryText.includes(phrase));
  penalties.push({ key: "architectureJargon", max: 15, loss: Math.min(15, jargon.length * 5) });

  const completeDecision =
    hub.includes("Go when") &&
    hub.includes("Why it works") &&
    hub.includes("Know before you go") &&
    hub.includes("Good backups");
  penalties.push({ key: "decisionCompleteness", max: 15, loss: completeDecision ? 0 : 15 });

  const clearTravelRadius =
    hub.includes("Use my location") &&
    hub.includes("Maximum one-way drive") &&
    hub.includes("Up to 8 hours") &&
    hub.includes("nearby through 8 hours away") &&
    hub.includes("This is a radius, not a target.");
  penalties.push({ key: "locationAndRadiusClarity", max: 10, loss: clearTravelRadius ? 0 : 10 });

  const activityTruth =
    hub.includes("Different activities need different data") &&
    specialists.includes("Michigan Beach Conditions") &&
    specialists.includes("Michigan Trout Report") &&
    specialists.includes("Michigan Birding Report") &&
    specialists.includes("Northern Lights Michigan");
  penalties.push({ key: "activityTruth", max: 10, loss: activityTruth ? 0 : 10 });

  const recovery =
    hub.includes("Good backups inside your range") &&
    hub.includes("No strong match showed up inside your") &&
    hub.includes("Try a wider travel limit");
  penalties.push({ key: "recoveryAlternatives", max: 5, loss: recovery ? 0 : 5 });

  const hierarchy =
    css.includes(".persona-intent-grid") &&
    css.includes(".persona-lead-card") &&
    css.includes(".persona-landscapes") &&
    css.includes("@media(max-width:700px)") &&
    page.includes("OutdoorIntentHub");
  penalties.push({ key: "visualHierarchy", max: 5, loss: hierarchy ? 0 : 5 });

  const total = penalties.reduce((sum, item) => sum + item.loss, 0);
  const fatal = [];
  if (mapFirst) fatal.push("homepage starts with the map instead of user intent");
  if (!hasFourIntents) fatal.push("required user-intent paths missing");
  if (jargon.length >= 2) fatal.push("architecture jargon dominates primary user copy");
  if (!tripScopeFirst || !clearTravelRadius) fatal.push("location and maximum travel radius are not explicit before recommendation");
  if (!completeDecision) fatal.push("primary answer lacks where/when/why/watch-out/alternative");
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
