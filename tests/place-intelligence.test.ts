import assert from "node:assert/strict";
import test from "node:test";
import { parseDistanceMiles, parseElevationFeet } from "../src/lib/place-intelligence";

test("OSM route distance defaults to kilometers when no unit is provided", () => {
  assert.equal(parseDistanceMiles("10", "km"), 6.2);
  assert.equal(parseDistanceMiles("10 km", "mi"), 6.2);
  assert.equal(parseDistanceMiles("10 mi", "km"), 10);
});

test("OSM length defaults to meters when no unit is provided", () => {
  assert.equal(parseDistanceMiles("1609.344", "m"), 1);
  assert.equal(parseDistanceMiles("1609.344 m", "km"), 1);
});

test("OSM ascent defaults to meters unless feet are explicit", () => {
  assert.equal(parseElevationFeet("100"), 328);
  assert.equal(parseElevationFeet("100 m"), 328);
  assert.equal(parseElevationFeet("500 ft"), 500);
});
