import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const appOutput = path.resolve(".next/server/app");

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? filesBelow(entryPath) : [entryPath];
    }),
  );
  return nested.flat();
}

const files = await filesBelow(appOutput);
const htmlFiles = files.filter((file) => file.endsWith(".html"));
function jsonLdBlocks(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (match) => JSON.parse(match[1]),
  );
}
const homePath = htmlFiles.find((file) => file === path.join(appOutput, "index.html"));
assert.ok(homePath, "built homepage HTML was not found");

const home = await readFile(homePath, "utf8");
assert.match(home, /Michigan Outdoors Now/);
assert.match(home, /Chris Izworski/);
assert.match(home, /noindex/);
assert.match(home, /application\/ld\+json/);
assert.match(home, /Go find something\./);
assert.match(home, /What are you after\?/);
assert.match(home, /Best now/);
assert.match(home, /Water/);
assert.match(home, /Trail/);
assert.match(home, /River/);
assert.match(home, /After dark/);
assert.match(home, /Long haul/);
assert.match(home, /Weekend/);
assert.match(home, /Start from a city or ZIP/);
assert.match(home, /Use my current location/);
assert.match(home, /Full atlas/);
assert.doesNotMatch(home, /Not a shortlist\.|Decision-ready places where the platform can go deeper|Official DNR map layer/);
assert.doesNotMatch(home, /michigan-waterfall-conditions|michigan-stargazing-tonight|keweenaw-hiking-conditions|michigan-snowshoe-conditions|great-lakes-freighter-viewing/);

const originSlugs = [
  "bay-city",
  "saginaw",
  "detroit",
  "ann-arbor",
  "flint",
  "lansing",
  "grand-rapids",
  "kalamazoo",
  "traverse-city",
  "marquette",
  "mackinaw-city",
];
const guideSlugs = [
  "outdoors-today",
  "family-day-trips",
  "beach-day-trips",
  "hiking-day-trips",
  "birding-day-trips",
  "paddling-day-trips",
  "dark-sky-stargazing",
  "freighter-watching",
  "dog-friendly-day-trips",
  "lower-barrier-outdoors",
];
const placeSlugs = [
  "belle-isle",
  "lake-st-clair-metropark",
  "kensington-metropark",
  "waterloo",
  "shiawassee-nwr",
  "bay-city-state-park",
  "tawas-point",
  "rifle-river",
  "au-sable-mio",
  "lumbermans-monument",
  "sturgeon-point",
  "hartwick-pines",
  "headlands",
  "wilderness-state-park",
  "soo-locks",
  "whitefish-point",
  "tahquamenon-falls",
  "seney-nwr",
  "pictured-rocks",
  "kitch-iti-kipi",
  "presque-isle-marquette",
  "porcupine-mountains",
  "sleeping-bear",
  "brown-bridge",
  "ludington-state-park",
  "holland-state-park",
  "warren-dunes",
  "grand-haven-state-park",
  "mackinac-island",
  "torch-lake-antrim",
  "silver-lake-state-park",
  "port-crescent-state-park",
  "negwegon-state-park",
  "ocqueoc-falls",
  "petoskey-state-park",
  "fayette-state-park",
  "mclain-state-park",
  "fort-wilkins",
  "isle-royale",
];

for (const slug of originSlugs) {
  const originPage = htmlFiles.find((file) => file.endsWith(`/from/${slug}.html`));
  assert.ok(originPage, `built origin page missing: ${slug}`);
  const html = await readFile(originPage, "utf8");
  assert.match(html, /Chris Izworski/);
  assert.match(html, new RegExp(`/from/${slug}`));
}

const guideIndex = htmlFiles.find((file) => file.endsWith("/ideas.html"));
assert.ok(guideIndex, "built guide index missing");
assert.match(await readFile(guideIndex, "utf8"), /Ten ways into one useful decision/);

const exploreIndex = htmlFiles.find((file) => file.endsWith("/explore.html"));
assert.ok(exploreIndex, "built destination explorer missing");
const exploreHtml = await readFile(exploreIndex, "utf8");
assert.match(exploreHtml, /Explore Michigan outdoors\./);
assert.match(exploreHtml, /Official DNR trails and access changes/);
assert.match(exploreHtml, /Michigan DNR Trails Open Data/);
assert.doesNotMatch(exploreHtml, /Not a shortlist\.|numbered pins|result-map-number|Show all 28 places|See all 28 places/);
assert.match(exploreHtml, /CollectionPage/);
assert.match(exploreHtml, /Dataset/);

for (const slug of guideSlugs) {
  const guidePage = htmlFiles.find((file) => file.endsWith(`/ideas/${slug}.html`));
  assert.ok(guidePage, `built guide page missing: ${slug}`);
  const html = await readFile(guidePage, "utf8");
  assert.match(html, /Quick answer/);
  assert.match(html, /Chris Izworski/);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, new RegExp(`/ideas/${slug}`));
  assert.match(html, /Official source/);
  const structuredData = jsonLdBlocks(html);
  assert.ok(structuredData.length >= 2, `guide schema blocks missing: ${slug}`);
  const schemaText = JSON.stringify(structuredData);
  assert.match(schemaText, /BreadcrumbList/);
  assert.match(schemaText, /ItemList/);
  assert.match(schemaText, /FAQPage/);
}

for (const slug of placeSlugs) {
  const placePage = htmlFiles.find((file) => file.endsWith(`/places/${slug}.html`));
  assert.ok(placePage, `built destination page missing: ${slug}`);
  const html = await readFile(placePage, "utf8");
  assert.match(html, /Quick answer/);
  assert.match(html, /Today at a glance/);
  assert.match(html, /Chris Izworski/);
  assert.match(html, /Official details/);
  assert.match(html, new RegExp(`/places/${slug}`));
  const schemaText = JSON.stringify(jsonLdBlocks(html));
  assert.match(schemaText, /BreadcrumbList/);
  assert.match(schemaText, /GeoCoordinates/);
  assert.match(schemaText, /"Place"/);
}

const searchLandingPageCount = htmlFiles.filter((file) =>
  /\/from\/[^/]+\/[^/]+\.html$/.test(file),
).length;
const trailSearchPageCount = htmlFiles.filter((file) =>
  /\/hiking\/[^/]+\.html$/.test(file),
).length;

const sitemapPath = files.find((file) => file.endsWith("sitemap.xml.body"));
assert.ok(sitemapPath, "built sitemap body was not found");
const sitemap = await readFile(sitemapPath, "utf8");
const expectedSitemapUrls =
  placeSlugs.length + originSlugs.length + guideSlugs.length + searchLandingPageCount + trailSearchPageCount + 4;
assert.equal((sitemap.match(/<url>/g) ?? []).length, expectedSitemapUrls);
assert.doesNotMatch(sitemap, /<priority>|<changefreq>|<lastmod>/);

const robotsPath = files.find((file) => file.endsWith("robots.txt.body"));
assert.ok(robotsPath, "built robots body was not found");
const robots = await readFile(robotsPath, "utf8");
assert.match(robots, /Disallow: \//);

console.log(`SEO check passed: ${originSlugs.length} origin hubs, ${searchLandingPageCount} qualified location-intent pages, ${trailSearchPageCount} route-specific hiking pages, ${guideSlugs.length} substantial guides, ${placeSlugs.length} destination decision pages, ${expectedSitemapUrls} sitemap URLs, and preview noindex.`);
