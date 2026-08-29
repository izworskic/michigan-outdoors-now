#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const root = path.resolve(import.meta.dirname, "..");
  const read = (file: string) => readFile(path.join(root, file), "utf8");

  const [
    memory,
    changes,
    drawer,
    opportunities,
    contract,
    analytics,
    brief,
    docs,
    hub,
    tests,
  ] = await Promise.all([
    read("src/lib/my-outdoors.ts"),
    read("src/lib/my-outdoors-changes.ts"),
    read("src/components/my-outdoors-drawer.tsx"),
    read("src/app/api/opportunities/route.ts"),
    read("src/lib/growth-contract.ts"),
    read("scripts/fetch-vercel-product-events.mjs"),
    read("scripts/build-growth-brief.ts"),
    read("docs/my-michigan-outdoors.md"),
    read("src/components/outdoor-intent-hub.tsx"),
    read("tests/my-outdoors-changes.test.ts"),
  ]);

  const baselineShape = memory.slice(
    memory.indexOf("export type OpportunityBaseline"),
    memory.indexOf("export type MyOutdoorsProfile"),
  );

  const checks = [
    ["local opportunity baseline", /opportunityBaselines/.test(memory) && !/latitude|longitude|name|area/.test(baselineShape)],
    ["public statewide comparison", /scope === "all"/.test(opportunities) && /destinations.length/.test(opportunities)],
    ["no saved-place request payload", /fetch\("\/api\/opportunities\?scope=all"\)/.test(drawer) && !/placeIds/.test(drawer)],
    ["first check is baseline only", /if \(!previous \|\| !now \|\| !opportunity\) continue/.test(changes)],
    ["new-window threshold", /!previous\.qualifies && now\.qualifies/.test(changes)],
    ["material stronger threshold", /scoreDelta >= 8/.test(changes) && /strengthDelta >= 10/.test(changes)],
    ["small-fluctuation tests", /Small fluctuations|small fluctuations/.test(tests)],
    ["seen baseline waits for drawer open", /markChangesSeen\(\)/.test(drawer) && drawer.indexOf("markChangesSeen();") < drawer.indexOf("setOpen(true)")],
    ["compact changed badge", /changeBadge/.test(drawer) && /changed/.test(drawer)],
    ["no second homepage block", /MyOutdoorsDrawer/.test(hub) && !/Something got better/.test(hub)],
    ["privacy-safe change analytics", /my_outdoors_changes_detected/.test(contract) && /scoreBand/.test(drawer) && !/destination: change/.test(drawer)],
    ["weekly repeat-use measurement", /my_outdoors_change_opened/.test(analytics) && /Material changes detected/.test(brief)],
    ["documented truth boundary", /The first check only establishes a baseline/.test(docs) && /does not send the visitor's saved-place list/.test(docs)],
  ] as const;

  const score = Math.round((checks.filter(([, passed]) => passed).length / checks.length) * 100);

  console.log(`My Outdoors return-visit change score: ${score}/100`);
  for (const [name, passed] of checks) {
    console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  }

  if (score < 92) {
    throw new Error(`Return-visit change score ${score} is below release target 92.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
