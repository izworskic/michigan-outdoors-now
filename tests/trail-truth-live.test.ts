import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { trailProfiles } from "../src/data/trail-profiles";
import { trailGeometryNameScore } from "../src/lib/trail-geometry";
import { assessDaylightFit, trailEntryPointDirectionsUrl, trailheadDirectionsUrl } from "../src/lib/trail-live";

function profile(id: string) {
  const value = trailProfiles.find((candidate) => candidate.id === id);
  assert.ok(value, `missing Trail Truth profile: ${id}`);
  return value;
}

test("Trail Truth geometry matching prefers the intended named route", () => {
  assert.ok(
    trailGeometryNameScore("Chapel Loop", "Chapel Loop") >
      trailGeometryNameScore("Chapel Loop", "Mosquito Falls Trail"),
  );
  assert.ok(
    trailGeometryNameScore(
      "Ocqueoc Falls Bicentennial Pathway — 6-mile loop",
      "Ocqueoc Falls Bicentennial Pathway",
    ) >= 28,
  );
  assert.ok(
    trailGeometryNameScore("Mount Franklin from Rock Harbor", "Mount Franklin Trail") >
      trailGeometryNameScore("Mount Franklin from Rock Harbor", "Stoll Memorial Trail"),
  );
});

test("finish-before-dark logic subtracts travel time before judging the hike", () => {
  const chapel = profile("chapel-loop");
  const roomy = assessDaylightFit(chapel, 12, 120);
  assert.equal(roomy.status, "comfortable");

  const afterLongDrive = assessDaylightFit(chapel, 7, 180);
  assert.notEqual(afterLongDrive.status, "comfortable");
});

test("long rugged hikes are rejected when the daylight window cannot fit them", () => {
  const lakeSuperior = profile("lake-superior-trail");
  const daylight = assessDaylightFit(lakeSuperior, 9, 120);
  assert.equal(daylight.status, "insufficient");
});

test("verified named trailheads get a direct navigation action", () => {
  const empire = profile("empire-bluff");
  const action = trailheadDirectionsUrl(empire);
  assert.ok(action);
  assert.match(action!.url, /google\.com\/maps\/search/);
  assert.match(decodeURIComponent(action!.url), /Empire Bluff Trailhead/);
  assert.equal(action!.source, "verified-profile");
});

test("official geometry can provide a route-start navigation fallback", () => {
  const lakeSuperior = profile("lake-superior-trail");
  const action = trailheadDirectionsUrl(lakeSuperior, {
    status: "official",
    routeStart: { latitude: 46.812345, longitude: -89.612345 },
  });
  assert.ok(action);
  assert.equal(action!.source, "official-geometry");
  assert.match(decodeURIComponent(action!.url), /46\.812345,-89\.612345/);
});

test("Trail Truth Live UI keeps official geometry separate from mapped fallback", async () => {
  const [hub, map, geometry, api] = await Promise.all([
    readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/components/michigan-destination-map.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/lib/trail-geometry.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/trail-geometry/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(hub, /Pick your hike/);
  assert.match(hub, /Finish before dark\?/);
  assert.match(hub, /activeTrailheadAction\.label/);
  assert.match(hub, /Trail Truth Live/);
  assert.match(hub, /selectedTrailGeoJson/);

  assert.match(map, /selected-trail-truth-line/);
  assert.match(map, /official geometry/);
  assert.match(map, /mapped fallback/);

  assert.match(geometry, /NPS_Public_Trails_Geographic/);
  assert.match(geometry, /DNRTrailsOPENDATA/);
  assert.match(geometry, /status: "official"/);
  assert.match(geometry, /status: "mapped"/);
  assert.match(geometry, /not an official land-manager centerline/);

  assert.match(api, /X-Robots-Tag/);
  assert.match(api, /fetchTrailGeometry/);
});


test("official entry points get direct navigation without becoming invented route profiles", () => {
  const brown = profile("brown-bridge-network");
  const entry = brown.access?.entryPoints?.[0];
  assert.ok(entry);
  const url = trailEntryPointDirectionsUrl(brown, entry!);
  assert.match(url, /google\.com\/maps\/search/);
  assert.match(decodeURIComponent(url), /Buck's Landing Trailhead/);
});
