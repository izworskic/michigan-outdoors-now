import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyMyOutdoorsProfile,
  normalizeMyOutdoorsProfile,
  recordRecentPlace,
  removeRememberedPlace,
  saveRememberedPlace,
  toggleVisitedPlace,
  tripShapeDriveHours,
} from "../src/lib/my-outdoors";

test("normalizes My Outdoors without retaining invalid activity or range values", () => {
  const profile = normalizeMyOutdoorsProfile({
    homeOrigin: "  Bay City, MI  ",
    maxDriveHours: 99,
    favoriteActivities: ["hiking", "not-real", "fishing"],
    tripShape: "full-day",
    kids: true,
  });

  assert.equal(profile.homeOrigin, "Bay City, MI");
  assert.equal(profile.maxDriveHours, 8);
  assert.deepEqual(profile.favoriteActivities, ["hiking", "fishing"]);
  assert.equal(profile.tripShape, "full-day");
  assert.equal(profile.kids, true);
});

test("saves, removes, and records recent places without duplicates", () => {
  let profile = emptyMyOutdoorsProfile();
  profile = saveRememberedPlace(profile, {
    id: "tawas-point",
    name: "Tawas Point State Park",
    area: "Tawas",
    path: "/places/tawas-point",
    kind: "curated",
  });
  profile = saveRememberedPlace(profile, {
    id: "tawas-point",
    name: "Tawas Point State Park",
    area: "Tawas",
    path: "/places/tawas-point",
    kind: "curated",
  });

  assert.equal(profile.savedPlaces.length, 1);

  profile = recordRecentPlace(profile, {
    id: "tawas-point",
    name: "Tawas Point State Park",
    area: "Tawas",
    path: "/places/tawas-point",
  });
  profile = recordRecentPlace(profile, {
    id: "tawas-point",
    name: "Tawas Point State Park",
    area: "Tawas",
    path: "/places/tawas-point",
  });

  assert.equal(profile.recentPlaces.length, 1);
  profile = removeRememberedPlace(profile, "tawas-point");
  assert.equal(profile.savedPlaces.length, 0);
});

test("visited state toggles and trip shapes map to bounded drive windows", () => {
  let profile = emptyMyOutdoorsProfile();
  profile = toggleVisitedPlace(profile, "porcupine-mountains");
  assert.equal(profile.visitedPlaceIds.includes("porcupine-mountains"), true);
  profile = toggleVisitedPlace(profile, "porcupine-mountains");
  assert.equal(profile.visitedPlaceIds.includes("porcupine-mountains"), false);

  assert.equal(tripShapeDriveHours("quick"), 1);
  assert.equal(tripShapeDriveHours("half-day"), 2);
  assert.equal(tripShapeDriveHours("full-day"), 4);
  assert.equal(tripShapeDriveHours("weekend"), 8);
});
