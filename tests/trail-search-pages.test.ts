import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { trailProfiles } from "../src/data/trail-profiles";
import { trailSearchPages, trailSearchPageStats } from "../src/lib/trail-search-pages";

test("statewide trail search cluster stays small and route-specific", () => {
  assert.equal(trailSearchPages.length, 6);
  assert.ok(trailSearchPages.every((page) => page.profiles.length >= 3));
  assert.ok(trailSearchPages.every((page) => !/from-|near-[a-z]/.test(page.slug)));
});

test("every trail-search page has SERP-disciplined metadata", () => {
  for (const page of trailSearchPages) {
    assert.ok(page.title.length <= 60, "title too long: " + page.title);
    assert.ok(page.description.length <= 158, "description too long: " + page.description);
  }
});

test("published trail mileage is tied to an official land-manager source", () => {
  const allowed = new Set([
    "National Park Service",
    "Michigan DNR",
    "U.S. Forest Service",
    "Huron-Clinton Metroparks",
    "U.S. Fish & Wildlife Service",
    "Michigan DNR / Huron-Manistee National Forests",
    "City of Traverse City",
    "Mackinac State Historic Parks",
    "City of Marquette",
  ]);
  for (const profile of trailProfiles) {
    assert.ok(profile.distanceMiles > 0);
    assert.ok(allowed.has(profile.sourceLabel), profile.sourceLabel);
    assert.match(profile.sourceUrl, /^https:\/\//);
    assert.ok(profile.sourceNote.includes(String(profile.distanceMiles)) || profile.id === "summit-peak");
  }
});

test("trail search pages expose route truth and Chris entity connections", async () => {
  const page = await readFile(
    new URL("../src/app/hiking/[intent]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /Trail Truth standard/);
  assert.match(page, /Official route sources checked/);
  assert.match(page, /Chris Izworski profile/);
  assert.match(page, /trailSearchPages/);
  assert.match(page, /ItemList/);
});


test("existing trail canonicals expose catalog depth without changing the page family", () => {
  assert.equal(trailSearchPages.length, 6);
  for (const page of trailSearchPages) {
    const stats = trailSearchPageStats(page);
    assert.equal(stats.routeCount, page.profiles.length);
    assert.ok(stats.destinationCount >= 1);
    assert.ok(stats.areaCount >= 1);
    assert.ok(stats.minMiles > 0);
    assert.ok(stats.maxMiles >= stats.minMiles);
    assert.equal(
      stats.loopCount + stats.outAndBackCount + stats.pointToPointCount + stats.networkCount,
      page.profiles.length,
    );
  }
});

test("trail search pages add crawlable evidence and destination handoffs without title churn", async () => {
  const page = await readFile(
    new URL("../src/app/hiking/[intent]/page.tsx", import.meta.url),
    "utf8",
  );
  assert.match(page, /Trail Truth catalog coverage/);
  assert.match(page, /verified route choices/);
  assert.match(page, /Hiking areas represented/);
  assert.match(page, /representedDestinations/);
  assert.match(page, /stats\.routeCount/);
});
