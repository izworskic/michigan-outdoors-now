import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { trailProfiles } from "../src/data/trail-profiles";
import { trailTruthCoverageSummary } from "../src/data/trail-truth-coverage";

test("Trail Truth depth catalog clears the 127-route threshold without duplicate ids", () => {
  assert.ok(trailProfiles.length >= 127, `expected at least 127 Trail Truth profiles, got ${trailProfiles.length}`);
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
  assert.ok(countFor("jordan-river") >= 2);
  assert.ok(countFor("presque-isle-marquette") >= 2);
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
  assert.ok(trailTruthCoverageSummary.profileCount >= 127);
  assert.ok(trailTruthCoverageSummary.namedTrailheadCount >= 50);
  assert.ok(trailTruthCoverageSummary.officialEntryPointCount >= 20);
  assert.ok(trailTruthCoverageSummary.multiRouteDestinationCount >= 23);
  assert.ok(trailTruthCoverageSummary.deepDestinationCount >= 10);
  assert.ok(trailTruthCoverageSummary.oneRouteDestinationCount <= 5);
  assert.ok(trailTruthCoverageSummary.shallowDestinationCount <= 11);
  assert.ok(trailTruthCoverageSummary.operationallyThinDestinationCount <= 1);
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


test("hard-source pass adds Warner Creek and Presque Isle Bog Walk without invented route mileage", () => {
  const warner = trailProfiles.find((profile) => profile.id === "jordan-warner-creek-pathway");
  assert.equal(warner?.distanceMiles, 3.8);
  assert.equal(warner?.routeKind, "loop");
  assert.equal(warner?.sourceLabel, "Michigan DNR");

  const bogWalk = trailProfiles.find((profile) => profile.id === "presque-isle-bog-walk");
  assert.equal(bogWalk?.distanceMiles, 0.5);
  assert.equal(bogWalk?.routeKind, "network");
  assert.equal(bogWalk?.sourceLabel, "City of Marquette");
});

test("single-route networks gain official entry-point depth instead of invented extra routes", () => {
  const countFor = (destinationId: string) =>
    trailProfiles.filter((profile) => profile.destinationId === destinationId).length;
  const entryCountFor = (destinationId: string) =>
    trailProfiles
      .filter((profile) => profile.destinationId === destinationId)
      .reduce((sum, profile) => sum + (profile.access?.entryPoints?.length ?? 0), 0);

  assert.equal(countFor("brown-bridge"), 1);
  assert.ok(entryCountFor("brown-bridge") >= 7);
  assert.equal(countFor("rifle-river"), 1);
  assert.ok(entryCountFor("rifle-river") >= 3);
  assert.equal(countFor("lumbermans-monument"), 1);
  assert.ok(entryCountFor("lumbermans-monument") >= 3);
});

test("Belle Isle route truth reflects the completed 5.8-mile loop", () => {
  const belle = trailProfiles.find((profile) => profile.id === "belle-isle-wilson-trail");
  assert.equal(belle?.distanceMiles, 5.8);
  assert.equal(belle?.routeKind, "loop");
  assert.match(belle?.sourceNote ?? "", /completion/i);
  assert.match(belle?.sourceNote ?? "", /loops around Belle Isle/i);
});

test("Brown Bridge preserves the official mileage conflict instead of hiding it", () => {
  const brown = trailProfiles.find((profile) => profile.id === "brown-bridge-network");
  assert.equal(brown?.distanceMiles, 9.3);
  assert.match(brown?.sourceNote ?? "", /6 miles/);
  assert.match(brown?.sourceNote ?? "", /management-plan system mileage/);
  assert.ok((brown?.access?.entryPoints?.length ?? 0) >= 7);
  assert.ok((brown?.access?.notes ?? []).some((note) => /trail marker 5 closed/i.test(note)));
});
