import assert from "node:assert/strict";
import test from "node:test";
import {
  DNR_TRAIL_SERVICE,
  buildDnrTrailQuery,
  isUniverseLayerId,
  summarizeTrailSystems,
  universeLayerIds,
  type UniverseGeoJson,
} from "../src/lib/outdoor-universe.ts";

test("the outdoor universe uses the official simplified Michigan DNR trail layer", () => {
  assert.match(DNR_TRAIL_SERVICE, /DNRTrailsOPENDATA\/FeatureServer\/21\/query$/);
  assert.equal(universeLayerIds.length, 8);
  for (const layer of universeLayerIds) {
    const url = new URL(buildDnrTrailQuery(layer));
    assert.equal(url.searchParams.get("f"), "geojson");
    assert.equal(url.searchParams.get("outSR"), "4326");
    assert.equal(url.searchParams.get("resultRecordCount"), "2000");
    assert.ok(url.searchParams.get("where"));
  }
  assert.equal(isUniverseLayerId("hiking"), true);
  assert.equal(isUniverseLayerId("bogus"), false);
});

test("trail system summaries group segments instead of pretending each line is a new destination", () => {
  const collection: UniverseGeoJson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: null,
        properties: { OBJECTID: 1, TrailType: "Hiking", Name: "North Country Trail", SegmentLengthMiles: 2.2 },
      },
      {
        type: "Feature",
        geometry: null,
        properties: { OBJECTID: 2, TrailType: "Hiking", Name: "North Country Trail", SegmentLengthMiles: 3.1 },
      },
      {
        type: "Feature",
        geometry: null,
        properties: { OBJECTID: 3, TrailType: "Hiking", Name: "Pine Ridge Pathway", SegmentLengthMiles: 4 },
      },
    ],
  };

  const systems = summarizeTrailSystems(collection);
  assert.equal(systems.length, 2);
  assert.equal(systems[0].name, "North Country Trail");
  assert.equal(systems[0].segments, 2);
  assert.equal(systems[0].miles, 5.3);
});
