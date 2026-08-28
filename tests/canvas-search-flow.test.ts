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

test("setting a typed start does not auto-open the legacy recommendation card", async () => {
  const source = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");
  const submit = functionBody(source, "function submitOrigin", "async function runDiscovery");

  assert.doesNotMatch(submit, /\bvoid\s+run\s*\(/);
  assert.match(submit, /clearOpenResults\(\)/);
  assert.match(submit, /focusWishInput\(\)/);
});

test("device location establishes origin without launching recommendations", async () => {
  const source = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");
  const useLocation = functionBody(source, "function useLocation", "function changeRange");

  assert.doesNotMatch(useLocation, /\bvoid\s+run\s*\(/);
  assert.match(useLocation, /setOrigin\("My location"\)/);
  assert.match(useLocation, /setUserLocation\(coordinates\)/);
  assert.match(useLocation, /setPlanning\(false\)/);
  assert.match(useLocation, /focusWishInput\(\)/);
});

test("free-form input stays focusable and closes any covering result sheet", async () => {
  const source = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");

  assert.match(source, /const wishInputRef = useRef<HTMLInputElement \| null>\(null\)/);
  assert.match(source, /ref=\{wishInputRef\}/);
  assert.match(source, /onFocus=\{\(\) => \{\s*setActiveId\(""\);\s*setActiveDiscoveryId\(""\);/s);
});

test("result sheet cannot cover the free-form search on desktop, tablet, or phone", async () => {
  const css = await readFile(new URL("../src/app/atlas.css", import.meta.url), "utf8");
  const discoveryCss = css.slice(css.indexOf("/* Free-form Michigan discovery */"));

  assert.match(discoveryCss, /\.canvas-sheet\{\s*top:220px;\s*\}/s);
  assert.match(
    discoveryCss,
    /@media\(max-width:900px\)[\s\S]*?\.canvas-sheet\{top:278px\}/,
  );
  assert.match(
    discoveryCss,
    /@media\(max-width:700px\)[\s\S]*?\.canvas-sheet\{\s*top:auto;\s*bottom:56px;\s*max-height:48svh;/,
  );
  assert.match(discoveryCss, /\.canvas-wish-form\{[\s\S]*?pointer-events:auto;/);
});
