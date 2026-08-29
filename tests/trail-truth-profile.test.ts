import assert from "node:assert/strict";
import test from "node:test";
import { selectTrailProfileForDiscovery } from "../src/data/trail-profiles";
import { estimateHikeTimeRange, formatHikeTimeRange } from "../src/lib/trail-planning";

test("long-hike discovery resolves to a named official route instead of only a destination", () => {
  const profile = selectTrailProfileForDiscovery({
    destinationId: "porcupine-mountains",
    query: "I want a long rugged hike",
    traits: ["long"],
  });

  assert.equal(profile?.id, "lake-superior-trail");
  assert.equal(profile?.distanceMiles, 17.1);
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
