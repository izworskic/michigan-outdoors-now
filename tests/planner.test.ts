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
import { parsePlannerFragment, serializePlannerFragment } from "../src/lib/planner-share.ts";
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
    precipitationInches: 0,
    windGust: 12,
    sunshineHours: 9.5,
    cloudCover: 18,
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

test("dark-sky plans explain and penalize heavy cloud cover", () => {
  const clear: WeatherSnapshot = {
    date: "2026-07-25",
    high: 70,
    low: 55,
    precipitationProbability: 10,
    precipitationInches: 0,
    windGust: 10,
    sunshineHours: 10,
    cloudCover: 12,
    weatherCode: 1,
    aqi: 28,
  };
  const cloudy = { ...clear, cloudCover: 88 };
  const darkSkyDestinations = destinations.filter((destination) => destination.activities.includes("dark-sky"));
  const weatherByDestination = new Map(
    darkSkyDestinations.map((destination, index) => [destination.id, index === 0 ? clear : cloudy]),
  );
  const plans = rankDestinations({
    latitude: darkSkyDestinations[0].latitude,
    longitude: darkSkyDestinations[0].longitude,
    originName: "Northern Michigan",
    maxDriveHours: 5,
    activities: ["dark-sky"],
    kids: false,
    dog: false,
    accessible: false,
    weatherByDestination,
  });

  assert.ok(plans.some((plan) => plan.reasons.some((reason) => reason.includes("cloud cover"))));
  assert.ok(
    plans
      .filter((plan) => plan.weather?.cloudCover === 88)
      .every((plan) => plan.cautions.some((caution) => caution.includes("stargazing"))),
  );
});

test("water plans flag wind-sensitive conditions", () => {
  const windy: WeatherSnapshot = {
    date: "2026-07-25",
    high: 76,
    low: 62,
    precipitationProbability: 15,
    precipitationInches: 0,
    windGust: 31,
    sunshineHours: 8,
    cloudCover: 25,
    weatherCode: 1,
    aqi: 35,
  };
  const waterDestinations = destinations.filter((destination) => destination.activities.includes("paddling"));
  const plans = rankDestinations({
    latitude: waterDestinations[0].latitude,
    longitude: waterDestinations[0].longitude,
    originName: "Michigan",
    maxDriveHours: 5,
    activities: ["paddling"],
    kids: false,
    dog: false,
    accessible: false,
    weatherByDestination: new Map(waterDestinations.map((destination) => [destination.id, windy])),
  });

  assert.ok(plans.every((plan) => plan.cautions.some((caution) => caution.includes("marine forecast"))));
});

test("share fragments round-trip valid planner settings and reject invalid data", () => {
  const request = {
    origin: "Bay City",
    date: "weekend" as const,
    maxDriveHours: 2,
    activities: ["freighters", "scenic"] as const,
    kids: true,
    dog: false,
    accessible: true,
  };
  const fragment = serializePlannerFragment({ ...request, activities: [...request.activities] });

  assert.deepEqual(parsePlannerFragment(fragment), { ...request, activities: [...request.activities] });
  assert.equal(parsePlannerFragment("#plan=origin%3DBay%2BCity%26when%3Dnever"), null);
  assert.equal(parsePlannerFragment("#other=value"), null);
});
