import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const port = 3187;
const origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)],
  { env: { ...process.env, NODE_ENV: "production" }, stdio: ["ignore", "pipe", "pipe"] },
);

let output = "";
server.stdout.on("data", (chunk) => { output += chunk.toString(); });
server.stderr.on("data", (chunk) => { output += chunk.toString(); });

async function waitForServer() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Production server stopped early.\n${output}`);
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(500) });
      if (response.ok) return response;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`Production server did not become ready.\n${output}`);
}

try {
  const home = await waitForServer();
  const homeHtml = await home.text();
  assert.match(homeHtml, /Michigan Outdoors Now/);
  assert.match(homeHtml, /Chris Izworski/);
  assert.match(homeHtml, /What kind of Michigan day are you trying to have\?/);
  assert.match(homeHtml, /I want to get outside today/);
  assert.match(homeHtml, /Help me plan this weekend/);
  assert.match(homeHtml, /I already know the place/);
  assert.match(homeHtml, /I know what I want to do/);
  assert.match(homeHtml, /Where are you starting, and how far would you go\?/);
  assert.match(homeHtml, /Starting city or ZIP/);
  assert.match(homeHtml, /Maximum one-way drive/);
  assert.match(homeHtml, /Up to 8 hours/);
  assert.match(homeHtml, /nearby through 8 hours away/);
  assert.doesNotMatch(homeHtml, /Not a shortlist\.|Decision-ready places where the platform can go deeper|Official DNR map layer/);
  assert.doesNotMatch(homeHtml, /michigan-waterfall-conditions|michigan-stargazing-tonight|keweenaw-hiking-conditions|michigan-snowshoe-conditions|great-lakes-freighter-viewing/);
  assert.match(home.headers.get("x-robots-tag") ?? "", /noindex/);
  assert.equal(home.headers.get("x-powered-by"), null);
  assert.equal(home.headers.get("x-frame-options"), "DENY");
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");

  const statewide = await fetch(`${origin}/api/statewide?date=today&mode=best`, {
    signal: AbortSignal.timeout(25_000),
  });
  assert.equal(statewide.status, 200);
  assert.match(statewide.headers.get("x-robots-tag") ?? "", /noindex/);
  const statewidePayload = await statewide.json();
  assert.equal(statewidePayload.mode, "best");
  assert.ok(Array.isArray(statewidePayload.picks));
  if (statewidePayload.conditionsStatus === "live") {
    assert.ok(statewidePayload.picks.length > 0);
    assert.ok(statewidePayload.picks.every((pick) => ["hiking", "scenic", "birding"].includes(pick.activity)));
  }

  const localPage = await fetch(`${origin}/from/bay-city`);
  assert.equal(localPage.status, 200);
  assert.match(await localPage.text(), /Outdoor plans from/);

  const missingPage = await fetch(`${origin}/from/not-a-city`);
  assert.equal(missingPage.status, 404);

  const guidePage = await fetch(`${origin}/ideas/family-day-trips`);
  assert.equal(guidePage.status, 200);
  assert.match(await guidePage.text(), /Michigan Outdoor Day Trips for Families/);

  const missingGuide = await fetch(`${origin}/ideas/not-a-guide`);
  assert.equal(missingGuide.status, 404);

  const explorer = await fetch(`${origin}/explore`);
  assert.equal(explorer.status, 200);
  const explorerHtml = await explorer.text();
  assert.match(explorerHtml, /Explore Michigan outdoors\./);
  assert.match(explorerHtml, /Official DNR trails and access changes/);
  assert.doesNotMatch(explorerHtml, /Not a shortlist\.|numbered pins|result-map-number|Show all 28 places|See all 28 places/);

  const outdoorUniverse = await fetch(`${origin}/api/outdoor-universe?layer=hiking`, {
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(outdoorUniverse.status, 200);
  assert.match(outdoorUniverse.headers.get("x-robots-tag") ?? "", /noindex/);
  const outdoorUniversePayload = await outdoorUniverse.json();
  assert.equal(outdoorUniversePayload.layer, "hiking");
  assert.match(outdoorUniversePayload.source.name, /Michigan DNR Trails Open Data/);
  assert.ok(Array.isArray(outdoorUniversePayload.geojson.features));
  assert.ok(Array.isArray(outdoorUniversePayload.systems));
  if (outdoorUniversePayload.status === "live" && outdoorUniversePayload.systemCount > 0) {
    assert.equal(outdoorUniversePayload.systems.length, outdoorUniversePayload.systemCount);
    assert.ok(
      outdoorUniversePayload.systems.some(
        (system) => Number.isFinite(system.latitude) && Number.isFinite(system.longitude),
      ),
    );
  }
  assert.ok(Number.isInteger(outdoorUniversePayload.pagesFetched));
  assert.ok(outdoorUniversePayload.pagesFetched >= 1 || outdoorUniversePayload.status === "unavailable");
  assert.ok(outdoorUniversePayload.access);
  assert.ok(Number.isInteger(outdoorUniversePayload.access.closureCount));
  assert.ok(Number.isInteger(outdoorUniversePayload.access.rerouteCount));
  assert.ok(Array.isArray(outdoorUniversePayload.access.closures.features));
  assert.ok(Array.isArray(outdoorUniversePayload.access.reroutes.features));

  const placePage = await fetch(`${origin}/places/tawas-point`);
  assert.equal(placePage.status, 200);
  assert.match(await placePage.text(), /Plan a day at/);

  const missingPlace = await fetch(`${origin}/places/not-a-place`);
  assert.equal(missingPlace.status, 404);

  const conditions = await fetch(`${origin}/api/conditions/tawas-point`, {
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(conditions.status, 200);
  assert.match(conditions.headers.get("x-robots-tag") ?? "", /noindex/);
  const conditionsPayload = await conditions.json();
  assert.equal(conditionsPayload.place.id, "tawas-point");

  const llmsFull = await fetch(`${origin}/llms-full.txt`);
  assert.equal(llmsFull.status, 200);
  assert.match(await llmsFull.text(), /expanded reference/);

  const robots = await fetch(`${origin}/robots.txt`);
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Disallow: \//);

  const invalid = await fetch(`${origin}/api/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: "x",
      date: "today",
      maxDriveHours: 8,
      activities: [],
      kids: false,
      dog: false,
      accessible: false,
    }),
  });
  assert.equal(invalid.status, 400);
  assert.match(invalid.headers.get("cache-control") ?? "", /no-store/);
  assert.match(invalid.headers.get("x-robots-tag") ?? "", /noindex/);

  const recommendation = await fetch(`${origin}/api/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: "48708",
      date: "today",
      maxDriveHours: 4,
      activities: ["hiking", "birding"],
      kids: true,
      dog: false,
      accessible: true,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  assert.equal(recommendation.status, 200);
  assert.match(recommendation.headers.get("cache-control") ?? "", /no-store/);
  assert.match(recommendation.headers.get("x-robots-tag") ?? "", /noindex/);
  const payload = await recommendation.json();
  assert.match(payload.origin.name, /Bay City/);
  assert.ok(payload.plans.length > 0 && payload.plans.length <= 3);
  assert.ok(payload.plans.every((plan) => plan.driveHours <= 8.1));
  assert.ok(payload.plans.every((plan) => plan.destination.activities.includes("hiking") || plan.destination.activities.includes("birding")));

  const coordinateRecommendation = await fetch(`${origin}/api/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: "Bay City",
      originCoordinates: { latitude: 43.5945, longitude: -83.8889 },
      date: "today",
      maxDriveHours: 2,
      activities: ["scenic"],
      kids: false,
      dog: false,
      accessible: false,
    }),
    signal: AbortSignal.timeout(25_000),
  });
  assert.equal(coordinateRecommendation.status, 200);
  const coordinatePayload = await coordinateRecommendation.json();
  assert.match(coordinatePayload.origin.name, /Bay City area/);
  assert.ok(coordinatePayload.plans.length > 0);

  console.log(
    `Runtime check passed: persona-first home, paginated DNR outdoor universe with access overlays, explorer, guide, destination, live-condition and local pages; protected 404s; typed and one-tap coordinate planning with inclusive drive-radius filtering; AI reference; and ${payload.conditionsStatus} recommendations.`,
  );
} finally {
  server.kill("SIGTERM");
}
