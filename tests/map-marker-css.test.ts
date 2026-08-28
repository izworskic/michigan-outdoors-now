import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("destination marker CSS does not override MapLibre coordinate transforms", async () => {
  const css = await readFile(new URL("../src/app/atlas.css", import.meta.url), "utf8");

  const markerBlocks = [...css.matchAll(/\.michigan-canvas \.destination-pin-decision(?:[^\{]*)\{([^}]*)\}/g)]
    .map((match) => match[1]);

  assert.ok(markerBlocks.length >= 2, "expected destination marker CSS blocks");
  assert.ok(
    markerBlocks.some((block) => /position\s*:\s*absolute/i.test(block)),
    "destination marker must remain absolutely positioned for MapLibre",
  );
  assert.equal(
    markerBlocks.some((block) => /position\s*:\s*relative/i.test(block)),
    false,
    "destination marker must not be changed to relative positioning",
  );
  assert.equal(
    markerBlocks.some((block) => /\btransform\s*:/i.test(block)),
    false,
    "destination marker element must not override MapLibre's inline transform",
  );
});
