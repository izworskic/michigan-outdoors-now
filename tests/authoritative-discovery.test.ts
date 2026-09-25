import assert from "node:assert/strict";
import test from "node:test";
import {
  authoritativeDiscoverySources,
  buildAuthoritativeQuery,
  federalDiscoverySourceIds,
  padusLocalOpenWhere,
  protectedLandDiscoverySourceIds,
} from "../src/lib/authoritative-discovery";
import {
  categoryFromTags,
  regionalOverpassSelectors,
} from "../src/lib/discovery";

test("regional discovery has multiple official Michigan DNR place families", () => {
  const ids = new Set(authoritativeDiscoverySources.map((source) => source.id));

  assert.ok(ids.has("dnr-parks"));
  assert.ok(ids.has("dnr-wildlife"));
  assert.ok(ids.has("dnr-state-campgrounds"));
  assert.ok(ids.has("dnr-forest-campgrounds"));
  assert.ok(ids.has("dnr-boat-access"));
  assert.ok(ids.has("dnr-fishing-access"));
  assert.ok(authoritativeDiscoverySources.every((source) => source.url.endsWith("/query")));
});

test("authoritative queries are bounded around the requested origin and return WGS84 GeoJSON", () => {
  const url = new URL(
    buildAuthoritativeQuery({
      url: authoritativeDiscoverySources[0].url,
      originLatitude: 42.3314,
      originLongitude: -83.0458,
      maxDriveHours: 2,
    }),
  );

  assert.equal(url.searchParams.get("where"), "1=1");
  assert.equal(url.searchParams.get("f"), "geojson");
  assert.equal(url.searchParams.get("outSR"), "4326");
  assert.equal(url.searchParams.get("inSR"), "4326");
  assert.equal(url.searchParams.get("geometryType"), "esriGeometryEnvelope");
  assert.equal(url.searchParams.get("spatialRel"), "esriSpatialRelIntersects");
  assert.equal(url.searchParams.get("resultRecordCount"), "500");

  const envelope = (url.searchParams.get("geometry") || "").split(",").map(Number);
  assert.equal(envelope.length, 4);
  assert.ok(envelope.every(Number.isFinite));
  assert.ok(envelope[0] < -83.0458 && envelope[2] > -83.0458);
  assert.ok(envelope[1] < 42.3314 && envelope[3] > 42.3314);
});

test("regional OSM enrichment spans high-value outdoor place types without user-supplied selectors", () => {
  const selectors = regionalOverpassSelectors();
  const joined = selectors.join(" ");

  assert.ok(selectors.length >= 12);
  assert.match(joined, /leisure.*park/);
  assert.match(joined, /protected_area/);
  assert.match(joined, /trailhead/);
  assert.match(joined, /slipway/);
  assert.match(joined, /observation_tower/);
  assert.match(joined, /lighthouse/);
  assert.match(joined, /marina/);
  assert.match(joined, /man_made.*pier/);
  assert.match(joined, /harbour/);
  assert.match(joined, /bird_hide/);
  assert.ok(selectors.every((selector) => selector.startsWith("nwr[")));
  assert.ok(selectors.every((selector) => !selector.includes(";")));
});

test("new mapped tags classify into useful existing decision categories", () => {
  assert.equal(categoryFromTags({ man_made: "observation_tower" }), "viewpoint");
  assert.equal(categoryFromTags({ leisure: "slipway" }), "paddling");
  assert.equal(categoryFromTags({ leisure: "marina" }), "paddling");
  assert.equal(categoryFromTags({ man_made: "pier" }), "paddling");
  assert.equal(categoryFromTags({ leisure: "bird_hide" }), "wildlife");
  assert.equal(categoryFromTags({ sport: "fishing" }), "fishing");
  assert.equal(categoryFromTags({ leisure: "park" }), "park");
});


test("federal discovery includes forest trails and wildlife refuge systems", () => {
  const ids = new Set(federalDiscoverySourceIds);
  assert.ok(ids.has("usfs-recreation"));
  assert.ok(ids.has("usfs-trails"));
  assert.ok(ids.has("nps-units"));
  assert.ok(ids.has("fws-refuges"));
});

test("expanded mapped tags classify swimming, lookouts, docks, portages and picnic shelters", () => {
  const selectors = regionalOverpassSelectors().join(" ");
  assert.match(selectors, /swimming_area/);
  assert.match(selectors, /tower:type/);
  assert.match(selectors, /visitor_centre/);
  assert.match(selectors, /canoe_portage/);
  assert.match(selectors, /picnic_shelter/);
  assert.equal(categoryFromTags({ leisure: "swimming_area" }), "beach");
  assert.equal(categoryFromTags({ man_made: "tower", "tower:type": "observation" }), "viewpoint");
  assert.equal(categoryFromTags({ waterway: "dock" }), "paddling");
  assert.equal(categoryFromTags({ waterway: "canoe_portage" }), "paddling");
  assert.equal(categoryFromTags({ amenity: "boat_rental" }), "paddling");
  assert.equal(categoryFromTags({ amenity: "shelter", shelter_type: "picnic_shelter" }), "picnic");
});


test("PAD-US expansion is limited to visitable local/regional/nonprofit fee lands", () => {
  const ids = new Set(protectedLandDiscoverySourceIds);
  assert.ok(ids.has("padus-local-open"));
  assert.match(padusLocalOpenWhere, /State_Nm='MI'/);
  assert.match(padusLocalOpenWhere, /Mang_Type IN \('LOC','DIST','NGO'\)/);
  assert.match(padusLocalOpenWhere, /Pub_Access='OA'/);
  assert.match(padusLocalOpenWhere, /FeatClass='Fee'/);
  assert.doesNotMatch(padusLocalOpenWhere, /PVT/);
  assert.doesNotMatch(padusLocalOpenWhere, /Easement/);
});
