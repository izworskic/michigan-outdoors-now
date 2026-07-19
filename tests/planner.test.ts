import assert from "node:assert/strict";
import test from "node:test";
import { destinations, destinationCount } from "../src/data/destinations.ts";
import { origins, originsBySlug } from "../src/data/origins.ts";
import {
  estimateDriveHours,
  getDetroitDate,
  haversineMiles,
  rankDestinations,
  targetDateFor,
} from "../src/lib/planner.ts";
import type { WeatherSnapshot } from "../src/lib/types.ts";

test("the curated catalog and static origin set stay intentional", () => {
  assert.equal(destinationCount, 28);
  assert.equal(destinations.length, 28);
  assert.equal(new Set(destinations.map((destination) => destination.id)).size, 28);
  assert.equal(origins.length, 11);
  assert.equal(originsBySlug.get("bay-city")?.zip, "48708");
});

test("destination clicks use secure, current source paths", () => {
  assert.ok(destinations.every((destination) => destination.officialUrl.startsWith("https://")));
  assert.ok(
    destinations.every(
      (destination) => !destination.officialUrl.includes("/dnr/places/state-parks/"),
    ),
  );
});

test("distance helpers are stable and plausible", () => {
  assert.equal(haversineMiles(43, -84, 43, -84), 0);
  const detroitToAnnArbor = haversineMiles(42.3314, -83.0458, 42.2808, -83.743);
  assert.ok(detroitToAnnArbor > 30 && detroitToAnnArbor < 40);
  assert.equal(estimateDriveHours(0), 0.2);
});

test("Detroit calendar choices use the Michigan date", () => {
  const saturdayAfternoon = new Date("2026-07-18T16:00:00.000Z");
  assert.equal(getDetroitDate(saturdayAfternoon), "2026-07-18");
  assert.equal(targetDateFor("today", saturdayAfternoon), "2026-07-18");
  assert.equal(targetDateFor("tomorrow", saturdayAfternoon), "2026-07-19");
  assert.equal(targetDateFor("weekend", saturdayAfternoon), "2026-07-18");

  const sundayAfternoon = new Date("2026-07-19T16:00:00.000Z");
  assert.equal(targetDateFor("weekend", sundayAfternoon), "2026-07-25");
});

test("hard filters honor drive time and activity", () => {
  const plans = rankDestinations({
    latitude: 42.3314,
    longitude: -83.0458,
    originName: "Detroit, Michigan",
    maxDriveHours: 1,
    activities: ["hiking"],
    kids: false,
    dog: false,
    accessible: false,
  });

  assert.ok(plans.length > 0);
  assert.ok(plans.every((plan) => plan.driveHours <= 1.1));
  assert.ok(plans.every((plan) => plan.destination.activities.includes("hiking")));
});

test("dog and lower-barrier choices remain requirements", () => {
  const plans = rankDestinations({
    latitude: 43.5945,
    longitude: -83.8889,
    originName: "Bay City, Michigan",
    maxDriveHours: 5,
    activities: ["scenic"],
    kids: true,
    dog: true,
    accessible: true,
  });
  const destinationById = new Map(destinations.map((destination) => [destination.id, destination]));

  assert.equal(plans.length, 3);
  assert.ok(
    plans.every((plan) => {
      const destination = destinationById.get(plan.destination.id);
      return destination?.kidsFriendly && destination.dogsAllowed && destination.accessibleFriendly;
    }),
  );
});

test("forecast data is reflected without turning fit into a safety promise", () => {
  const goodWeather: WeatherSnapshot = {
    date: "2026-07-18",
    high: 72,
    low: 58,
    precipitationProbability: 10,
    windGust: 12,
    weatherCode: 1,
    aqi: 30,
  };
  const weatherByDestination = new Map(destinations.map((destination) => [destination.id, goodWeather]));
  const input = {
    latitude: 44.7631,
    longitude: -85.6206,
    originName: "Traverse City, Michigan",
    maxDriveHours: 3,
    activities: ["beaches", "scenic"] as const,
    kids: false,
    dog: false,
    accessible: false,
    weatherByDestination,
  };
  const first = rankDestinations({ ...input, activities: [...input.activities] });
  const second = rankDestinations({ ...input, activities: [...input.activities] });

  assert.deepEqual(first, second);
  assert.equal(first.length, 3);
  assert.ok(first.every((plan) => plan.conditionsStatus === "live"));
  assert.ok(first.every((plan) => plan.score >= 1 && plan.score <= 99));
  assert.ok(first.every((plan) => plan.reasons.some((reason) => reason.startsWith("Forecast:"))));
});
