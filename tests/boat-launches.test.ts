import assert from "node:assert/strict";
import test from "node:test";
import {
  BOAT_LAUNCH_API,
  normalizeBoatLaunchPayload,
} from "../src/lib/boat-launches.ts";

test("boat launch adapter preserves unknown numeric fields instead of turning them into zero", () => {
  const payload = normalizeBoatLaunchPayload({
    fetched_at: "2026-08-27T12:00:00.000Z",
    great_lakes_count: 1,
    inland_or_other_count: 0,
    launches: [
      {
        id: "facility:123",
        name: "Example Launch",
        latitude: 43.6,
        longitude: -83.9,
        waterbody: "Saginaw Bay",
        county: "Bay",
        waterScope: "great-lakes",
        launchStatus: "Open",
        lanes: " ",
        trailerParking: "   ",
        piers: "",
        carryDown: false,
        verificationStatus: "source-qualified",
      },
    ],
  });

  assert.equal(payload.status, "live");
  assert.equal(payload.count, 1);
  assert.equal(payload.geojson.features[0].properties.lanes, null);
  assert.equal(payload.geojson.features[0].properties.trailerParking, null);
  assert.equal(payload.geojson.features[0].properties.piers, null);
  assert.deepEqual(payload.geojson.features[0].geometry.coordinates, [-83.9, 43.6]);
});

test("boat launch adapter drops unusable records and keeps authoritative source identity", () => {
  const payload = normalizeBoatLaunchPayload({
    source: "Existing Michigan Boat Launches inventory",
    source_url: BOAT_LAUNCH_API,
    launches: [
      { id: "facility:good", name: "Good Launch", latitude: 44, longitude: -84 },
      { id: "facility:no-coordinates", name: "No Coordinates", latitude: null, longitude: null },
      { id: "facility:blank-coordinates", name: "Blank Coordinates", latitude: " ", longitude: " " },
      { id: "", name: "No Stable ID", latitude: 44, longitude: -84 },
    ],
  });

  assert.equal(payload.count, 1);
  assert.equal(payload.geojson.features[0].properties.id, "facility:good");
  assert.equal(payload.source.url, BOAT_LAUNCH_API);
});
