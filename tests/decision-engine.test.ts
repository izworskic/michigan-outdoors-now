import assert from "node:assert/strict";
import test from "node:test";
import { evaluateActivity, evaluateActivities } from "../src/lib/decision-engine.ts";
import type { WeatherSnapshot } from "../src/lib/types.ts";

function weather(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    date: "2026-08-27", high: 76, low: 58, precipitationProbability: 10, precipitationInches: 0,
    windGust: 12, sunshineHours: 9, cloudCover: 20, weatherCode: 1, aqi: 35,
    hourly: [
      { time: "2026-08-27T07:00", temperature: 62, precipitationProbability: 8, windGust: 7, cloudCover: 18 },
      { time: "2026-08-27T08:00", temperature: 65, precipitationProbability: 8, windGust: 8, cloudCover: 18 },
      { time: "2026-08-27T09:00", temperature: 68, precipitationProbability: 10, windGust: 9, cloudCover: 20 },
      { time: "2026-08-27T10:00", temperature: 71, precipitationProbability: 12, windGust: 11, cloudCover: 22 },
      { time: "2026-08-27T11:00", temperature: 73, precipitationProbability: 15, windGust: 18, cloudCover: 24 },
      { time: "2026-08-27T12:00", temperature: 75, precipitationProbability: 18, windGust: 27, cloudCover: 28 }
    ],
    ...overrides
  };
}

test("beach hazard overrides attractive weather", () => {
  const result = evaluateActivity("beaches", { weather: weather(), swimHazard: true, sourceCount: 3 });
  assert.equal(result.status, "danger"); assert.equal(result.score, null); assert.equal(result.hardStop, true);
});
test("paddling uses wind and returns a best window without treating it as safety clearance", () => {
  const result = evaluateActivity("paddling", { weather: weather({ windGust: 28 }), sourceCount: 1 });
  assert.ok(result.score !== null && result.score < 75);
  assert.equal(result.bestWindow, "7 AM–9 AM");
  assert.ok(result.cautions.some((item) => item.includes("Wave and marine-hazard data")));
});
test("missing live data is insufficient and never becomes a midpoint score", () => {
  const result = evaluateActivity("hiking", { weather: null });
  assert.equal(result.status, "insufficient"); assert.equal(result.score, null);
});
test("high AQI suppresses exposed outdoor recommendations", () => {
  const result = evaluateActivity("hiking", { weather: weather({ aqi: 174 }), sourceCount: 2 });
  assert.ok(result.score !== null && result.score < 60);
  assert.ok(result.cautions.some((item) => item.includes("Air quality")));
});
test("closure is a hard stop", () => {
  const result = evaluateActivity("scenic", { weather: weather(), closure: true });
  assert.equal(result.status, "closed"); assert.equal(result.score, null);
});
test("dark-sky cloud cover is activity-specific", () => {
  const clear = evaluateActivity("dark-sky", { weather: weather({ cloudCover: 10 }) });
  const cloudy = evaluateActivity("dark-sky", { weather: weather({ cloudCover: 90 }) });
  assert.ok((clear.score ?? 0) > (cloudy.score ?? 0));
});
test("combined activity evaluation preserves an explainable decision", () => {
  const result = evaluateActivities(["hiking", "scenic"], { weather: weather(), sourceCount: 2 });
  assert.ok(result.score !== null); assert.match(result.summary, /Decision status:/); assert.equal(result.activities.length, 2);
});
