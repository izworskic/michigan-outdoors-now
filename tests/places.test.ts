import assert from "node:assert/strict";
import test from "node:test";
import { destinations } from "../src/data/destinations.ts";
import {
  conditionConsiderations,
  destinationDirectAnswer,
  destinationRegion,
  filterDestinations,
  nearbyDestinations,
  regionIds,
} from "../src/lib/destination-content.ts";
import { isPlausibleMichiganCoordinate } from "../src/lib/planner.ts";

test("all curated places have unique, useful destination answers", () => {
  const answers = destinations.map(destinationDirectAnswer);
  assert.equal(answers.length, 28);
  assert.equal(new Set(answers).size, answers.length);
  assert.ok(answers.every((answer) => answer.length >= 300));
});

test("the explorer covers every Michigan region and activity", () => {
  const coveredRegions = new Set(destinations.map(destinationRegion));
  assert.deepEqual([...coveredRegions].sort(), [...regionIds].sort());
  assert.ok(destinations.every((destination) => conditionConsiderations(destination).length >= 2));
});

test("explorer filters combine search, activity, region, and practical needs", () => {
  const dogFriendlyDarkSky = filterDestinations(destinations, {
    query: "",
    activity: "dark-sky",
    region: "all",
    kids: false,
    dog: true,
    accessible: false,
  });
  assert.ok(dogFriendlyDarkSky.length > 0);
  assert.ok(dogFriendlyDarkSky.every((destination) => destination.dogsAllowed && destination.activities.includes("dark-sky")));

  const detroit = filterDestinations(destinations, {
    query: "Detroit",
    activity: "all",
    region: "southeast-michigan",
    kids: true,
    dog: false,
    accessible: true,
  });
  assert.deepEqual(detroit.map((destination) => destination.id), ["belle-isle"]);
});

test("every destination has three distinct nearby alternatives", () => {
  for (const destination of destinations) {
    const nearby = nearbyDestinations(destination);
    assert.equal(nearby.length, 3);
    assert.ok(nearby.every((item) => item.destination.id !== destination.id));
    assert.equal(new Set(nearby.map((item) => item.destination.id)).size, 3);
    assert.ok(nearby.every((item) => item.distanceMiles > 0));
  }
});

test("optional device coordinates are bounded before planning", () => {
  assert.equal(isPlausibleMichiganCoordinate(43.5945, -83.8889), true);
  assert.equal(isPlausibleMichiganCoordinate(46.5436, -87.3954), true);
  assert.equal(isPlausibleMichiganCoordinate(40.7128, -74.006), false);
  assert.equal(isPlausibleMichiganCoordinate(Number.NaN, -84), false);
});
