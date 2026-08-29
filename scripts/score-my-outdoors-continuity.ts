#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const root = path.resolve(import.meta.dirname, "..");
  const read = (file: string) => readFile(path.join(root, file), "utf8");

  const [
    memory,
    drawer,
    placeActions,
    hub,
    planner,
    discoverRoute,
    discovery,
    contract,
    brief,
    docs,
  ] = await Promise.all([
    read("src/lib/my-outdoors.ts"),
    read("src/components/my-outdoors-drawer.tsx"),
    read("src/components/place-memory-actions.tsx"),
    read("src/components/outdoor-intent-hub.tsx"),
    read("src/components/planner.tsx"),
    read("src/app/api/discover/route.ts"),
    read("src/lib/discovery.ts"),
    read("src/lib/growth-contract.ts"),
    read("scripts/build-growth-brief.ts"),
    read("docs/my-michigan-outdoors.md"),
  ]);

  const profileShape = memory.slice(
    memory.indexOf("export type MyOutdoorsProfile"),
    memory.indexOf("function nowIso"),
  );

  const sharedIndex = planner.indexOf("parsePlannerFragment(window.location.hash)");
  const memoryIndex = planner.indexOf("readMyOutdoorsProfile()", sharedIndex);

  const checks = [
    ["browser-local persistence", /localStorage\.setItem/.test(memory) && /localStorage\.getItem/.test(memory)],
    ["no coordinates in stored profile", !/latitude|longitude|coordinates/.test(profileShape)],
    ["device location label not persisted as home", /trimmed === "My location"/.test(drawer)],
    ["shared-plan precedence", sharedIndex >= 0 && memoryIndex > sharedIndex],
    ["verified preference mode", /strictPreferenceMode/.test(discoverRoute) && /verified household\/access attributes/.test(discoverRoute)],
    ["curated household filtering", /destination\.kidsFriendly/.test(discovery) && /destination\.dogsAllowed/.test(discovery) && /destination\.accessibleFriendly/.test(discovery)],
    ["secondary planner continuity", /My Outdoors start, range, and usual constraints loaded/.test(planner)],
    ["saved and visited place controls", /Save to My Outdoors/.test(placeActions) && /Been there/.test(placeActions)],
    ["continuity event taxonomy", /my_outdoors_loaded/.test(contract) && /my_outdoors_place_saved/.test(contract)],
    ["weekly continuity measurement", /My Outdoors continuity/.test(brief) && /my_outdoors_opened/.test(brief)],
    ["privacy contract", /must not record/.test(docs) && /favorite-region text/.test(docs)],
    ["result-first drawer", /MyOutdoorsDrawer/.test(hub) && /canvas-links/.test(hub)],
  ] as const;

  const score = Math.round(
    (checks.filter(([, passed]) => passed).length / checks.length) * 100,
  );

  console.log(`My Michigan Outdoors continuity score: ${score}/100`);
  for (const [name, passed] of checks) {
    console.log(`${passed ? "PASS" : "FAIL"}  ${name}`);
  }

  if (score < 92) {
    throw new Error(`My Outdoors continuity score ${score} is below release target 92.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
