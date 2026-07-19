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

for (const slug of originSlugs) {
  const originPage = htmlFiles.find((file) => file.endsWith(`/from/${slug}.html`));
  assert.ok(originPage, `built origin page missing: ${slug}`);
  const html = await readFile(originPage, "utf8");
  assert.match(html, /Chris Izworski/);
  assert.match(html, new RegExp(`/from/${slug}`));
}

const sitemapPath = files.find((file) => file.endsWith("sitemap.xml.body"));
assert.ok(sitemapPath, "built sitemap body was not found");
const sitemap = await readFile(sitemapPath, "utf8");
assert.equal((sitemap.match(/<url>/g) ?? []).length, 13);
assert.doesNotMatch(sitemap, /<priority>|<changefreq>|<lastmod>/);

const robotsPath = files.find((file) => file.endsWith("robots.txt.body"));
assert.ok(robotsPath, "built robots body was not found");
const robots = await readFile(robotsPath, "utf8");
assert.match(robots, /Disallow: \//);

console.log(`SEO check passed: ${originSlugs.length} local pages, 13 sitemap URLs, preview noindex.`);
