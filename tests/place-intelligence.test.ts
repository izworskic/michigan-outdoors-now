import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveGoSignal,
  parseDistanceMiles,
  parseElevationFeet,
} from "../src/lib/place-intelligence";

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


test("go signal separates a strong near-term case from weather/access cautions", () => {
  const good = deriveGoSignal({
    weather: {
      temperature: 65,
      high: 70,
      low: 51,
      precipitationProbability: 20,
      windGust: 14,
      aqi: 42,
      weatherCode: 1,
      recentRainInches: 0.05,
      recentSnowInches: 0,
      daylightHoursRemaining: 5.2,
      outingWindow: {
        start: "2:00 PM",
        end: "8:00 PM",
        maxPrecipitationProbability: 20,
        maxWindGust: 15,
        minTemperature: 62,
        maxTemperature: 69,
      },
    },
    access: {
      closureCount: 0,
      rerouteCount: 0,
      notes: [],
      source: "Michigan DNR Trails Open Data",
    },
    trailTruth: null,
  });

  assert.equal(good.status, "good");
  assert.match(good.headline, /strong case/i);

  const poor = deriveGoSignal({
    weather: {
      temperature: 68,
      high: 72,
      low: 56,
      precipitationProbability: 90,
      windGust: 44,
      aqi: 65,
      weatherCode: 95,
      recentRainInches: 0.6,
      recentSnowInches: 0,
      daylightHoursRemaining: 1.4,
      outingWindow: {
        start: "5:00 PM",
        end: "9:00 PM",
        maxPrecipitationProbability: 90,
        maxWindGust: 44,
        minTemperature: 58,
        maxTemperature: 68,
      },
    },
    access: {
      closureCount: 1,
      rerouteCount: 0,
      notes: ["Closure · Test Trail"],
      source: "Michigan DNR Trails Open Data",
    },
    trailTruth: null,
  });

  assert.equal(poor.status, "poor");
  assert.ok(poor.cautions.length >= 2);
});
