import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";

const root = process.cwd();

async function source(relativePath: string) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("publisher kit remains noindex and ships clean static attribution backlinks", async () => {
  const page = await source("src/app/for-publishers/page.tsx");

  assert.match(page, /index:\s*false/);
  assert.match(page, /follow:\s*true/);
  assert.ok(page.includes("data-michigan-outdoors-widget"));
  assert.ok(page.includes('<a href="${baseUrl}/">Michigan Outdoors Now</a>'));
  assert.ok(page.includes('href="https://chrisizworski.com/chris-izworski/"'));
  assert.ok(!page.includes('href="${baseUrl}/?utm_'));
});

test("publisher widget is noindex and emits tagged outbound links", async () => {
  const widget = await source("src/app/widget.js/route.ts");

  assert.ok(widget.includes('"X-Robots-Tag": "noindex, nofollow, noarchive"'));
  assert.ok(widget.includes('"Access-Control-Allow-Origin": "*"'));
  assert.ok(widget.includes("michigan_outdoors_now_embed"));
  assert.ok(widget.includes("michigan_outdoors_now_attribution"));
  assert.ok(widget.includes("chrisizworski.com/chris-izworski/"));
  assert.ok(widget.includes("data-michigan-outdoors-widget"));
  assert.ok(!widget.includes("navigator.geolocation"));
  assert.ok(!widget.includes("document.cookie"));
});

test("publisher referral attribution persists into existing growth events", async () => {
  const analytics = await source("src/lib/growth-analytics.ts");
  const contract = await source("src/lib/growth-contract.ts");
  const tracker = await source("src/components/publisher-referral-tracker.tsx");

  assert.ok(contract.includes("publisher_referral_landed"));
  assert.ok(analytics.includes("sessionStorage"));
  assert.ok(analytics.includes("referral_source"));
  assert.ok(analytics.includes("referral_campaign"));
  assert.ok(tracker.includes("publisher_referral_landed"));
});

test("weekly growth intelligence exposes publisher funnel winners", async () => {
  const fetcher = await source("scripts/fetch-vercel-product-events.mjs");
  const brief = await source("scripts/build-growth-brief.ts");

  assert.ok(fetcher.includes("publisherSignals"));
  assert.ok(fetcher.includes("eventData/referral_source"));
  assert.ok(brief.includes("Publisher referral flywheel"));
  assert.ok(brief.includes("publisherSignals"));
});

test("publisher operating plan requires quality placements and measurable outcomes", async () => {
  const docs = await source("docs/PUBLISHER_LINK_FLYWHEEL.md");

  assert.ok(docs.includes("5 legitimate new referring domains"));
  assert.ok(docs.includes("3 live publisher widget placements"));
  assert.ok(docs.includes("30 publisher-referred planner starts"));
  assert.ok(docs.includes("paid-link networks"));
  assert.match(docs, /product-value signal/i);
});
