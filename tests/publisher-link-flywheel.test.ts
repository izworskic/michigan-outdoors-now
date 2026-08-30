import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("publisher kit remains noindex and ships a static attribution backlink", async () => {
  const page = await source("src/app/for-publishers/page.tsx");

  assert.match(page, /index:\s*false/);
  assert.match(page, /follow:\s*true/);
  assert.match(page, /data-michigan-outdoors-widget/);
  assert.match(page, /Michigan Outdoors Now by Chris Izworski/);
  assert.match(page, /utm_medium=referral/);
  assert.match(page, /michigan_outdoors_now_attribution/);
});

test("publisher widget is noindex and only emits tagged outbound links", async () => {
  const widget = await source("src/app/widget.js/route.ts");

  assert.match(widget, /X-Robots-Tag": "noindex, nofollow, noarchive"/);
  assert.match(widget, /Access-Control-Allow-Origin": "\*"/);
  assert.match(widget, /michigan_outdoors_now_embed/);
  assert.match(widget, /michigan_outdoors_now_attribution/);
  assert.match(widget, /data-michigan-outdoors-widget/);
  assert.doesNotMatch(widget, /navigator\.geolocation/);
  assert.doesNotMatch(widget, /document\.cookie/);
});

test("publisher referral attribution persists into existing growth events", async () => {
  const analytics = await source("src/lib/growth-analytics.ts");
  const contract = await source("src/lib/growth-contract.ts");
  const tracker = await source("src/components/publisher-referral-tracker.tsx");

  assert.match(contract, /publisher_referral_landed/);
  assert.match(analytics, /sessionStorage/);
  assert.match(analytics, /referral_source/);
  assert.match(analytics, /referral_campaign/);
  assert.match(tracker, /publisher_referral_landed/);
});

test("publisher operating plan requires quality placements and measurable outcomes", async () => {
  const docs = await source("docs/PUBLISHER_LINK_FLYWHEEL.md");

  assert.match(docs, /5 legitimate new referring domains/);
  assert.match(docs, /3 live publisher widget placements/);
  assert.match(docs, /30 publisher-referred planner starts/);
  assert.match(docs, /paid-link networks/);
  assert.match(docs, /product-value signal/i);
});
