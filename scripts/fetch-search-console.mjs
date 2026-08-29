#!/usr/bin/env node

import { createSign } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function base64url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function defaultWindow() {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 3);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  return { start: isoDate(start), end: isoDate(end) };
}

async function accessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(JSON.stringify({
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: credentials.token_uri || "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer
    .sign(credentials.private_key, "base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const assertion = `${unsigned}.${signature}`;

  const response = await fetch(credentials.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Search Console OAuth failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!payload.access_token) throw new Error("Search Console OAuth returned no access token.");
  return payload.access_token;
}

function brandedQuery(query) {
  return /\\b(chris\\s+izworski|izworski|freighter\\s+view\\s+farms)\\b/i.test(query);
}

function classifyPath(pageUrl) {
  const pathname = new URL(pageUrl).pathname;
  const match = pathname.match(/^\/from\/([^/]+)\/([^/]+)\/?$/);
  return {
    page: pathname,
    origin: match?.[1],
    family: match?.[2],
  };
}

async function fetchRows({ token, siteUrl, host, startDate, endDate }) {
  const all = [];
  const rowLimit = 25_000;
  for (let startRow = 0; startRow < 100_000; startRow += rowLimit) {
    const response = await fetch(
      `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate,
          endDate,
          dimensions: ["page", "query"],
          rowLimit,
          startRow,
          dataState: "final",
          dimensionFilterGroups: [{
            groupType: "and",
            filters: [{
              dimension: "page",
              operator: "contains",
              expression: `https://${host}/`,
            }],
          }],
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Search Console query failed: ${response.status} ${detail.slice(0, 300)}`);
    }

    const payload = await response.json();
    const batch = Array.isArray(payload.rows) ? payload.rows : [];
    all.push(...batch);
    if (batch.length < rowLimit) break;
  }
  return all;
}

const rawCredentials = process.env.GSC_SERVICE_ACCOUNT_JSON?.trim();
if (!rawCredentials) {
  throw new Error("GSC_SERVICE_ACCOUNT_JSON is required.");
}

const credentials = JSON.parse(rawCredentials);
if (!credentials.client_email || !credentials.private_key) {
  throw new Error("GSC_SERVICE_ACCOUNT_JSON must include client_email and private_key.");
}

const siteUrl = process.env.GSC_SITE_URL?.trim() || "sc-domain:chrisizworski.com";
const host = process.env.GSC_OUTDOORS_HOST?.trim() || "michiganoutdoorsnow.chrisizworski.com";
const defaults = defaultWindow();
const startDate = arg("--start", defaults.start);
const endDate = arg("--end", defaults.end);
const output = arg("--output", "artifacts/growth/search-console-latest.json");

const token = await accessToken(credentials);
const rows = await fetchRows({ token, siteUrl, host, startDate, endDate });
const normalized = rows.map((row) => {
  const [pageUrl = "", query = ""] = row.keys ?? [];
  const classified = classifyPath(pageUrl);
  return {
    ...classified,
    query,
    branded: brandedQuery(query),
    clicks: Number(row.clicks ?? 0),
    impressions: Number(row.impressions ?? 0),
    ctr: Number(row.ctr ?? 0),
    position: Number(row.position ?? 0),
  };
});

const payload = {
  version: 1,
  kind: "search-console-normalized",
  window: {
    label: `${startDate} through ${endDate}`,
    start: startDate,
    end: endDate,
  },
  source: {
    type: "google-search-console-api",
    property: siteUrl,
    host,
    dimensions: ["page", "query"],
    dataState: "final",
  },
  rows: normalized,
};

const outputPath = path.resolve(output);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(payload, null, 2) + "\n");

console.log(`Search Console snapshot: ${normalized.length} query × page rows from ${startDate} through ${endDate}`);
console.log(`Wrote ${outputPath}`);
