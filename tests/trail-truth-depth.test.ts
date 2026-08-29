import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { trailProfiles } from "../src/data/trail-profiles";
import { trailTruthCoverageSummary } from "../src/data/trail-truth-coverage";

test("Trail Truth depth catalog clears the 100-route threshold without duplicate ids", () => {
  assert.ok(trailProfiles.length >= 100, `expected at least 100 Trail Truth profiles, got ${trailProfiles.length}`);
  assert.equal(new Set(trailProfiles.map((profile) => profile.id)).size, trailProfiles.length);
});

test("depth is concentrated into useful multi-route destinations", () => {
  const countFor = (destinationId: string) =>
    trailProfiles.filter((profile) => profile.destinationId === destinationId).length;

  assert.ok(countFor("pictured-rocks") >= 10);
  assert.ok(countFor("sleeping-bear") >= 15);
  assert.ok(countFor("kensington-metropark") >= 5);
  assert.ok(countFor("hartwick-pines") >= 7);
  assert.ok(countFor("ludington-state-park") >= 7);
  assert.ok(countFor("manistee-river") >= 2);
});

test("catalog depth keeps source and route-shape discipline", () => {
  for (const profile of trailProfiles) {
    assert.ok(profile.sourceLabel.trim(), `${profile.id} missing source label`);
    assert.match(profile.sourceUrl, /^https:\/\//, `${profile.id} missing official source URL`);
    assert.ok(profile.distanceMiles > 0, `${profile.id} missing positive distance`);
    assert.ok(
      ["loop", "out-and-back", "point-to-point", "network"].includes(profile.routeKind),
      `${profile.id} missing route shape`,
    );
  }
});

test("depth metrics track named trailheads and genuinely deep destinations", () => {
  assert.ok(trailTruthCoverageSummary.profileCount >= 100);
  assert.ok(trailTruthCoverageSummary.namedTrailheadCount >= 35);
  assert.ok(trailTruthCoverageSummary.multiRouteDestinationCount >= 15);
  assert.ok(trailTruthCoverageSummary.deepDestinationCount >= 8);
});

test("large local trail catalogs stay compact until expanded", async () => {
  const hub = await readFile(
    new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url),
    "utf8",
  );

  assert.match(hub, /visibleTrailProfiles/);
  assert.match(hub, /slice\(0, 6\)/);
  assert.match(hub, /Show all \$\{activeTrailProfiles\.length\} verified routes/);
  assert.match(hub, /Show the best few/);
});

test("official route geometry can fill navigation gaps without pretending mapped fallback is official", async () => {
  const [live, hub] = await Promise.all([
    readFile(new URL("../src/lib/trail-live.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(live, /official-geometry/);
  assert.match(live, /mapped-fallback/);
  assert.match(hub, /Official mapped route start/);
  assert.match(hub, /Mapped route start — verify before departure/);
});
