import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function functionBody(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0, `missing ${start}`);
  assert.ok(to > from, `missing boundary ${end}`);
  return source.slice(from, to);
}

test("typed start resolves through the origin endpoint before intent search", async () => {
  const source = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");
  const resolver = functionBody(source, "async function resolveTypedOrigin", "function submitOrigin");
  const submit = functionBody(source, "function submitOrigin", "async function runDiscovery");

  assert.match(resolver, /fetch\("\/api\/origin"/);
  assert.match(resolver, /setOriginCoordinates\(coordinates\)/);
  assert.match(resolver, /setUserLocation\(coordinates\)/);
  assert.match(resolver, /setOriginStatus\("resolved"\)/);
  assert.match(resolver, /setFocusPoint\(/);
  assert.match(submit, /resolveTypedOrigin\(\)/);
  assert.match(submit, /focusWishInput\(\)/);
});

test("intent search self-heals an unresolved typed start", async () => {
  const source = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");
  const discovery = functionBody(source, "async function runDiscovery", "function submitDiscovery");

  assert.match(discovery, /if \(!coordinates\)/);
  assert.match(discovery, /await resolveTypedOrigin\(chosenOrigin\)/);
  assert.match(discovery, /originCoordinates: coordinates/);
});

test("device location populates the same resolved-origin state", async () => {
  const source = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");
  const useLocation = functionBody(source, "function useLocation", "function changeRange");

  assert.match(useLocation, /setOriginCoordinates\(coordinates\)/);
  assert.match(useLocation, /setUserLocation\(coordinates\)/);
  assert.match(useLocation, /setOriginStatus\("resolved"\)/);
  assert.match(useLocation, /setOriginFeedback\("Starting from your current location"\)/);
  assert.match(useLocation, /setFocusPoint\(/);
});

test("search completion shows choices without auto-opening a detail sheet", async () => {
  const source = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /setActiveDiscoveryId\(result\.places\[0\]/);
  assert.match(source, /className="canvas-result-dock"/);
  assert.match(source, /discovery\.places\.slice\(0, 8\)/);
  assert.match(source, /onClick=\{\(\) => activateDiscovery\(place\.id\)\}/);
});

test("location and intent controls stay in one non-overlapping layout stack", async () => {
  const source = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/atlas.css", import.meta.url), "utf8");

  assert.match(source, /className="canvas-query-stack"/);
  assert.match(source, /canvas-origin-status/);
  assert.match(source, /canvas-message canvas-message-inline/);
  assert.match(css, /\.canvas-query-stack\{[\s\S]*?display:grid;/);
  assert.match(css, /\.canvas-wish\{[\s\S]*?position:static;/);
  assert.match(css, /\.canvas-message-inline\{[\s\S]*?position:static;/);
  assert.match(css, /@media\(max-width:700px\)[\s\S]*?\.canvas-sheet\{\s*top:auto;\s*bottom:56px;/);
});
