import assert from "node:assert/strict";
import test from "node:test";
import {
  discoveryRadiusMeters,
  interpretOutdoorQuery,
  isDiscoveryCandidateInRange,
  overpassSelectorsFor,
} from "../src/lib/discovery";

test("interprets a loose waterfall outing without requiring rigid planner controls", () => {
  const intent = interpretOutdoorQuery("quiet waterfall with a short hike, not crowded");

  assert.equal(intent.categories[0], "waterfall");
  assert.ok(intent.categories.includes("trailhead"));
  assert.ok(intent.activities.includes("hiking"));
  assert.ok(intent.activities.includes("scenic"));
  assert.ok(intent.traits.includes("quiet"));
  assert.ok(intent.traits.includes("short"));
  assert.ok(intent.traits.includes("uncrowded"));
});

test("understands fishing and camping language", () => {
  const intent = interpretOutdoorQuery("brook trout water with a campground nearby");

  assert.ok(intent.activities.includes("fishing"));
  assert.ok(intent.categories.includes("fishing"));
  assert.ok(intent.categories.includes("campground"));
  assert.ok(intent.traits.includes("water"));
});

test("only emits approved text-to-geo selectors", () => {
  const malicious = interpretOutdoorQuery('waterfall"];out;node["amenity"="bank');
  const selectors = overpassSelectorsFor(malicious);

  assert.ok(selectors.length > 0);
  assert.ok(selectors.every((selector) => selector.startsWith("nwr[")));
  assert.ok(selectors.every((selector) => !selector.includes("amenity")));
  assert.ok(selectors.every((selector) => !selector.includes(";")));
});

test("travel envelope grows through eight hours but remains bounded", () => {
  assert.ok(discoveryRadiusMeters(8) > discoveryRadiusMeters(4));
  assert.ok(discoveryRadiusMeters(8) <= 650_000);
});

test("candidate range uses the same inclusive one-to-eight-hour planner logic", () => {
  assert.equal(
    isDiscoveryCandidateInRange({
      latitude: 43.6674,
      longitude: -83.9057,
      originLatitude: 43.59,
      originLongitude: -83.89,
      maxDriveHours: 1,
    }),
    true,
  );

  assert.equal(
    isDiscoveryCandidateInRange({
      latitude: 46.8136,
      longitude: -89.6338,
      originLatitude: 43.59,
      originLongitude: -83.89,
      maxDriveHours: 1,
    }),
    false,
  );
});
