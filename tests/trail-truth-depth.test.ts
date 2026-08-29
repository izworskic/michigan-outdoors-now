import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { trailProfiles } from "../src/data/trail-profiles";
import { trailTruthCoverageSummary } from "../src/data/trail-truth-coverage";

test("Trail Truth depth catalog clears the 125-route threshold without duplicate ids", () => {
  assert.ok(trailProfiles.length >= 125, `expected at least 125 Trail Truth profiles, got ${trailProfiles.length}`);
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
  assert.ok(countFor("warren-dunes") >= 11);
  assert.ok(countFor("petoskey-state-park") >= 4);
  assert.ok(countFor("mackinac-island") >= 2);
  assert.ok(countFor("tawas-point") >= 2);
  assert.ok(countFor("ocqueoc-falls") >= 2);
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
  assert.ok(trailTruthCoverageSummary.profileCount >= 125);
  assert.ok(trailTruthCoverageSummary.namedTrailheadCount >= 45);
  assert.ok(trailTruthCoverageSummary.multiRouteDestinationCount >= 21);
  assert.ok(trailTruthCoverageSummary.deepDestinationCount >= 10);
  assert.ok(trailTruthCoverageSummary.oneRouteDestinationCount <= 7);
  assert.ok(trailTruthCoverageSummary.shallowDestinationCount <= 11);
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


test("shallow-destination attack preserves honest numbered-route semantics", () => {
  const warren = trailProfiles.filter((profile) => profile.destinationId === "warren-dunes");
  const numbered = warren.filter((profile) => profile.id.startsWith("warren-foot-"));
  assert.ok(numbered.length >= 10);
  assert.ok(numbered.every((profile) => profile.sourceLabel === "Michigan DNR"));
  assert.ok(numbered.every((profile) => /warren_dunes_map\.pdf/i.test(profile.sourceUrl)));
  assert.ok(numbered.some((profile) => profile.routeKind === "network"));
  assert.ok(numbered.some((profile) => profile.routeKind === "loop"));
});

test("current official maps deepen Petoskey without erasing the representative routes", () => {
  const petoskey = trailProfiles.filter((profile) => profile.destinationId === "petoskey-state-park");
  assert.ok(petoskey.some((profile) => profile.id === "petoskey-old-baldy"));
  assert.ok(petoskey.some((profile) => profile.id === "petoskey-portage"));
  assert.ok(petoskey.some((profile) => profile.id === "petoskey-campground-trail"));
  assert.ok(petoskey.some((profile) => profile.id === "petoskey-portage-difficult"));
});
