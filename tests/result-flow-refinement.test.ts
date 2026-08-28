import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("semantic results live in a persistent result rail instead of the query stack", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/atlas.css", import.meta.url), "utf8");

  assert.match(hub, /className="canvas-result-dock"/);
  assert.match(hub, /className="canvas-result-rail"/);
  assert.doesNotMatch(hub, /className="canvas-wish-results"/);
  assert.match(hub, /discovery\.places\.map\(\(place, index\) =>/);
  assert.doesNotMatch(hub, /discovery\.places\.slice\(0, 8\)/);
  assert.match(css, /\.canvas-result-dock\{[\s\S]*?position:fixed;[\s\S]*?top:74px;/);
  assert.match(css, /\.canvas-result-rail\{[\s\S]*?overflow-x:auto;[\s\S]*?scroll-snap-type:x proximity;/);
  assert.match(css, /@media\(max-width:700px\)[\s\S]*?\.canvas-result-rail\{[\s\S]*?scroll-snap-type:x mandatory;/);
});

test("opening and closing detail preserves the result dock", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");

  assert.match(hub, /activateDiscovery\(place\.id\)/);
  assert.match(hub, /setFocusPoint\(\{[\s\S]*?latitude: place\.latitude,[\s\S]*?longitude: place\.longitude/);
  assert.match(hub, /canvas-sheet-discovery/);
  assert.match(hub, /aria-label="Close place detail"/);
  assert.match(hub, /placeIntelligenceRequestRef\.current\?\.abort\(\)/);
});

test("Go farther requests only the newly unlocked distance band", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../src/app/api/discover/route.ts", import.meta.url), "utf8");

  assert.match(hub, /const previousMax = driveHours/);
  assert.match(hub, /runDiscovery\(discovery\.query, next, delta > 0 \? previousMax : 0\)/);
  assert.match(hub, /minDriveHours: minDriveOverride/);
  assert.match(route, /minDriveHours\?: number/);
  assert.match(route, /const minDriveHours = Math\.max\(0, body\.minDriveHours \?\? 0\)/);
  assert.match(route, /place\.driveHours \+ 0\.05 >= minDriveHours/);
  assert.match(route, /metrics\.driveHours \+ 0\.05 < args\.minDriveHours/);
});

test("the result UI tells the user whether results are inclusive or farther-only", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");

  assert.match(hub, /Farther-out results/);
  assert.match(hub, /Up to \$\{driveHours\} hr · \$\{discovery\.query\}/);
  assert.match(hub, /Show all within \{driveHours\} hr/);
});

test("discovery detail remains a secondary layer while the result rail stays visible", async () => {
  const css = await readFile(new URL("../src/app/atlas.css", import.meta.url), "utf8");

  assert.match(css, /\.has-active-discovery \.canvas-sheet-discovery\{[\s\S]*?top:224px;/);
  assert.match(css, /@media\(max-width:700px\)[\s\S]*?\.has-active-discovery \.canvas-sheet-discovery\{[\s\S]*?position:fixed;[\s\S]*?top:auto;[\s\S]*?bottom:max\(7px,env\(safe-area-inset-bottom\)\);/);
});


test("mobile search explicitly reveals returned result cards", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/atlas.css", import.meta.url), "utf8");

  assert.match(hub, /const resultDockRef = useRef<HTMLElement \| null>\(null\)/);
  assert.match(hub, /wishInputRef\.current\?\.blur\(\)/);
  assert.match(hub, /resultDockRef\.current\?\.focus\(\{ preventScroll: true \}\)/);
  assert.match(hub, /ref=\{resultDockRef\}/);
  assert.match(hub, />\s*See results\s*<\/button>/);
  assert.match(
    css,
    /@media\(max-width:700px\)[\s\S]*?\.canvas-result-dock\{[\s\S]*?position:fixed;[\s\S]*?z-index:32;[\s\S]*?top:103px;[\s\S]*?bottom:auto;/,
  );
});


test("result-first taste exposes every returned destination and keeps comparison data on the card", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");

  assert.match(hub, /discovery\.places\.map\(\(place, index\) =>/);
  assert.doesNotMatch(hub, /discovery\.places\.slice\(/);
  assert.match(hub, /canvas-result-rank/);
  assert.match(hub, /discoveryDriveLabel\(place\)/);
  assert.match(hub, /\{place\.categoryLabel\}/);
  assert.match(hub, /<p>\{place\.why\}<\/p>/);
});

test("active discovery has continuous previous and next navigation", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");

  assert.match(hub, /function moveDiscoverySelection\(delta: number\)/);
  assert.match(hub, /className="canvas-detail-nav"/);
  assert.match(hub, /moveDiscoverySelection\(-1\)/);
  assert.match(hub, /moveDiscoverySelection\(1\)/);
  assert.match(hub, /scrollIntoView\(\{ behavior: "smooth", block: "nearest", inline: "center" \}\)/);
});


test("users can keep up to three semantic places and compare without losing map continuity", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");

  assert.match(hub, /const \[comparisonPlaces, setComparisonPlaces\] = useState<DiscoveryPlace\[]>\(\[\]\)/);
  assert.match(hub, /if \(comparisonPlaces\.length >= 3\)/);
  assert.match(hub, /Compare \{comparisonPlaces\.length\}/);
  assert.match(hub, /className="canvas-compare"/);
  assert.match(hub, /Compare before you commit\./);
  assert.match(hub, /Full guide/);
  assert.match(hub, /Mapped lead/);
  assert.match(hub, /setCompareOpen\(false\);\s*activateDiscovery\(place\.id\)/);
});

test("semantic cards distinguish routed travel from estimates and planning depth", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");

  assert.match(hub, /place\.travelSource === "routed"/);
  assert.match(hub, /discoveryDriveLabel\(place\)/);
  assert.match(hub, /place\.curatedPlaceId \? "Full guide" : "Mapped lead"/);
  assert.match(hub, /Drive times are routed where the routing service answered inside the fast budget/);
});


test("Go farther preserves the kept comparison set", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");
  const start = hub.indexOf("function changeRange");
  const end = hub.indexOf("function restoreInclusiveDiscovery", start);
  assert.ok(start >= 0 && end > start);
  const rangeBody = hub.slice(start, end);

  assert.match(rangeBody, /runDiscovery\(discovery\.query, next, delta > 0 \? previousMax : 0\)/);
  assert.doesNotMatch(rangeBody, /setComparisonPlaces/);
  assert.doesNotMatch(rangeBody, /setCompareOpen\(false\)/);
});


test("selected semantic places load current trip confidence intelligence", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/atlas.css", import.meta.url), "utf8");

  assert.match(hub, /fetch\("\/api\/place-intelligence"/);
  assert.match(hub, /className="canvas-field-intelligence"/);
  assert.match(hub, /What we know before you leave\./);
  assert.match(hub, /Open-Meteo weather \+ air quality/);
  assert.match(hub, /DNR shows .* mapped mi in the nearby trail window/);
  assert.match(hub, /nearby elevation span/);
  assert.match(hub, /DNR closure item/);
  assert.match(css, /\.canvas-field-intelligence\{/);
});


test("skeptic flow exposes surprise discovery and session-only dismissal", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");

  assert.match(hub, /Surprise me · something I probably don’t know/);
  assert.match(hub, /surpriseMode: true, excludePlaceIds: dismissedDiscoveryIds/);
  assert.match(hub, /function dismissDiscoveryPlace\(place: DiscoveryPlace\)/);
  assert.match(hub, /Not for me/);
  assert.match(hub, /keep that one out of this session’s surprise picks/);
});

test("selected results explain why this choice beats a serious alternative", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");

  assert.match(hub, /function buildDecisionArgument/);
  assert.match(hub, /Why this one over the others\?/);
  assert.match(hub, /driveDeltaMinutes/);
  assert.match(hub, /Choose .* if minimizing windshield time matters more/);
  assert.match(hub, /Show \{decisionArgument\.alternative\.name\} instead/);
});

test("provenance ledger exposes sources freshness and unknowns", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");

  assert.match(hub, /Why should I trust this\?/);
  assert.match(hub, /OSRM road route/);
  assert.match(hub, /Open-Meteo point forecast \+ AQI/);
  assert.match(hub, /Michigan DNR nearby trail, closure and reroute layers/);
  assert.match(hub, /OpenStreetMap contributors/);
  assert.match(hub, /Still unknown/);
});

test("Get me out of here becomes a sparse departure mode", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/atlas.css", import.meta.url), "utf8");

  assert.match(hub, /Get me out of here/);
  assert.match(hub, /className="canvas-departure"/);
  assert.match(hub, /arrive around \{arrivalTimeLabel\(activeDiscovery\)\} if you leave now/);
  assert.match(hub, /Start directions/);
  assert.match(hub, /Source truth/);
  assert.match(css, /\.has-departure \.canvas-topbar,[\s\S]*?visibility:hidden;/);
  assert.match(css, /\.has-departure \.canvas-result-dock/);
  assert.doesNotMatch(hub, /canvas-departure[\s\S]*?you may also like/i);
});


test("Trail Truth resolves route-specific evidence and current go signal in selected detail", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");
  const intelligence = await readFile(new URL("../src/lib/place-intelligence.ts", import.meta.url), "utf8");

  assert.match(hub, />Trail Truth</);
  assert.match(hub, /Should I go\?/);
  assert.match(hub, /trailTruth\.distanceMiles/);
  assert.match(hub, /trailTruth\.ascentFeet/);
  assert.match(intelligence, /way\(r\.routes\)/);
  assert.match(intelligence, /distanceSource/);
  assert.match(intelligence, /sampled-route/);
  assert.match(intelligence, /deriveGoSignal/);
});

test("Decision Board can build a routed multi-stop day without adding another discovery wizard", async () => {
  const hub = await readFile(new URL("../src/components/outdoor-intent-hub.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../src/app/atlas.css", import.meta.url), "utf8");

  assert.match(hub, /async function buildMyDay\(\)/);
  assert.match(hub, /fetch\("\/api\/day-plan"/);
  assert.match(hub, />Build my day</);
  assert.match(hub, /className="canvas-day-plan"/);
  assert.match(hub, /total driving/);
  assert.match(hub, /Reorder the choices/);
  assert.match(css, /\.canvas-day-plan\{/);
});

test("structured planner distinguishes routed road travel from fallback estimates", async () => {
  const planner = await readFile(new URL("../src/components/planner.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../src/app/api/recommendations/route.ts", import.meta.url), "utf8");

  assert.match(route, /fetchRoutedPoints/);
  assert.match(route, /travelSource: "routed"/);
  assert.match(planner, /plan\.travelSource === "routed"/);
  assert.match(planner, /road.*rough/);
  assert.doesNotMatch(planner, /Drive times are rough estimates, not live traffic/);
});
