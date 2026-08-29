import assert from "node:assert/strict";
import test from "node:test";
import {
  selectTrailProfileForDiscovery,
  trailProfiles,
} from "../src/data/trail-profiles";
import { trailTruthCoverageSummary } from "../src/data/trail-truth-coverage";

const currentPorkiesMap =
  "porcupine_mountains_map.pdf?rev=ea21f7c022dc46edbd24f96d40021739";

function profile(id: string) {
  const value = trailProfiles.find((candidate) => candidate.id === id);
  assert.ok(value, `missing Trail Truth profile: ${id}`);
  return value;
}

test("Trail Truth reaches the 150 verified-route milestone", () => {
  assert.ok(trailProfiles.length >= 150);
  assert.ok(trailTruthCoverageSummary.profileCount >= 150);
  assert.equal(new Set(trailProfiles.map((item) => item.id)).size, trailProfiles.length);
});

test("Porkies becomes a deep current-map route catalog", () => {
  const porkies = trailProfiles.filter(
    (item) => item.destinationId === "porcupine-mountains",
  );
  assert.ok(porkies.length >= 20);

  for (const id of [
    "porkies-beaver-creek",
    "porkies-correction-line",
    "porkies-cross-trail",
    "porkies-east-river",
    "porkies-west-river",
    "porkies-government-peak",
    "porkies-lily-pond",
    "porkies-little-carp-river",
    "porkies-lost-lake",
    "porkies-north-mirror-lake",
    "porkies-overlook",
    "porkies-pinkerton",
    "porkies-south-mirror-lake",
    "porkies-union-mine",
    "porkies-union-spring",
    "porkies-visitor-center-nature",
  ]) {
    assert.match(profile(id).sourceUrl, new RegExp(currentPorkiesMap.replace(/[?]/g, "\\?")));
  }
});

test("current Porkies map wins when older DNR descriptions disagree", () => {
  const escarpment = profile("escarpment-trail");
  const lakeSuperior = profile("lake-superior-trail");
  const bigCarp = profile("big-carp-river");

  assert.equal(escarpment.distanceMiles, 3.7);
  assert.equal(lakeSuperior.distanceMiles, 15.6);
  assert.equal(bigCarp.distanceMiles, 8);

  assert.match(escarpment.sourceNote, /older DNR trail-description sheet lists 4\.3 miles/i);
  assert.match(lakeSuperior.sourceNote, /older DNR trail-description sheet lists 17\.1 miles/i);
  assert.match(bigCarp.sourceNote, /older DNR trail-description sheet lists 9\.6 miles/i);

  assert.ok(!bigCarp.tags.includes("ten-mile"));
  assert.ok([escarpment, lakeSuperior, bigCarp].every((item) =>
    item.sourceUrl.includes("porcupine_mountains_map.pdf"),
  ));
});

test("ten-mile Porkies intent now resolves the current 10.7-mile Little Carp River Trail", () => {
  const selected = selectTrailProfileForDiscovery({
    destinationId: "porcupine-mountains",
    query: "about a 10 mile rugged waterfall hike",
    traits: ["long"],
  });

  assert.equal(selected?.id, "porkies-little-carp-river");
  assert.equal(selected?.distanceMiles, 10.7);
});

test("Isle Royale gains Windigo, Greenstone and boat-access route depth", () => {
  const isleRoyale = trailProfiles.filter(
    (item) => item.destinationId === "isle-royale",
  );
  assert.ok(isleRoyale.length >= 11);

  const windigo = profile("isle-royale-windigo-nature");
  const huginnin = profile("isle-royale-huginnin-cove-loop");
  const ojibway = profile("isle-royale-mount-ojibway-trail");
  const lookout = profile("isle-royale-lookout-louise");
  const passage = profile("isle-royale-passage-island-lighthouse");

  assert.equal(windigo.distanceMiles, 1.2);
  assert.equal(huginnin.distanceMiles, 9.4);
  assert.equal(ojibway.distanceMiles, 1.7);
  assert.match(lookout.access?.notes?.[0] ?? "", /boat|paddle|water taxi/i);
  assert.match(passage.access?.notes?.[0] ?? "", /boat tour/i);
});

test("150-route depth raises useful trailhead and deep-destination coverage", () => {
  assert.ok(trailTruthCoverageSummary.namedTrailheadCount >= 65);
  assert.ok(trailTruthCoverageSummary.deepDestinationCount >= 12);
  assert.ok(trailTruthCoverageSummary.multiRouteDestinationCount >= 23);
  assert.ok(trailTruthCoverageSummary.operationallyThinDestinationCount <= 1);
});
