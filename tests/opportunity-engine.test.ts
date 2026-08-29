import assert from "node:assert/strict";
import test from "node:test";
import { detectOutdoorOpportunities } from "../src/lib/opportunity-engine";
import type { Destination, WeatherSnapshot } from "../src/lib/types";

function weather(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    date: "2026-08-28",
    high: 72,
    low: 51,
    precipitationProbability: 10,
    precipitationInches: 0,
    windGust: 10,
    sunshineHours: 8,
    cloudCover: 15,
    weatherCode: 1,
    aqi: 35,
    hourly: [
      { time: "2026-08-28T09:00", temperature: 60, precipitationProbability: 5, windGust: 8, cloudCover: 10 },
      { time: "2026-08-28T10:00", temperature: 64, precipitationProbability: 5, windGust: 9, cloudCover: 10 },
      { time: "2026-08-28T11:00", temperature: 68, precipitationProbability: 5, windGust: 10, cloudCover: 12 },
      { time: "2026-08-28T21:00", temperature: 58, precipitationProbability: 5, windGust: 6, cloudCover: 8 },
      { time: "2026-08-28T22:00", temperature: 56, precipitationProbability: 5, windGust: 5, cloudCover: 7 },
      { time: "2026-08-28T23:00", temperature: 54, precipitationProbability: 5, windGust: 5, cloudCover: 6 },
    ],
    ...overrides,
  };
}

const hike: Destination = {
  id: "test-hike",
  name: "Test Ridge",
  area: "Northern Michigan",
  latitude: 45,
  longitude: -84,
  activities: ["hiking", "scenic"],
  summary: "A test trail.",
  setting: "forest",
  kidsFriendly: true,
  dogsAllowed: true,
  accessibleFriendly: false,
  accessNote: "Check access.",
  officialUrl: "https://example.com",
};

const paddle: Destination = {
  ...hike,
  id: "test-paddle",
  name: "Test Water",
  activities: ["paddling"],
  setting: "water",
};

test("detects a brief standout hiking window", () => {
  const today = new Map([[hike.id, weather()]]);
  const tomorrow = new Map([[hike.id, weather({ precipitationProbability: 75, windGust: 30 })]]);
  const opportunities = detectOutdoorOpportunities([hike], today, tomorrow);

  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].kind, "standout-hike");
  assert.match(opportunities[0].comparison, /stronger than tomorrow/i);
});

test("paddling lead requires conservative wind and keeps marine verification caveat", () => {
  const today = new Map([[paddle.id, weather({ windGust: 10 })]]);
  const tomorrow = new Map([[paddle.id, weather({ precipitationProbability: 70, windGust: 28 })]]);
  const opportunities = detectOutdoorOpportunities([paddle], today, tomorrow);

  assert.equal(opportunities.length, 1);
  assert.equal(opportunities[0].kind, "calm-paddling");
  assert.match(opportunities[0].caveat, /does not include local waves/i);
  assert.match(opportunities[0].verifyUrl, /great-lakes-buoys/);
});

test("does not manufacture an opportunity from merely average conditions", () => {
  const ordinary = weather({ precipitationProbability: 35, windGust: 20, aqi: 60 });
  const today = new Map([[hike.id, ordinary]]);
  const tomorrow = new Map([[hike.id, ordinary]]);
  const opportunities = detectOutdoorOpportunities([hike], today, tomorrow);

  assert.equal(opportunities.length, 0);
});
