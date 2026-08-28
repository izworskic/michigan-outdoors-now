import assert from "node:assert/strict";
import test from "node:test";
import {
  discoveryRadiusMeters,
  interpretOutdoorQuery,
  curatedDiscoveryPlaces,
  isDiscoveryCandidateInRange,
  overpassSelectorsFor,
} from "../src/lib/discovery";
import type { Destination } from "../src/lib/types";

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


test("long hike language is preserved as effort intent", () => {
  const intent = interpretOutdoorQuery("I want a long full-day hike with some backcountry");

  assert.ok(intent.activities.includes("hiking"));
  assert.ok(intent.traits.includes("long"));
  assert.ok(intent.categories.includes("trailhead"));
});

test("long-hike intent favors stronger backcountry signals over a generic trail stop", () => {
  const base = {
    area: "Test",
    latitude: 44.6,
    longitude: -85.4,
    activities: ["hiking"] as const,
    kidsFriendly: true,
    dogsAllowed: true,
    accessibleFriendly: false,
    officialUrl: "https://example.com",
  };

  const destinations: Destination[] = [
    {
      ...base,
      id: "big-day",
      name: "Big Day Wilderness",
      summary: "Long backcountry routes through rugged remote forest.",
      setting: "Rugged wilderness",
      accessNote: "Remote, steep, natural-surface trails.",
      activities: ["hiking"],
    },
    {
      ...base,
      id: "generic-stop",
      name: "Generic Trail Park",
      summary: "A flexible local park with a trailhead.",
      setting: "Community forest",
      accessNote: "Choose a route after arrival.",
      activities: ["hiking"],
    },
  ];

  const intent = interpretOutdoorQuery("long hike");
  const places = curatedDiscoveryPlaces({
    destinations,
    intent,
    originLatitude: 44.5,
    originLongitude: -85.5,
    maxDriveHours: 4,
  });

  const rugged = places.find((place) => place.curatedPlaceId === "big-day");
  const generic = places.find((place) => place.curatedPlaceId === "generic-stop");
  assert.ok(rugged);
  assert.ok(generic);
  assert.ok(rugged.score > generic.score);
  assert.match(rugged.why, /full-day|backcountry/i);
});
