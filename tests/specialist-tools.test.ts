import assert from "node:assert/strict";
import test from "node:test";
import { retiredSpecialistPaths, specialistTools } from "../src/data/specialist-tools.ts";

test("homepage specialist registry contains only verified, unique live destinations", () => {
  assert.equal(new Set(specialistTools.map((tool) => tool.id)).size, specialistTools.length);
  assert.ok(specialistTools.every((tool) => tool.url.startsWith("https://")));
  assert.ok(specialistTools.every((tool) => tool.verifiedAt === "2026-08-27"));
});

test("retired and removed specialist paths can never be resurfaced", () => {
  const registry = JSON.stringify(specialistTools);
  for (const retired of retiredSpecialistPaths) assert.doesNotMatch(registry, new RegExp(retired));
});
