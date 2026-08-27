import assert from "node:assert/strict";
import test from "node:test";
import {
  DNR_TRAIL_CLOSURES_SERVICE,
  DNR_TRAIL_REROUTES_SERVICE,
  DNR_TRAIL_SERVICE,
  buildDnrAccessQuery,
  buildDnrTrailQuery,
  isUniverseLayerId,
  summarizeTrailSystems,
  universeLayerIds,
  type UniverseGeoJson,
} from "../src/lib/outdoor-universe.ts";

test("the outdoor universe uses official DNR trail, closure, and reroute layers", () => {
  assert.match(DNR_TRAIL_SERVICE, /FeatureServer\/21\/query$/);
  assert.match(DNR_TRAIL_CLOSURES_SERVICE, /FeatureServer\/0\/query$/);
  assert.match(DNR_TRAIL_REROUTES_SERVICE, /FeatureServer\/1\/query$/);
  assert.equal(universeLayerIds.length, 8);

  for (const layer of universeLayerIds) {
    const first = new URL(buildDnrTrailQuery(layer));
    const second = new URL(buildDnrTrailQuery(layer, 2000));
    assert.equal(first.searchParams.get("f"), "geojson");
    assert.equal(first.searchParams.get("outSR"), "4326");
    assert.equal(first.searchParams.get("resultRecordCount"), "2000");
    assert.equal(first.searchParams.get("resultOffset"), "0");
    assert.equal(second.searchParams.get("resultOffset"), "2000");
    assert.equal(first.searchParams.get("orderByFields"), "OBJECTID ASC");
    assert.ok(first.searchParams.get("where"));

    const closure = new URL(buildDnrAccessQuery("closures", layer));
    const reroute = new URL(buildDnrAccessQuery("reroutes", layer));
    assert.match(closure.pathname, /\/0\/query$/);
    assert.match(reroute.pathname, /\/1\/query$/);
    assert.ok(closure.searchParams.get("where"));
    assert.ok(reroute.searchParams.get("where"));
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
