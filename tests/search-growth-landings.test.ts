import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  landingDirectAnswer,
  landingQualitySummary,
  searchLandings,
  searchLandingIntents,
} from "../src/lib/search-landings";

test("location-intent pages create meaningful but bounded search surface area", () => {
  const summary = landingQualitySummary();

  assert.ok(summary.total >= 20, "expected at least 20 qualified pages, got " + summary.total);
  assert.ok(summary.total <= 60, "search surface expanded beyond the controlled launch: " + summary.total);
  assert.ok(summary.originsCovered >= 6);
  assert.ok(summary.minimumPlacesPerLanding >= 4);
  assert.equal(summary.exactDuplicateSignatures, 0);
});

test("no accepted landing duplicates its top-four result signature for the same intent", () => {
  const signatures = new Set<string>();
  for (const landing of searchLandings) {
    const key = landing.intent.slug + ":" + landing.signature;
    assert.ok(!signatures.has(key), "duplicate landing signature: " + key);
    signatures.add(key);
  }
});

test("launch cluster avoids beach, freighter, and birding cannibalization", () => {
  const slugs = new Set(searchLandingIntents.map((intent) => intent.slug));

  assert.ok(!slugs.has("beaches"));
  assert.ok(!slugs.has("beach-day-trips"));
  assert.ok(!slugs.has("freighters"));
  assert.ok(!slugs.has("freighter-watching"));
  assert.ok(!slugs.has("birding"));
  assert.ok(!slugs.has("birding-day-trips"));
});

test("every search landing has SERP-safe metadata and a concrete local answer", () => {
  for (const landing of searchLandings) {
    const title = landing.intent.title(landing.origin);
    const description = landing.intent.description(landing.origin);
    const answer = landingDirectAnswer(landing);

    assert.ok(title.length <= 60, "title too long (" + title.length + "): " + title);
    assert.ok(description.length <= 158, "description too long (" + description.length + "): " + description);
    assert.ok(answer.includes(landing.origin.name));
    assert.ok(answer.includes(landing.places[0].name));
    assert.ok(answer.includes(landing.places[1].name));
    assert.ok(answer.includes(landing.places[2].name));
  }
});

test("location-intent route is crawlable and connected to the planner and Chris entity", async () => {
  const page = await readFile(
    new URL("../src/app/from/[origin]/[intent]/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(page, /generateStaticParams/);
  assert.match(page, /landingDirectAnswer\(landing\)/);
  assert.match(page, /landing\.places\.slice\(0, 6\)/);
  assert.match(page, /<Planner/);
  assert.match(page, /Chris Izworski profile/);
  assert.match(page, /https:\/\/chrisizworski\.com\/chris-izworski\//);
  assert.match(page, /https:\/\/chrisizworski\.com\/projects\//);
});

test("origin and guide hubs provide crawlable inbound links to qualified landings", async () => {
  const originPage = await readFile(
    new URL("../src/app/from/[origin]/page.tsx", import.meta.url),
    "utf8",
  );
  const guidePage = await readFile(
    new URL("../src/app/ideas/[guide]/page.tsx", import.meta.url),
    "utf8",
  );

  assert.match(originPage, /searchLandingsForOrigin/);
  assert.match(originPage, /landing\.intent\.slug/);
  assert.match(guidePage, /searchLandingsForGuide/);
  assert.match(guidePage, /From \{landing\.origin\.name\}/);
});

test("the tool uses the canonical Chris Izworski Person ID", async () => {
  const site = await readFile(new URL("../src/lib/site.ts", import.meta.url), "utf8");
  const layout = await readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

  assert.match(site, /https:\/\/chrisizworski\.com\/#person/);
  assert.doesNotMatch(site, /#chris-izworski/);
  assert.doesNotMatch(layout, /#chris-izworski/);
  assert.doesNotMatch(layout, /three practical Michigan/i);
  assert.match(layout, /Michigan Outdoor Day Trip Planner \| Chris Izworski/);
});
