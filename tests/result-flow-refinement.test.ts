import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("semantic results live in a persistent map dock instead of the top query stack", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/atlas.css", import.meta.url), "utf8");

  assert.match(hub, /className="canvas-result-dock"/);
  assert.match(hub, /className="canvas-result-rail"/);
  assert.doesNotMatch(hub, /className="canvas-wish-results"/);
  assert.match(hub, /discovery\.places\.slice\(0, 8\)/);
  assert.match(css, /\.canvas-result-dock\{[\s\S]*?position:absolute;/);
  assert.match(css, /\.canvas-result-rail\{[\s\S]*?overflow-x:auto;[\s\S]*?scroll-snap-type:x proximity;/);
  assert.match(css, /@media\(max-width:700px\)[\s\S]*?\.canvas-result-rail\{[\s\S]*?scroll-snap-type:x mandatory;/);
});

test("opening and closing detail preserves the result dock", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");

  assert.match(hub, /onClick=\{\(\) => activateDiscovery\(place\.id\)\}/);
  assert.match(hub, /setFocusPoint\(\{[\s\S]*?latitude: place\.latitude,[\s\S]*?longitude: place\.longitude/);
  assert.match(hub, /canvas-sheet-discovery/);
  assert.match(hub, /aria-label="Close place detail">×<\/button>/);
});

test("Go farther requests only the newly unlocked distance band", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../src/app/api/discover/route.ts", import.meta.url), "utf8");

  assert.match(hub, /const previousMax = driveHours/);
  assert.match(hub, /runDiscovery\(discovery\.query, next, delta > 0 \? previousMax : 0\)/);
  assert.match(hub, /minDriveHours: minDriveOverride/);
  assert.match(route, /minDriveHours\?: number/);
  assert.match(route, /const minDriveHours = Math\.max\(0, body\.minDriveHours \?\? 0\)/);
  assert.match(route, /place\.driveHours \+ 0\.05 >= minDriveHours/);
  assert.match(route, /metrics\.driveHours \+ 0\.05 < args\.minDriveHours/);
});

test("the result UI tells the user whether results are inclusive or farther-only", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");

  assert.match(hub, /Farther-out results/);
  assert.match(hub, /Up to \$\{driveHours\} hr from your start/);
  assert.match(hub, /Show all within \{driveHours\} hr/);
});

test("discovery detail sits above the persistent dock on phone and desktop", async () => {
  const css = await readFile(new URL("../src/app/atlas.css", import.meta.url), "utf8");

  assert.match(css, /\.canvas-sheet-discovery\{\s*bottom:154px;/);
  assert.match(css, /@media\(max-width:700px\)[\s\S]*?\.canvas-sheet-discovery\{\s*bottom:148px;\s*max-height:44svh;/);
});
