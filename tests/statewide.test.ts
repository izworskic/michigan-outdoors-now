import assert from "node:assert/strict";
import test from "node:test";
import { destinations } from "../src/data/destinations.ts";
import { rankStatewideDestinations } from "../src/lib/statewide.ts";
import type { WeatherSnapshot } from "../src/lib/types.ts";

const goodWeather: WeatherSnapshot = {
  date: "2026-08-27",
  high: 72,
  low: 55,
  precipitationProbability: 10,
  precipitationInches: 0,
  windGust: 12,
  sunshineHours: 9,
  cloudCover: 18,
  weatherCode: 1,
  aqi: 32,
  hourly: [
    { time: "2026-08-27T08:00", temperature: 61, precipitationProbability: 5, windGust: 7, cloudCover: 12 },
    { time: "2026-08-27T09:00", temperature: 64, precipitationProbability: 5, windGust: 8, cloudCover: 14 },
    { time: "2026-08-27T10:00", temperature: 67, precipitationProbability: 8, windGust: 9, cloudCover: 16 },
  ],
};

test("statewide best starts with an answer and excludes specialist-only activity scoring", () => {
  const weather = new Map(destinations.map((destination) => [destination.id, goodWeather]));
  const picks = rankStatewideDestinations(weather, "best", 4);
  assert.equal(picks.length, 4);
  assert.deepEqual(picks.map((pick) => pick.rank), [1, 2, 3, 4]);
  assert.ok(picks.every((pick) => ["hiking", "scenic", "birding"].includes(pick.activity)));
  assert.ok(picks.every((pick) => !["paddling", "beaches", "fishing", "freighters"].includes(pick.activity)));
  assert.ok(picks.every((pick) => pick.bestWindow));
});

test("dark-sky statewide ranking only considers dark-sky destinations", () => {
  const weather = new Map(destinations.map((destination) => [destination.id, goodWeather]));
  const destinationById = new Map(destinations.map((destination) => [destination.id, destination]));
  const picks = rankStatewideDestinations(weather, "dark-sky", 4);
  assert.ok(picks.length > 0);
  assert.ok(picks.every((pick) => destinationById.get(pick.destination.id)?.activities.includes("dark-sky")));
});

test("statewide ranking does not invent scores when live weather is absent", () => {
  assert.deepEqual(rankStatewideDestinations(new Map(), "best", 4), []);
});
