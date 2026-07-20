import assert from "node:assert/strict";
import test from "node:test";
import { destinations } from "../src/data/destinations.ts";
import { guides } from "../src/data/guides.ts";
import type { ActivityId } from "../src/lib/types.ts";

const destinationById = new Map(destinations.map((destination) => [destination.id, destination]));

test("search guides cover ten distinct people-first intents", () => {
  assert.equal(guides.length, 10);
  assert.equal(new Set(guides.map((guide) => guide.slug)).size, guides.length);
  assert.equal(new Set(guides.map((guide) => guide.title)).size, guides.length);
  assert.equal(new Set(guides.map((guide) => guide.description)).size, guides.length);
  assert.ok(guides.every((guide) => /^[a-z0-9-]+$/.test(guide.slug)));
});

test("every guide contains enough visible help to justify an indexable page", () => {
  for (const guide of guides) {
    assert.ok(guide.directAnswer.length >= 180, `${guide.slug} needs a substantial direct answer`);
    assert.ok(guide.audience.length >= 80, `${guide.slug} needs a defined audience`);
    assert.equal(guide.tips.length, 3, `${guide.slug} needs three decision tips`);
    assert.ok(guide.checklist.length >= 4, `${guide.slug} needs a practical checklist`);
    assert.equal(guide.faqs.length, 3, `${guide.slug} needs three visible FAQs`);
    assert.ok(guide.destinationIds.length >= 5, `${guide.slug} needs five curated examples`);
    assert.ok(new Set(guide.destinationIds).size === guide.destinationIds.length);
    assert.ok(guide.destinationIds.every((id) => destinationById.has(id)), `${guide.slug} references an unknown destination`);
  }
});

test("activity guide examples actually support the promised activity", () => {
  const expectedActivity = new Map<string, ActivityId>([
    ["beach-day-trips", "beaches"],
    ["hiking-day-trips", "hiking"],
    ["birding-day-trips", "birding"],
    ["paddling-day-trips", "paddling"],
    ["dark-sky-stargazing", "dark-sky"],
    ["freighter-watching", "freighters"],
  ]);

  for (const [slug, activity] of expectedActivity) {
    const guide = guides.find((candidate) => candidate.slug === slug);
    assert.ok(guide);
    assert.ok(
      guide.destinationIds.every((id) => destinationById.get(id)?.activities.includes(activity)),
      `${slug} includes an example without ${activity}`,
    );
  }
});

test("family, dog, and lower-barrier examples honor their stated requirement", () => {
  const requirements = [
    ["family-day-trips", "kidsFriendly"],
    ["dog-friendly-day-trips", "dogsAllowed"],
    ["lower-barrier-outdoors", "accessibleFriendly"],
  ] as const;

  for (const [slug, field] of requirements) {
    const guide = guides.find((candidate) => candidate.slug === slug);
    assert.ok(guide);
    assert.ok(
      guide.destinationIds.every((id) => destinationById.get(id)?.[field]),
      `${slug} includes an example that fails ${field}`,
    );
  }
});
