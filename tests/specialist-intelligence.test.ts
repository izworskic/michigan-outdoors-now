import assert from "node:assert/strict";
import test from "node:test";
import { auroraThresholdForLatitude, parseKpForecast } from "../src/lib/specialist-intelligence.ts";

test("aurora planning thresholds get more conservative farther south", () => {
  assert.equal(auroraThresholdForLatitude(47.4), 4);
  assert.equal(auroraThresholdForLatitude(45.4), 5);
  assert.equal(auroraThresholdForLatitude(44.0), 6);
  assert.equal(auroraThresholdForLatitude(42.4), 7);
});

test("NOAA Kp forecast rows parse without depending on column order", () => {
  const points = parseKpForecast([
    ["observed", "Kp", "time_tag", "noaa_scale"],
    ["observed", "3.33", "2026-08-27 21:00:00", null],
    ["predicted", "5.00", "2026-08-28 00:00:00", "G1"],
  ]);

  assert.equal(points.length, 2);
  assert.equal(points[0].kp, 3.33);
  assert.equal(points[1].kp, 5);
  assert.equal(points[1].observed, "predicted");
  assert.equal(points[1].time.toISOString(), "2026-08-28T00:00:00.000Z");
});
