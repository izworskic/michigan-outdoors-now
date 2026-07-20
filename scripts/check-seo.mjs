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
assert.match(exploreHtml, /Michigan destination finder/);
assert.match(exploreHtml, /Find places near me/);
assert.match(exploreHtml, /<strong>28<\/strong> matching/);
assert.match(exploreHtml, /Zoomable map of matching Michigan outdoor destinations/);
assert.equal((exploreHtml.match(/class="result-map-number"/g) ?? []).length, 28);
assert.match(exploreHtml, /CollectionPage/);

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

const sitemapPath = files.find((file) => file.endsWith("sitemap.xml.body"));
assert.ok(sitemapPath, "built sitemap body was not found");
const sitemap = await readFile(sitemapPath, "utf8");
assert.equal((sitemap.match(/<url>/g) ?? []).length, 53);
assert.doesNotMatch(sitemap, /<priority>|<changefreq>|<lastmod>/);

const robotsPath = files.find((file) => file.endsWith("robots.txt.body"));
assert.ok(robotsPath, "built robots body was not found");
const robots = await readFile(robotsPath, "utf8");
assert.match(robots, /Disallow: \//);

console.log(`SEO check passed: ${originSlugs.length} local pages, ${guideSlugs.length} substantial guides, ${placeSlugs.length} destination decision pages, an interactive map, 53 sitemap URLs, and preview noindex.`);
