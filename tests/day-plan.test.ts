import assert from "node:assert/strict";
import test from "node:test";
import { buildDayPlan } from "../src/lib/day-plan";

const origin = { name: "Bay City", latitude: 43.5945, longitude: -83.8889 };
const places = [
  { id: "a", name: "A", area: "A area", latitude: 44.0, longitude: -84.0, category: "Trailhead" },
  { id: "b", name: "B", area: "B area", latitude: 43.8, longitude: -84.1, category: "Waterfall" },
];

test("Build My Day chooses the routed order with the least driving", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      code: "Ok",
      durations: [
        [0, 3600, 600],
        [3600, 0, 600],
        [600, 600, 0],
      ],
      distances: [
        [0, 96560, 16093],
        [96560, 0, 16093],
        [16093, 16093, 0],
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const result = await buildDayPlan({
      origin,
      places,
      startAt: new Date("2026-08-28T13:00:00-04:00"),
    });

    assert.equal(result.source, "routed");
    assert.deepEqual(result.stops.map((stop) => stop.id), ["b", "a"]);
    assert.equal(result.totalDriveMinutes, 20);
    assert.equal(result.legs.length, 2);
    assert.ok(result.stops.every((stop) => stop.arrivalLabel && stop.leaveLabel));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Build My Day falls back explicitly when routing is unavailable", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("routing down"); };

  try {
    const result = await buildDayPlan({ origin, places });
    assert.equal(result.source, "estimated");
    assert.equal(result.stops.length, 2);
    assert.ok(result.totalDriveMinutes > 0);
    assert.match(result.note, /straight-line planning estimates/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
