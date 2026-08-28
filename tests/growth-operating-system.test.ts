import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  scoreFamilyGrowth,
  scoreSearchOpportunity,
  type ProductFunnelRow,
  type SearchConsoleRow,
} from "../src/lib/growth-opportunities";
import { growthEventNames } from "../src/lib/growth-contract";

test("location-intent planner events keep their SEO context", async () => {
  const landing = await readFile(
    new URL("../src/app/from/[origin]/[intent]/page.tsx", import.meta.url),
    "utf8",
  );
  const planner = await readFile(
    new URL("../src/components/planner.tsx", import.meta.url),
    "utf8",
  );

  assert.match(landing, /surface: "location_intent"/);
  assert.match(landing, /originSlug: landing\.origin\.slug/);
  assert.match(landing, /intentSlug: landing\.intent\.slug/);
  assert.match(landing, /analyticsContext=\{analyticsContext\}/);
  assert.match(planner, /trackGrowthEvent\(name, analyticsContext, properties\)/);
});

test("semantic planner measures the complete decision funnel", async () => {
  const hub = await readFile(
    new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url),
    "utf8",
  );

  for (const event of [
    "semantic_search_started",
    "semantic_search_completed",
    "semantic_result_opened",
    "surprise_me_used",
    "surprise_rejected",
    "place_kept",
    "comparison_opened",
    "decision_argument_opened",
    "proof_ledger_opened",
    "departure_mode_opened",
    "directions_opened",
  ]) {
    assert.ok(hub.includes(`"${event}"`), `missing semantic growth event: ${event}`);
  }
});

test("growth analytics contract excludes precise location and free-text query fields", async () => {
  const analytics = await readFile(
    new URL("../src/lib/growth-analytics.ts", import.meta.url),
    "utf8",
  );
  const hub = await readFile(
    new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url),
    "utf8",
  );

  assert.match(analytics, /surface/);
  assert.match(analytics, /originSlug/);
  assert.match(analytics, /intentSlug/);
  assert.doesNotMatch(analytics, /latitude|longitude|coordinates|freeText|queryText/);
  assert.match(hub, /queryLength: query\.length/);
  assert.doesNotMatch(hub, /queryText:/);
});

test("query scoring separates CTR, authority, and UX problems", () => {
  const ctrRow: SearchConsoleRow = {
    page: "/from/bay-city/hiking",
    query: "hiking near bay city michigan",
    clicks: 1,
    impressions: 300,
    ctr: 0.0033,
    position: 8,
    family: "hiking",
  };
  assert.equal(scoreSearchOpportunity(ctrRow).action, "PUSH_CTR");

  const authorityRow: SearchConsoleRow = {
    page: "/from/detroit/paddling",
    query: "paddling near detroit",
    clicks: 1,
    impressions: 120,
    ctr: 0.0083,
    position: 19,
    family: "paddling",
  };
  assert.equal(scoreSearchOpportunity(authorityRow).action, "BUILD_AUTHORITY");

  const funnel: ProductFunnelRow = {
    pageKey: "from/bay-city/hiking",
    surface: "location_intent",
    origin: "bay-city",
    intent: "hiking",
    landingViews: 150,
    plannerStarts: 2,
    plannerCompletions: 1,
    resultOpens: 1,
    departures: 0,
    directions: 0,
  };
  assert.equal(scoreSearchOpportunity(ctrRow, funnel).action, "UX_REPAIR");
});

test("family expansion requires search demand and downstream decision value", () => {
  const search: SearchConsoleRow[] = [{
    page: "/from/bay-city/hiking",
    query: "hiking near bay city",
    clicks: 12,
    impressions: 600,
    ctr: 0.02,
    position: 9,
    family: "hiking",
  }];
  const healthy: ProductFunnelRow[] = [{
    pageKey: "from/bay-city/hiking",
    surface: "location_intent",
    origin: "bay-city",
    intent: "hiking",
    landingViews: 180,
    plannerStarts: 45,
    plannerCompletions: 18,
    resultOpens: 30,
    departures: 8,
    directions: 5,
  }];
  assert.equal(scoreFamilyGrowth("hiking", search, healthy).action, "EXPAND_FAMILY");

  const weak: ProductFunnelRow[] = [{
    ...healthy[0],
    plannerStarts: 2,
    plannerCompletions: 1,
    directions: 0,
  }];
  assert.equal(scoreFamilyGrowth("hiking", search, weak).action, "DO_NOT_EXPAND");
});

test("growth event taxonomy is fixed and includes acquisition plus commitment", () => {
  assert.ok(growthEventNames.includes("search_landing_viewed"));
  assert.ok(growthEventNames.includes("planner_completed"));
  assert.ok(growthEventNames.includes("departure_mode_opened"));
  assert.ok(growthEventNames.includes("directions_opened"));
});

test("CTR creative no longer advertises the obsolete three-plan product", async () => {
  const globalOg = await readFile(
    new URL("../src/app/opengraph-image.tsx", import.meta.url),
    "utf8",
  );
  const landingOg = await readFile(
    new URL("../src/app/from/[origin]/[intent]/opengraph-image.tsx", import.meta.url),
    "utf8",
  );

  assert.doesNotMatch(globalOg, /Three practical Michigan plans/i);
  assert.match(globalOg, /Compare Michigan places by drive, weather, trail access/);
  assert.match(landingOg, /Worth the drive\?/);
  assert.match(landingOg, /const label = landing\?\.intent\.label/);
  assert.match(landingOg, /const city = landing\?\.origin\.name/);
});


test("weekly Search Console collection uses final page by query data and fails closed without credentials", async () => {
  const fetchScript = await readFile(
    new URL("../scripts/fetch-search-console.mjs", import.meta.url),
    "utf8",
  );
  const workflow = await readFile(
    new URL("../.github/workflows/growth-intelligence.yml", import.meta.url),
    "utf8",
  );

  assert.match(fetchScript, /dimensions: \["page", "query"\]/);
  assert.match(fetchScript, /dataState: "final"/);
  assert.match(fetchScript, /GSC_SERVICE_ACCOUNT_JSON is required/);
  assert.match(workflow, /GSC_SERVICE_ACCOUNT_JSON/);
  assert.match(workflow, /configured=false/);
  assert.match(workflow, /Upload growth intelligence artifact/);
});


test("weekly Vercel collection groups fixed events by attributed SEO page", async () => {
  const fetchScript = await readFile(
    new URL("../scripts/fetch-vercel-product-events.mjs", import.meta.url),
    "utf8",
  );
  const workflow = await readFile(
    new URL("../.github/workflows/growth-intelligence.yml", import.meta.url),
    "utf8",
  );

  assert.match(fetchScript, /\/v1\/query\/web-analytics\/events\/aggregate/);
  assert.match(fetchScript, /by: "eventData\/page"/);
  assert.match(fetchScript, /eventData\/surface eq 'location_intent'/);
  assert.match(fetchScript, /planner_completed/);
  assert.match(fetchScript, /directions_opened/);
  assert.match(workflow, /VERCEL_ANALYTICS_TOKEN/);
  assert.match(workflow, /product-events-latest\.json/);
});
