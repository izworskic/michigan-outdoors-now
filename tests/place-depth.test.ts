import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPlaceDepthOverpassQuery,
  classifyPlaceDepthTags,
  summarizePlaceDepthElements,
} from "../src/lib/place-depth";

test("place-depth query stays coordinate-bounded and asks only for useful access feature classes", () => {
  const query = buildPlaceDepthOverpassQuery(44.75, -84.66);
  assert.match(query, /around:7000,44\.75000,-84\.66000/);
  assert.match(query, /highway"="trailhead/);
  assert.match(query, /tourism"="viewpoint/);
  assert.match(query, /leisure"="slipway/);
  assert.match(query, /canoe"="put_in/);
  assert.doesNotMatch(query, /Hartwick|Pictured|name=/i);
});

test("place-depth tag classifier separates trailheads, launches, viewpoints and named access", () => {
  assert.equal(classifyPlaceDepthTags({ highway: "trailhead" }), "trailhead");
  assert.equal(classifyPlaceDepthTags({ leisure: "slipway" }), "launch");
  assert.equal(classifyPlaceDepthTags({ tourism: "viewpoint" }), "viewpoint");
  assert.equal(classifyPlaceDepthTags({ amenity: "parking" }), "access");
  assert.equal(classifyPlaceDepthTags({ tourism: "museum" }), null);
});

test("place-depth summary excludes private access and keeps nearby mapped points", () => {
  const points = summarizePlaceDepthElements({
    latitude: 44.75,
    longitude: -84.66,
    placeName: "Example Park",
    elements: [
      { type: "node", id: 1, lat: 44.751, lon: -84.661, tags: { highway: "trailhead", name: "North Trailhead" } },
      { type: "node", id: 2, lat: 44.752, lon: -84.662, tags: { leisure: "slipway", name: "Lake Launch" } },
      { type: "node", id: 3, lat: 44.753, lon: -84.663, tags: { tourism: "viewpoint", name: "Ridge View" } },
      { type: "node", id: 4, lat: 44.754, lon: -84.664, tags: { amenity: "parking", name: "Private Lot", access: "private" } },
    ],
  });

  assert.equal(points.length, 3);
  assert.deepEqual(points.map((point) => point.kind), ["trailhead", "launch", "viewpoint"]);
  assert.ok(points.every((point) => point.distanceMiles < 1));
});
