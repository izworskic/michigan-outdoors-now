import assert from "node:assert/strict";
import test from "node:test";
import { summarizeDnrAmenities } from "../src/lib/place-intelligence";

test("DNR recreation amenities become bounded trip-context instead of destination clutter", () => {
  const features = [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-84.5000, 44.3000] },
      properties: {
        ASSETTYPE: "Recreation Amenity",
        ASSETDETAILTYPE: "Vault Toilet",
        CONDITION: "Good",
        MAINTBY: "Example State Park",
        SURFMATERIAL: "Concrete",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-84.5001, 44.3001] },
      properties: {
        ASSETTYPE: "Recreation Amenity",
        ASSETDETAILTYPE: "Vault Toilet",
        CONDITION: "Good",
        MAINTBY: "Example State Park",
      },
    },
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [-85.2, 45.0] },
      properties: {
        ASSETTYPE: "Recreation Amenity",
        ASSETDETAILTYPE: "Parking Area",
      },
    },
  ] as unknown as import("../src/lib/outdoor-universe").UniverseGeoJsonFeature[];

  const amenities = summarizeDnrAmenities(features, 44.3, -84.5);
  assert.equal(amenities.length, 1);
  assert.equal(amenities[0].label, "Vault Toilet");
  assert.equal(amenities[0].condition, "Good");
  assert.equal(amenities[0].managedBy, "Example State Park");
  assert.ok(amenities[0].nearestMiles <= 0.1);
});
