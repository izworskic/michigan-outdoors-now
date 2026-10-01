import assert from "node:assert/strict";
import test from "node:test";
import { selectTrailProfileForDiscovery, trailProfiles } from "../src/data/trail-profiles";
import { trailTruthCoverageGaps, trailTruthCoverageSummary } from "../src/data/trail-truth-coverage";
import { estimateHikeTimeRange, formatHikeTimeRange } from "../src/lib/trail-planning";

test("long-hike discovery resolves to a named official route instead of only a destination", () => {
  const profile = selectTrailProfileForDiscovery({
    destinationId: "porcupine-mountains",
    query: "I want a long rugged hike",
    traits: ["long"],
  });

  assert.equal(profile?.id, "lake-superior-trail");
  assert.equal(profile?.distanceMiles, 15.6);
  assert.equal(profile?.sourceLabel, "Michigan DNR");
});

test("ten-mile intent prefers the official route matching that distance family", () => {
  const profile = selectTrailProfileForDiscovery({
    destinationId: "pictured-rocks",
    query: "about a 10 mile hike with waterfalls",
    traits: ["long", "water"],
  });

  assert.equal(profile?.id, "chapel-loop");
  assert.equal(profile?.distanceMiles, 10.5);
});

test("access-first intent can prefer a lower-barrier official trail profile", () => {
  const profile = selectTrailProfileForDiscovery({
    destinationId: "sleeping-bear",
    query: "easy accessible trail",
    traits: ["accessible"],
  });

  assert.equal(profile?.id, "sleeping-bear-heritage");
  assert.ok(profile?.access?.parking);
});

test("hike time is a broad planning range rather than false exact timing", () => {
  const range = estimateHikeTimeRange(10.5, "challenging");
  assert.ok(range);
  assert.ok(range!.highMinutes > range!.lowMinutes);
  assert.match(formatHikeTimeRange(range) ?? "", /hr/);
});


test("generic hiking intent keeps the curated representative route instead of defaulting to the shortest", () => {
  const profile = selectTrailProfileForDiscovery({
    destinationId: "porcupine-mountains",
    query: "go hiking",
    traits: [],
  });

  assert.equal(profile?.id, "escarpment-trail");
});


test("statewide Trail Truth catalog maintains massive verified coverage", () => {
  assert.ok(trailProfiles.length >= 70);
  assert.ok(trailTruthCoverageSummary.coveredDestinationCount >= 26);
  assert.ok(trailTruthCoverageSummary.coveragePercent >= 80);
  assert.equal(trailTruthCoverageSummary.uncoveredUndocumentedDestinationIds.length, 0);
  assert.equal(
    trailTruthCoverageSummary.coveredDestinationCount + trailTruthCoverageSummary.documentedGapCount,
    trailTruthCoverageSummary.hikingDestinationCount,
  );
});

test("statewide Trail Truth profiles keep unique IDs and usable provenance", () => {
  const ids = trailProfiles.map((profile) => profile.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const profile of trailProfiles) {
    assert.ok(profile.distanceMiles > 0, profile.id);
    assert.match(profile.sourceUrl, /^https:\/\//, profile.id);
    assert.ok(profile.sourceLabel.trim().length > 0, profile.id);
    assert.ok(profile.sourceNote.trim().length > 0, profile.id);
  }
});

test("remaining hiking gaps are explicit instead of being filled with invented mileage", () => {
  assert.equal(trailTruthCoverageGaps.length, 5);
  assert.ok(
    trailTruthCoverageGaps.some(
      (gap) =>
        gap.destinationId === "silver-lake-state-park" &&
        gap.status === "no-designated-trails",
    ),
  );
});

test("ten-mile wilderness intent resolves the official North Country Trail segment", () => {
  const profile = selectTrailProfileForDiscovery({
    destinationId: "wilderness-state-park",
    query: "about a 10 mile long hike",
    traits: ["long"],
  });
  assert.equal(profile?.id, "wilderness-nct-segment");
});

test("ten-mile Isle Royale intent resolves Mount Franklin", () => {
  const profile = selectTrailProfileForDiscovery({
    destinationId: "isle-royale",
    query: "rugged 10 mile full day hike",
    traits: ["long", "rugged"],
  });
  assert.equal(profile?.id, "isle-royale-mount-franklin");
});

test("easy Waterloo intent resolves the official gentle Green Lake loop", () => {
  const profile = selectTrailProfileForDiscovery({
    destinationId: "waterloo",
    query: "easy hike",
    traits: [],
  });
  assert.equal(profile?.id, "waterloo-green-lake-loop");
});

test("Port Crescent lower-barrier intent resolves the official interpretive trail", () => {
  const profile = selectTrailProfileForDiscovery({
    destinationId: "port-crescent-state-park",
    query: "easy accessible trail",
    traits: ["accessible"],
  });
  assert.equal(profile?.id, "port-crescent-dunes-interpretive");
});
