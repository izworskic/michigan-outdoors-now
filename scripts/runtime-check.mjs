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
  assert.match(homeHtml, /Go find something\./);
  assert.match(homeHtml, /My Outdoors/);
  assert.match(homeHtml, /What are you after\?/);
  assert.match(homeHtml, /Best now/);
  assert.match(homeHtml, /Water/);
  assert.match(homeHtml, /Trail/);
  assert.match(homeHtml, /River/);
  assert.match(homeHtml, /After dark/);
  assert.match(homeHtml, /Long haul/);
  assert.match(homeHtml, /Weekend/);
  assert.match(homeHtml, /Start from a city or ZIP/);
  assert.match(homeHtml, /Use my current location/);
  assert.match(homeHtml, /Drag the map\. Tap anything\./);
  assert.doesNotMatch(homeHtml, /Not a shortlist\.|Decision-ready places where the platform can go deeper|Official DNR map layer/);
  assert.doesNotMatch(homeHtml, /michigan-waterfall-conditions|michigan-stargazing-tonight|keweenaw-hiking-conditions|michigan-snowshoe-conditions|great-lakes-freighter-viewing/);
  assert.match(home.headers.get("x-robots-tag") ?? "", /noindex/);
  assert.equal(home.headers.get("x-powered-by"), null);
  assert.equal(home.headers.get("x-frame-options"), "DENY");
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");

  const typedOrigin = await fetch(`${origin}/api/origin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ origin: "Bay City" }),
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(typedOrigin.status, 200);
  assert.match(typedOrigin.headers.get("cache-control") ?? "", /no-store/);
  const typedOriginPayload = await typedOrigin.json();
  assert.match(typedOriginPayload.origin.name, /Bay City, Michigan/);
  assert.ok(Number.isFinite(typedOriginPayload.origin.latitude));
  assert.ok(Number.isFinite(typedOriginPayload.origin.longitude));

  const discoveryStarted = performance.now();
  const discoveryResponse = await fetch(`${origin}/api/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: typedOriginPayload.origin.name,
      originCoordinates: {
        latitude: typedOriginPayload.origin.latitude,
        longitude: typedOriginPayload.origin.longitude,
      },
      query: "beach and scenic water",
      maxDriveHours: 8,
    }),
    signal: AbortSignal.timeout(5_000),
  });
  const discoveryElapsed = performance.now() - discoveryStarted;
  assert.equal(discoveryResponse.status, 200);
  assert.ok(discoveryElapsed <= 3_000, `discovery exceeded 3 second interaction budget: ${Math.round(discoveryElapsed)}ms`);
  assert.match(discoveryResponse.headers.get("cache-control") ?? "", /no-store/);
  const discoveryPayload = await discoveryResponse.json();
  assert.ok(["live", "fallback"].includes(discoveryPayload.status));
  assert.ok(Array.isArray(discoveryPayload.places));
  assert.ok(discoveryPayload.places.length > 0);
  assert.match(discoveryPayload.origin.name, /Bay City.*area/);
  assert.match(discoveryPayload.intent.summary, /beach|water/i);
  assert.ok(
    discoveryPayload.places.every((place) => ["routed", "estimated"].includes(place.travelSource)),
    "discovery travel provenance is missing",
  );
  const routedPlace = discoveryPayload.places.find((place) => place.travelSource === "routed");
  if (routedPlace) {
    assert.ok(Number.isFinite(routedPlace.driveMinutes));
    assert.ok(routedPlace.driveMinutes > 0);
    assert.match(discoveryPayload.sourceNote, /routed driving times|routed/i);
  }

  const surpriseDiscovery = await fetch(`${origin}/api/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: typedOriginPayload.origin.name,
      originCoordinates: {
        latitude: typedOriginPayload.origin.latitude,
        longitude: typedOriginPayload.origin.longitude,
      },
      query: "wild quiet overlooked outdoor place worth discovering",
      maxDriveHours: 4,
      surpriseMode: true,
    }),
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(surpriseDiscovery.status, 200);
  const surprisePayload = await surpriseDiscovery.json();
  assert.equal(surprisePayload.mode, "surprise");
  assert.ok(Array.isArray(surprisePayload.places));
  assert.ok(surprisePayload.places.length > 0, "Surprise me returned no Michigan possibilities");

  const firstSurpriseId = surprisePayload.places[0].id;
  const surpriseAfterDismiss = await fetch(`${origin}/api/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: typedOriginPayload.origin.name,
      originCoordinates: {
        latitude: typedOriginPayload.origin.latitude,
        longitude: typedOriginPayload.origin.longitude,
      },
      query: "wild quiet overlooked outdoor place worth discovering",
      maxDriveHours: 4,
      surpriseMode: true,
      excludePlaceIds: [firstSurpriseId],
    }),
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(surpriseAfterDismiss.status, 200);
  const surpriseAfterDismissPayload = await surpriseAfterDismiss.json();
  assert.equal(surpriseAfterDismissPayload.mode, "surprise");
  assert.ok(
    surpriseAfterDismissPayload.places.every((place) => place.id !== firstSurpriseId),
    "dismissed surprise place returned again",
  );

  const longHikeDiscovery = await fetch(`${origin}/api/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: typedOriginPayload.origin.name,
      originCoordinates: {
        latitude: typedOriginPayload.origin.latitude,
        longitude: typedOriginPayload.origin.longitude,
      },
      query: "long hike",
      maxDriveHours: 8,
    }),
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(longHikeDiscovery.status, 200);
  const longHikePayload = await longHikeDiscovery.json();
  assert.ok(Array.isArray(longHikePayload.places));
  assert.ok(longHikePayload.places.length > 0, "Bay City long hike search returned no possibilities");
  assert.match(longHikePayload.intent.summary, /trailhead|natural area|viewpoint|waterfall|hiking/i);
  assert.ok(longHikePayload.intent.traits.includes("long"), "long hike effort intent was lost");
  const mappedLongHike = longHikePayload.places.find((place) => place.source === "OpenStreetMap");
  if (mappedLongHike) {
    assert.match(mappedLongHike.why, /exact route length and mileage are not verified/i);
  }

  const confidenceTarget = longHikePayload.places[0];
  const confidenceStarted = performance.now();
  const placeIntelligence = await fetch(`${origin}/api/place-intelligence`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: confidenceTarget.latitude,
      longitude: confidenceTarget.longitude,
    }),
    signal: AbortSignal.timeout(7_000),
  });
  const confidenceElapsed = performance.now() - confidenceStarted;
  assert.equal(placeIntelligence.status, 200);
  assert.ok(confidenceElapsed <= 6_000, `place intelligence exceeded 6 second budget: ${Math.round(confidenceElapsed)}ms`);
  assert.match(placeIntelligence.headers.get("cache-control") ?? "", /no-store/);
  const placeIntelligencePayload = await placeIntelligence.json();
  assert.ok(Array.isArray(placeIntelligencePayload.trailSystems));
  assert.ok(placeIntelligencePayload.access);
  assert.equal(placeIntelligencePayload.access.source, "Michigan DNR Trails Open Data");
  assert.ok(Number.isInteger(placeIntelligencePayload.access.closureCount));
  assert.ok(Number.isInteger(placeIntelligencePayload.access.rerouteCount));
  assert.match(placeIntelligencePayload.confidenceNote, /Open-Meteo|Michigan DNR/);
  assert.ok(["good", "mixed", "poor", "unknown"].includes(placeIntelligencePayload.goSignal?.status));
  if (placeIntelligencePayload.trailTruth) {
    assert.ok(["loop", "point-to-point", "unknown"].includes(placeIntelligencePayload.trailTruth.routeKind));
    assert.ok(["high", "medium", "limited"].includes(placeIntelligencePayload.trailTruth.confidence));
    if (placeIntelligencePayload.trailTruth.distanceMiles !== null) {
      assert.ok(placeIntelligencePayload.trailTruth.distanceMiles > 0);
      assert.ok(["osm-tag", "osm-geometry"].includes(placeIntelligencePayload.trailTruth.distanceSource));
    }
  }

  const dayPlanResponse = await fetch(`${origin}/api/day-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: longHikePayload.origin,
      places: longHikePayload.places.slice(0, 2).map((place) => ({
        id: place.id,
        name: place.name,
        area: place.area,
        latitude: place.latitude,
        longitude: place.longitude,
        category: place.categoryLabel,
      })),
    }),
    signal: AbortSignal.timeout(7_000),
  });
  assert.equal(dayPlanResponse.status, 200);
  assert.match(dayPlanResponse.headers.get("x-robots-tag") ?? "", /noindex/);
  const dayPlanPayload = await dayPlanResponse.json();
  assert.ok(["routed", "estimated"].includes(dayPlanPayload.source));
  assert.equal(dayPlanPayload.stops.length, 2);
  assert.equal(new Set(dayPlanPayload.stops.map((stop) => stop.id)).size, 2);
  assert.equal(dayPlanPayload.legs.length, 2);
  assert.ok(dayPlanPayload.totalDriveMinutes > 0);

  const trailSearchPage = await fetch(`${origin}/hiking/10-mile-hikes-michigan`);
  assert.equal(trailSearchPage.status, 200);
  const trailSearchHtml = await trailSearchPage.text();
  assert.match(trailSearchHtml, /Michigan hikes around 10 miles/);
  assert.match(trailSearchHtml, /Trail Truth standard/);
  assert.match(trailSearchHtml, /National Park Service|Michigan DNR|U\.S\. Forest Service/);

  const growthManifest = await fetch(`${origin}/growth-manifest.json`, {
    signal: AbortSignal.timeout(4_000),
  });
  assert.equal(growthManifest.status, 200);
  assert.match(growthManifest.headers.get("x-robots-tag") ?? "", /noindex/);
  const growthManifestPayload = await growthManifest.json();
  assert.equal(growthManifestPayload.version, "1.0.0");
  assert.equal(growthManifestPayload.owner, "https://chrisizworski.com/#person");
  assert.equal(growthManifestPayload.launch.locationIntentPages, 54);
  assert.equal(growthManifestPayload.launch.trailIntentPages, 6);
  assert.ok(growthManifestPayload.measurement.eventTaxonomy.includes("planner_completed"));
  assert.ok(growthManifestPayload.measurement.eventTaxonomy.includes("day_plan_built"));
  assert.ok(growthManifestPayload.measurement.eventTaxonomy.includes("departure_mode_opened"));
  assert.ok(growthManifestPayload.measurement.eventTaxonomy.includes("opportunity_opened"));
  assert.ok(growthManifestPayload.measurement.eventTaxonomy.includes("my_outdoors_loaded"));
  assert.ok(growthManifestPayload.measurement.eventTaxonomy.includes("my_outdoors_place_saved"));
  assert.ok(growthManifestPayload.measurement.privacy.forbidden.includes("exact coordinates"));

  const preferenceDiscovery = await fetch(`${origin}/api/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: typedOriginPayload.origin.name,
      originCoordinates: {
        latitude: typedOriginPayload.origin.latitude,
        longitude: typedOriginPayload.origin.longitude,
      },
      query: "hiking and scenery",
      maxDriveHours: 8,
      preferences: { kids: true, dog: false, accessible: true },
    }),
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(preferenceDiscovery.status, 200);
  const preferencePayload = await preferenceDiscovery.json();
  assert.match(preferencePayload.sourceNote, /verified household\/access attributes/);
  assert.ok(preferencePayload.places.every((place) => place.source === "Michigan Outdoors Now"));

  const fartherDiscovery = await fetch(`${origin}/api/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: typedOriginPayload.origin.name,
      originCoordinates: {
        latitude: typedOriginPayload.origin.latitude,
        longitude: typedOriginPayload.origin.longitude,
      },
      query: "scenic hiking water",
      minDriveHours: 2,
      maxDriveHours: 8,
    }),
    signal: AbortSignal.timeout(5_000),
  });
  assert.equal(fartherDiscovery.status, 200);
  const fartherPayload = await fartherDiscovery.json();
  assert.ok(Array.isArray(fartherPayload.places));
  assert.ok(fartherPayload.places.length > 0);
  assert.ok(
    fartherPayload.places.every(
      (place) => place.driveHours >= 1.95 && place.driveHours <= 8.05,
    ),
    "farther-band discovery returned a place inside the previous travel range",
  );

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

  const opportunities = await fetch(`${origin}/api/opportunities`, {
    signal: AbortSignal.timeout(25_000),
  });
  assert.equal(opportunities.status, 200);
  assert.match(opportunities.headers.get("x-robots-tag") ?? "", /noindex/);
  const opportunityPayload = await opportunities.json();
  assert.ok(["live", "unavailable"].includes(opportunityPayload.status));
  assert.ok(Array.isArray(opportunityPayload.opportunities));
  assert.ok(Array.isArray(opportunityPayload.checkedDestinationIds));
  assert.match(opportunityPayload.note, /opportun|weather-fit|unavailable/i);
  if (opportunityPayload.status === "live") {
    assert.ok(opportunityPayload.opportunities.length > 0);
    assert.ok(opportunityPayload.opportunities.every((item) => item.score >= 88));
  }

  const allOpportunities = await fetch(`${origin}/api/opportunities?scope=all`, {
    signal: AbortSignal.timeout(25_000),
  });
  assert.equal(allOpportunities.status, 200);
  assert.match(allOpportunities.headers.get("x-robots-tag") ?? "", /noindex/);
  const allOpportunityPayload = await allOpportunities.json();
  assert.ok(["live", "unavailable"].includes(allOpportunityPayload.status));
  assert.ok(Array.isArray(allOpportunityPayload.opportunities));
  assert.ok(Array.isArray(allOpportunityPayload.checkedDestinationIds));
  if (allOpportunityPayload.status === "live") {
    assert.ok(
      allOpportunityPayload.opportunities.length >= opportunityPayload.opportunities.length,
      "full opportunity scope must not return fewer opportunities than the homepage scope",
    );
    assert.match(allOpportunityPayload.note, /return-visit comparison|No user profile/i);
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

  const boatLaunches = await fetch(`${origin}/api/boat-launches`, {
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(boatLaunches.status, 200);
  assert.match(boatLaunches.headers.get("x-robots-tag") ?? "", /noindex/);
  const boatLaunchPayload = await boatLaunches.json();
  assert.ok(["live", "unavailable"].includes(boatLaunchPayload.status));
  assert.ok(Array.isArray(boatLaunchPayload.geojson.features));
  if (boatLaunchPayload.status === "live") {
    assert.equal(boatLaunchPayload.count, boatLaunchPayload.geojson.features.length);
    assert.ok(boatLaunchPayload.count >= 1000);
    assert.match(boatLaunchPayload.note, /source-qualified inventory/);
  } else {
    assert.equal(boatLaunchPayload.count, 0);
    assert.equal(boatLaunchPayload.geojson.features.length, 0);
  }

  const placePage = await fetch(`${origin}/places/tawas-point`);
  assert.equal(placePage.status, 200);
  const placePageHtml = await placePage.text();
  assert.match(placePageHtml, /Plan a day at/);
  assert.match(placePageHtml, /Save to My Outdoors/);
  assert.match(placePageHtml, /Mark as been there/);

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
      maxDriveHours: 8,
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
  assert.ok(payload.plans.every((plan) => ["routed", "estimated"].includes(plan.travelSource)));
  assert.ok(payload.plans.every((plan) => plan.destination.activities.includes("hiking") || plan.destination.activities.includes("birding")));
  assert.ok(Array.isArray(payload.rangeOptions));
  assert.ok(payload.rangeOptions.length >= payload.plans.length);
  assert.ok(payload.rangeOptions.every((option) => option.driveHours <= 8.1));
  assert.ok(payload.rangeOptions.every((option) => option.destination?.id && option.destination?.name));

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
  assert.ok(coordinatePayload.rangeOptions.length > 0);
  assert.ok(coordinatePayload.rangeOptions.every((option) => option.driveHours <= 2.1));

  console.log(
    `Runtime check passed: persistent Michigan map canvas with branching exploration, cumulative drive-hour location bands, paginated DNR outdoor universe with access overlays, clustered statewide boat launches, explorer, guide, destination, live-condition and local pages; protected 404s; typed and one-tap coordinate planning with inclusive drive-radius filtering plus verified farther-only discovery bands; AI reference; and ${payload.conditionsStatus} recommendations.`,
  );
} finally {
  server.kill("SIGTERM");
}
