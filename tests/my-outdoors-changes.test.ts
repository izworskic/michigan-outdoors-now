import assert from "node:assert/strict";
import test from "node:test";
import {
  detectSavedPlaceChanges,
  snapshotSavedOpportunityBaselines,
} from "../src/lib/my-outdoors-changes";
import type { RememberedPlace } from "../src/lib/my-outdoors";
import type { OutdoorOpportunity } from "../src/lib/opportunity-engine";

const saved: RememberedPlace[] = [
  {
    id: "tawas-point",
    name: "Tawas Point State Park",
    area: "Tawas",
    path: "/places/tawas-point",
    kind: "curated",
    savedAt: "2026-08-27T12:00:00.000Z",
  },
  {
    id: "osm:node:1",
    name: "Live Map Place",
    area: "Michigan",
    path: "https://www.openstreetmap.org/node/1",
    kind: "discovery",
    savedAt: "2026-08-27T12:00:00.000Z",
  },
];

function opportunity(score = 96, signalStrength = 101): OutdoorOpportunity {
  return {
    id: "tawas-point-hiking",
    kind: "standout-hike",
    destination: {
      id: "tawas-point",
      name: "Tawas Point State Park",
      area: "Tawas",
      setting: "Lake Huron shoreline",
    },
    activity: "hiking",
    score,
    status: "good",
    confidence: "high",
    bestWindow: "9 AM–1 PM",
    title: "A hiking window stands out",
    whyNow: "Strong today because of 10% rain chance and light gusts.",
    comparison: "About 11 points stronger than tomorrow's weather fit here.",
    caveat: "Verify access before leaving.",
    verifyLabel: "Open the full place decision",
    verifyUrl: "/places/tawas-point",
    signalStrength,
  };
}

test("first saved-place check establishes a baseline without inventing a change", () => {
  const checkedAt = "2026-08-28T20:00:00.000Z";
  const result = detectSavedPlaceChanges({
    savedPlaces: saved,
    previous: {},
    opportunities: [opportunity()],
    checkedAt,
  });

  assert.equal(result.changes.length, 0);
  assert.equal(result.current["tawas-point"].qualifies, true);
  assert.equal(result.current["tawas-point"].score, 96);
  assert.equal(result.current["osm:node:1"], undefined);
});

test("a saved place moving from no opportunity into a standout window is a change", () => {
  const result = detectSavedPlaceChanges({
    savedPlaces: saved,
    previous: {
      "tawas-point": {
        checkedAt: "2026-08-27T20:00:00.000Z",
        qualifies: false,
        score: null,
        signalStrength: null,
        activity: null,
        kind: null,
      },
    },
    opportunities: [opportunity()],
    checkedAt: "2026-08-28T20:00:00.000Z",
  });

  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].kind, "new-window");
  assert.equal(result.changes[0].placeId, "tawas-point");
});

test("a material score improvement on an already-good saved place is a change", () => {
  const result = detectSavedPlaceChanges({
    savedPlaces: saved,
    previous: {
      "tawas-point": {
        checkedAt: "2026-08-27T20:00:00.000Z",
        qualifies: true,
        score: 92,
        signalStrength: 94,
        activity: "hiking",
        kind: "standout-hike",
      },
    },
    opportunities: [opportunity(100, 106)],
    checkedAt: "2026-08-28T20:00:00.000Z",
  });

  assert.equal(result.changes.length, 1);
  assert.equal(result.changes[0].kind, "stronger-window");
  assert.match(result.changes[0].detail, /8 points/);
});

test("small fluctuations do not become return-visit alerts", () => {
  const result = detectSavedPlaceChanges({
    savedPlaces: saved,
    previous: {
      "tawas-point": {
        checkedAt: "2026-08-27T20:00:00.000Z",
        qualifies: true,
        score: 94,
        signalStrength: 99,
        activity: "hiking",
        kind: "standout-hike",
      },
    },
    opportunities: [opportunity(97, 106)],
    checkedAt: "2026-08-28T20:00:00.000Z",
  });

  assert.equal(result.changes.length, 0);
});

test("baseline snapshots are bounded to curated saved places", () => {
  const snapshot = snapshotSavedOpportunityBaselines(
    saved,
    [opportunity()],
    "2026-08-28T20:00:00.000Z",
  );
  assert.deepEqual(Object.keys(snapshot), ["tawas-point"]);
});
