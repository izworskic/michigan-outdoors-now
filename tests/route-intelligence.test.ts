import assert from "node:assert/strict";
import test from "node:test";
import type { DiscoveryPlace } from "../src/lib/discovery";
import { applyRoutedTravel, fetchRoutedTravel } from "../src/lib/route-intelligence";

const place: DiscoveryPlace = {
  id: "test-place",
  name: "Test Trail",
  area: "Michigan",
  latitude: 44.5,
  longitude: -85.5,
  category: "trailhead",
  categoryLabel: "Trailhead",
  distanceMiles: 55,
  driveHours: 1.3,
  score: 80,
  why: "Test",
  source: "Michigan Outdoors Now",
  sourceUrl: "https://example.com",
  directionsUrl: "https://example.com/directions",
};

test("batched routing converts OSRM duration and distance into place travel intelligence", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        code: "Ok",
        durations: [[3900]],
        distances: [[112654]],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  try {
    const routed = await fetchRoutedTravel({
      originLatitude: 43.5945,
      originLongitude: -83.8889,
      places: [place],
    });
    const result = routed.get(place.id);

    assert.ok(result);
    assert.equal(result.driveMinutes, 65);
    assert.equal(result.driveHours, 1.08);
    assert.equal(result.distanceMiles, 70);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("routed travel replaces estimates while fallback places stay explicitly estimated", () => {
  const routed = new Map([
    [
      place.id,
      {
        placeId: place.id,
        distanceMiles: 70,
        driveHours: 1.08,
        driveMinutes: 65,
      },
    ],
  ]);

  const enriched = applyRoutedTravel([place], routed);
  assert.equal(enriched[0].travelSource, "routed");
  assert.equal(enriched[0].driveMinutes, 65);
  assert.equal(enriched[0].distanceMiles, 70);

  const fallback = applyRoutedTravel([place], new Map());
  assert.equal(fallback[0].travelSource, "estimated");
  assert.equal(fallback[0].driveHours, place.driveHours);
});
