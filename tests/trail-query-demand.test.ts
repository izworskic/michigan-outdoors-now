import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { SearchConsoleRow } from "../src/lib/growth-opportunities";
import {
  trailCandidateDemand,
  trailCandidateDemandRule,
} from "../src/lib/trail-query-demand";

const rows: SearchConsoleRow[] = [
  {
    page: "/hiking/long-hikes-michigan",
    query: "best loop hikes michigan",
    clicks: 4,
    impressions: 180,
    ctr: 4 / 180,
    position: 8,
  },
  {
    page: "/hiking/easy-short-hikes-michigan",
    query: "accessible trails michigan",
    clicks: 1,
    impressions: 90,
    ctr: 1 / 90,
    position: 12,
  },
  {
    page: "/hiking/rugged-hikes-michigan",
    query: "pictured rocks hike",
    clicks: 2,
    impressions: 80,
    ctr: 0.025,
    position: 10,
  },
  {
    page: "/hiking/long-hikes-michigan",
    query: "michigan hiking",
    clicks: 3,
    impressions: 250,
    ctr: 0.012,
    position: 14,
  },
];

test("trail candidate demand aggregates only matching Search Console query intent", () => {
  const demand = trailCandidateDemand(rows);
  const loop = demand.find((item) => item.slug === "loop-hikes-michigan");
  const national = demand.find((item) => item.slug === "national-park-hikes-michigan");

  assert.equal(loop?.impressions, 180);
  assert.equal(loop?.clicks, 4);
  assert.equal(loop?.matchedQueries, 1);
  assert.equal(loop?.state, "demand-signal-only");

  assert.equal(national?.impressions, 80);
  assert.equal(national?.clicks, 2);
});

test("generic Michigan hiking demand is not falsely assigned to a future family", () => {
  const demand = trailCandidateDemand(rows);
  const totalCandidateImpressions = demand.reduce(
    (sum, item) => sum + item.impressions,
    0,
  );
  assert.ok(totalCandidateImpressions < rows.reduce((sum, row) => sum + row.impressions, 0));
});

test("trail demand output cannot authorize a canonical", () => {
  assert.match(trailCandidateDemandRule, /leading indicator only/i);
  assert.match(trailCandidateDemandRule, /cannot authorize a new canonical/i);
  assert.match(trailCandidateDemandRule, /central cannibalization review/i);
});

test("weekly growth scripts expose candidate demand and the non-authorization rule", async () => {
  const [brief, report] = await Promise.all([
    readFile(new URL("../scripts/build-growth-brief.ts", import.meta.url), "utf8"),
    readFile(new URL("../scripts/report-growth-opportunities.ts", import.meta.url), "utf8"),
  ]);
  assert.match(brief, /Trail candidate demand — leading signal only/);
  assert.match(brief, /trailCandidateDemandRule/);
  assert.match(report, /BLOCKED TRAIL-FAMILY DEMAND — LEADING SIGNAL ONLY/);
  assert.match(report, /trailCandidateDemandRule/);
});
