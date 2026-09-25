import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLocalAuthorityQuery,
  localAuthorityDiscoverySourceIds,
} from "../src/lib/local-authority-discovery";

test("local authority expansion includes the first large direct Michigan systems", () => {
  const ids = new Set(localAuthorityDiscoverySourceIds);
  assert.ok(ids.has("hcma-parks"));
  assert.ok(ids.has("oakland-recreation"));
  assert.ok(ids.has("kent-parks"));
  assert.ok(ids.has("kent-trails"));
});

test("local authority GIS queries stay geographically bounded and return WGS84 GeoJSON", () => {
  const url = new URL(
    buildLocalAuthorityQuery({
      url: "https://example.com/FeatureServer/0/query",
      where: "TRAIL_STATUS='Existing'",
      outFields: "OBJECTID,NAME",
      originLatitude: 43.0125,
      originLongitude: -83.6875,
      maxDriveHours: 2,
      resultRecordCount: 800,
    }),
  );

  assert.equal(url.searchParams.get("where"), "TRAIL_STATUS='Existing'");
  assert.equal(url.searchParams.get("outFields"), "OBJECTID,NAME");
  assert.equal(url.searchParams.get("f"), "geojson");
  assert.equal(url.searchParams.get("outSR"), "4326");
  assert.equal(url.searchParams.get("inSR"), "4326");
  assert.equal(url.searchParams.get("geometryType"), "esriGeometryEnvelope");
  assert.equal(url.searchParams.get("spatialRel"), "esriSpatialRelIntersects");
  assert.equal(url.searchParams.get("resultRecordCount"), "800");

  const envelope = (url.searchParams.get("geometry") || "").split(",").map(Number);
  assert.equal(envelope.length, 4);
  assert.ok(envelope.every(Number.isFinite));
  assert.ok(envelope[0] < -83.6875 && envelope[2] > -83.6875);
  assert.ok(envelope[1] < 43.0125 && envelope[3] > 43.0125);
});
