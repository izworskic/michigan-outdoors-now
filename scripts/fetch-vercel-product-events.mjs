#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function arg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function defaultWindow() {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);
  return { start: isoDate(start), end: isoDate(end) };
}

function parsePageKey(pageKey) {
  const match = String(pageKey ?? "").match(/^from\/([^/]+)\/([^/]+)$/);
  return {
    origin: match?.[1],
    intent: match?.[2],
  };
}

async function aggregateEvent({
  token,
  teamId,
  projectId,
  eventName,
  since,
  until,
}) {
  const params = new URLSearchParams({
    teamId,
    projectId,
    since,
    until,
    by: "eventData/page",
    filter: `eventName eq '${eventName}' and eventData/surface eq 'location_intent'`,
  });
  const response = await fetch(
    `https://api.vercel.com/v1/query/web-analytics/events/aggregate?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Vercel Web Analytics query failed for ${eventName}: ${response.status} ${detail.slice(0, 300)}`,
    );
  }

  const payload = await response.json();
  const rows = Array.isArray(payload.data) ? payload.data : [];
  return rows
    .map((row) => ({
      pageKey:
        typeof row.eventData === "string"
          ? row.eventData
          : typeof row.value === "string"
            ? row.value
            : typeof row.key === "string"
              ? row.key
              : "",
      count: Number(row.count ?? 0),
    }))
    .filter((row) => row.pageKey && Number.isFinite(row.count));
}

async function aggregateOpportunityEvent({
  token,
  teamId,
  projectId,
  eventName,
  since,
  until,
}) {
  const params = new URLSearchParams({
    teamId,
    projectId,
    since,
    until,
    by: "eventData/opportunity_kind",
    filter: `eventName eq '${eventName}' and eventData/surface eq 'homepage_planner'`,
  });
  const response = await fetch(
    `https://api.vercel.com/v1/query/web-analytics/events/aggregate?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Vercel Web Analytics query failed for ${eventName}: ${response.status} ${detail.slice(0, 300)}`,
    );
  }

  const payload = await response.json();
  const rows = Array.isArray(payload.data) ? payload.data : [];
  return rows
    .map((row) => ({
      kind:
        typeof row.eventData === "string"
          ? row.eventData
          : typeof row.value === "string"
            ? row.value
            : typeof row.key === "string"
              ? row.key
              : "unknown",
      count: Number(row.count ?? 0),
    }))
    .filter((row) => Number.isFinite(row.count));
}

async function aggregateTotalEvent({
  token,
  teamId,
  projectId,
  eventName,
  since,
  until,
}) {
  const params = new URLSearchParams({
    teamId,
    projectId,
    since,
    until,
    by: "eventData/surface",
    filter: `eventName eq '${eventName}'`,
  });
  const response = await fetch(
    `https://api.vercel.com/v1/query/web-analytics/events/aggregate?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `Vercel Web Analytics query failed for ${eventName}: ${response.status} ${detail.slice(0, 300)}`,
    );
  }

  const payload = await response.json();
  const rows = Array.isArray(payload.data) ? payload.data : [];
  return rows.reduce((sum, row) => sum + Number(row.count ?? 0), 0);
}

const token = process.env.VERCEL_ANALYTICS_TOKEN?.trim() || process.env.VERCEL_TOKEN?.trim();
const teamId = process.env.VERCEL_ANALYTICS_TEAM_ID?.trim() || process.env.VERCEL_TEAM_ID?.trim();
const projectId =
  process.env.VERCEL_ANALYTICS_PROJECT_ID?.trim() ||
  process.env.VERCEL_PROJECT_ID?.trim();

if (!token) throw new Error("VERCEL_ANALYTICS_TOKEN or VERCEL_TOKEN is required.");
if (!teamId) throw new Error("VERCEL_ANALYTICS_TEAM_ID or VERCEL_TEAM_ID is required.");
if (!projectId) {
  throw new Error("VERCEL_ANALYTICS_PROJECT_ID or VERCEL_PROJECT_ID is required.");
}

const defaults = defaultWindow();
const since = arg("--start", defaults.start);
const until = arg("--end", defaults.end);
const output = arg("--output", "artifacts/growth/product-events-latest.json");

const eventMap = {
  search_landing_viewed: "landingViews",
  planner_started: "plannerStarts",
  planner_completed: "plannerCompletions",
  place_detail_opened: "resultOpens",
  departure_mode_opened: "departures",
  directions_opened: "directions",
  outbound_map_opened: "directions",
};

const byPage = new Map();
for (const [eventName, field] of Object.entries(eventMap)) {
  const aggregates = await aggregateEvent({
    token,
    teamId,
    projectId,
    eventName,
    since,
    until,
  });

  for (const aggregate of aggregates) {
    const existing = byPage.get(aggregate.pageKey) ?? {
      pageKey: aggregate.pageKey,
      surface: "location_intent",
      ...parsePageKey(aggregate.pageKey),
      landingViews: 0,
      plannerStarts: 0,
      plannerCompletions: 0,
      resultOpens: 0,
      departures: 0,
      directions: 0,
    };
    existing[field] += aggregate.count;
    byPage.set(aggregate.pageKey, existing);
  }
}


const opportunityOpened = await aggregateOpportunityEvent({
  token,
  teamId,
  projectId,
  eventName: "opportunity_opened",
  since,
  until,
});
const opportunityVerified = await aggregateOpportunityEvent({
  token,
  teamId,
  projectId,
  eventName: "opportunity_verify_opened",
  since,
  until,
});
const opportunityKinds = [...new Set([
  ...opportunityOpened.map((row) => row.kind),
  ...opportunityVerified.map((row) => row.kind),
])].sort();
const opportunitySignals = opportunityKinds.map((kind) => ({
  kind,
  opens: opportunityOpened.find((row) => row.kind === kind)?.count ?? 0,
  verifications: opportunityVerified.find((row) => row.kind === kind)?.count ?? 0,
}));


const myOutdoorsEventNames = [
  "my_outdoors_loaded",
  "my_outdoors_opened",
  "my_outdoors_saved",
  "my_outdoors_applied",
  "my_outdoors_place_remembered",
  "my_outdoors_place_saved",
  "my_outdoors_place_unsaved",
  "my_outdoors_visited_toggled",
  "my_outdoors_changes_detected",
  "my_outdoors_changes_seen",
  "my_outdoors_change_opened",
  "my_outdoors_change_verify_opened",
];
const myOutdoorsSignals = {};
for (const eventName of myOutdoorsEventNames) {
  myOutdoorsSignals[eventName] = await aggregateTotalEvent({
    token,
    teamId,
    projectId,
    eventName,
    since,
    until,
  });
}

const payload = {
  version: 1,
  kind: "product-funnel-normalized",
  window: {
    label: `${since} through ${until}`,
    start: since,
    end: until,
  },
  source: {
    type: "vercel-web-analytics-api",
    projectId,
    teamId,
    surface: "location_intent",
    events: [...Object.keys(eventMap), "opportunity_opened", "opportunity_verify_opened", ...myOutdoorsEventNames],
  },
  opportunitySignals,
  myOutdoorsSignals,
  rows: [...byPage.values()].sort((a, b) => a.pageKey.localeCompare(b.pageKey)),
};

const outputPath = path.resolve(output);
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(payload, null, 2) + "\n");

console.log(
  `Vercel product snapshot: ${payload.rows.length} attributed page funnels from ${since} through ${until}`,
);
console.log(`Wrote ${outputPath}`);
