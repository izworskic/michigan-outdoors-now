import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { trailSearchPages } from "../src/lib/trail-search-pages";
import {
  trailSearchExpansionGate,
  trailSearchOpportunities,
} from "../src/lib/trail-search-opportunities";

test("future trail-search opportunities remain measured candidates, not crawlable pages", () => {
  assert.ok(trailSearchOpportunities.length >= 4);
  const liveSlugs = new Set(trailSearchPages.map((page) => page.slug));
  for (const candidate of trailSearchOpportunities) {
    assert.equal(candidate.state, "blocked-until-expansion-gate");
    assert.equal(candidate.indexable, false);
    assert.ok(candidate.profileCount >= 6);
    assert.ok(candidate.destinationCount >= 3);
    assert.ok(!liveSlugs.has(candidate.slug));
  }
});

test("trail expansion gate matches the central Outdoors Now growth contract", () => {
  assert.equal(trailSearchExpansionGate.impressions, 250);
  assert.equal(trailSearchExpansionGate.clicks, 5);
  assert.equal(trailSearchExpansionGate.plannerCompletions, 10);
  assert.equal(trailSearchExpansionGate.directionsOpens, 3);
  assert.equal(trailSearchExpansionGate.completeWindowDays, 28);
});

test("candidate trail families stay out of sitemap and static route generation", async () => {
  const [sitemap, page, manifest] = await Promise.all([
    readFile(new URL("../src/app/sitemap.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/hiking/[intent]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/app/growth-manifest.json/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(sitemap, /trailSearchPages\.map/);
  assert.doesNotMatch(sitemap, /trailSearchOpportunities\.map/);
  assert.match(page, /trailSearchPages\.map/);
  assert.doesNotMatch(page, /trailSearchOpportunities/);
  assert.match(manifest, /trailSearchOpportunities/);
  assert.match(manifest, /blocked-during-location-intent-measurement-window/);
});
