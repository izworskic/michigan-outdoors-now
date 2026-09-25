from pathlib import Path


def replace_once(path: str, old: str, new: str):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected one match in {path}, found {count}: {old[:140]!r}")
    p.write_text(text.replace(old, new, 1))


def replace_all_expected(path: str, old: str, new: str, expected: int):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"Expected {expected} matches in {path}, found {count}: {old[:140]!r}")
    p.write_text(text.replace(old, new))


replace_once(
    "src/lib/discovery.ts",
    '  source: "OpenStreetMap" | "Michigan Outdoors Now" | "Michigan DNR" | "U.S. Forest Service" | "National Park Service" | "U.S. Fish & Wildlife Service" | "USGS PAD-US" | "Huron-Clinton Metroparks" | "Oakland County" | "Kent County";\n',
    '  source: "OpenStreetMap" | "Michigan Outdoors Now" | "Michigan DNR" | "U.S. Forest Service" | "National Park Service" | "U.S. Fish & Wildlife Service" | "USGS PAD-US" | "Huron-Clinton Metroparks" | "Oakland County" | "Kent County" | "Washtenaw County" | "The Nature Conservancy";\n',
)

replace_once(
    "src/lib/local-authority-discovery.ts",
    '''const KENT_TRAILS =\n  "https://gis.kentcountymi.gov/agisprod/rest/services/OpenData/Transportation_Layers/MapServer/0/query";\n''',
    '''const KENT_TRAILS =\n  "https://gis.kentcountymi.gov/agisprod/rest/services/OpenData/Transportation_Layers/MapServer/0/query";\nconst WASHTENAW_PARKS =\n  "https://services2.arcgis.com/xRI3cTw3hPVoEJP0/ArcGIS/rest/services/WCPARCFacilities_Response/FeatureServer/1/query";\nconst TNC_LANDS =\n  "https://services.arcgis.com/F7DSX1DSNSiWmOqh/ArcGIS/rest/services/TNC_Lands_Public_Layer/FeatureServer/0/query";\n''',
)

replace_once(
    "src/lib/local-authority-discovery.ts",
    '''  "kent-parks",\n  "kent-trails",\n] as const;''',
    '''  "kent-parks",\n  "kent-trails",\n  "washtenaw-parks",\n  "tnc-open-access",\n] as const;''',
)

replace_once(
    "src/lib/local-authority-discovery.ts",
    '''    "Park",\n    "TRAIL_NAME",''',
    '''    "Park",\n    "SHORTNAME",\n    "PUBLIC_NA",\n    "TRAIL_NAME",''',
)

local_insert = r'''
async function fetchWashtenawParks(args: FetchArgs): Promise<LocalAuthorityDiscoveryResult> {
  try {
    const features = await fetchGeoJson(args, {
      url: WASHTENAW_PARKS,
      where: "FEATURECODE IN ('Park','Preserve','Recreation Area','Natural Area')",
      outFields: "OBJECTID,NAME,SHORTNAME,FEATURECODE,AGENCY,response,response_maintenance,response_napp",
      resultRecordCount: 1000,
    });
    const seen = new Set<string>();
    const places: DiscoveryPlace[] = [];
    for (const feature of features) {
      const properties = feature.properties ?? {};
      const center = featureCenter(feature);
      const name = candidateName(properties);
      if (!center || !name) continue;
      const key = normalized(name);
      if (!key || seen.has(key)) continue;
      const featureCode = cleanText(properties.FEATURECODE, 80);
      const agency = cleanText(properties.AGENCY, 100) || "Washtenaw County Parks & Recreation";
      const detailText = [properties.response, properties.response_maintenance, properties.response_napp]
        .map((value) => cleanText(value, 140))
        .join(" ");
      const category = /preserve|natural/i.test(featureCode)
        ? "wildlife"
        : categoryFromText(`${featureCode} ${detailText}`);
      const place = scoredPlace(args, {
        id: `washtenaw:${cleanText(properties.OBJECTID, 50) || sourceKey(name)}`,
        name,
        area: agency,
        center,
        category,
        source: "Washtenaw County",
        sourceUrl: WASHTENAW_PARKS,
        website: "https://www.washtenaw.org/recreation",
        why: `Washtenaw County Parks & Recreation's own GIS identifies this ${featureCode ? featureCode.toLowerCase() : categoryLabel(category).toLowerCase()} in the requested travel range. Check the county site for current hours, facility status and preserve rules.`,
        nameSearchDirections: true,
      });
      if (!place) continue;
      seen.add(key);
      places.push(place);
    }
    return { id: "washtenaw-parks", label: "Washtenaw County parks and preserves", status: "live", places };
  } catch {
    return { id: "washtenaw-parks", label: "Washtenaw County parks and preserves", status: "unavailable", places: [] };
  }
}

async function fetchTncOpenAccess(args: FetchArgs): Promise<LocalAuthorityDiscoveryResult> {
  try {
    const features = await fetchGeoJson(args, {
      url: TNC_LANDS,
      where: "STATE='MI' AND PUB_ACCESS='Open Access' AND PUBLIC_NA IS NOT NULL AND MAP_SYM<>'Transfer'",
      outFields: "OBJECTID,MAP_SYM,PUBLIC_NA,PUB_ACCESS,STATE,FEE_OWNER,GIS_ACRES,DESIGNAT",
      resultRecordCount: 1000,
      timeoutMs: 1_250,
    });
    const seen = new Set<string>();
    const places: DiscoveryPlace[] = [];
    for (const feature of features) {
      const properties = feature.properties ?? {};
      const center = featureCenter(feature);
      const name = candidateName(properties);
      if (!center || !name) continue;
      const key = normalized(name);
      if (!key || seen.has(key)) continue;
      const access = cleanText(properties.PUB_ACCESS, 40);
      if (access !== "Open Access") continue;
      const interest = cleanText(properties.MAP_SYM, 80);
      if (/transfer/i.test(interest)) continue;
      const owner = cleanText(properties.FEE_OWNER, 120) || "The Nature Conservancy";
      const acresRaw = properties.GIS_ACRES;
      const acres = typeof acresRaw === "number" && acresRaw > 0 ? Math.round(acresRaw) : null;
      const place = scoredPlace(args, {
        id: `tnc:${cleanText(properties.OBJECTID, 50) || sourceKey(name)}`,
        name,
        area: owner,
        center,
        category: "wildlife",
        source: "The Nature Conservancy",
        sourceUrl: TNC_LANDS,
        website: "https://www.nature.org/en-us/about-us/where-we-work/united-states/michigan/",
        why: `The Nature Conservancy's public lands dataset explicitly marks this Michigan property as Open Access.${acres ? ` About ${acres.toLocaleString("en-US")} protected acres are mapped.` : ""} Verify preserve-specific hours, trail rules and seasonal restrictions before visiting.`,
        scoreBonus: 10,
        nameSearchDirections: true,
      });
      if (!place) continue;
      seen.add(key);
      places.push(place);
    }
    return { id: "tnc-open-access", label: "The Nature Conservancy Michigan open-access lands", status: "live", places };
  } catch {
    return { id: "tnc-open-access", label: "The Nature Conservancy Michigan open-access lands", status: "unavailable", places: [] };
  }
}

'''

replace_once(
    "src/lib/local-authority-discovery.ts",
    'export async function fetchLocalAuthorityDiscoveryPlaces(args: FetchArgs) {\n',
    local_insert + 'export async function fetchLocalAuthorityDiscoveryPlaces(args: FetchArgs) {\n',
)

replace_once(
    "src/lib/local-authority-discovery.ts",
    '''    fetchKentParks(args),\n    fetchKentTrails(args),\n  ]);''',
    '''    fetchKentParks(args),\n    fetchKentTrails(args),\n    fetchWashtenawParks(args),\n    fetchTncOpenAccess(args),\n  ]);''',
)

replace_all_expected(
    "src/app/api/discover/route.ts",
    'place.source === "Huron-Clinton Metroparks" || place.source === "Oakland County" || place.source === "Kent County"',
    'place.source === "Huron-Clinton Metroparks" || place.source === "Oakland County" || place.source === "Kent County" || place.source === "Washtenaw County" || place.source === "The Nature Conservancy"',
    2,
)

replace_once(
    "src/app/api/discover/route.ts",
    'direct Huron-Clinton Metroparks/Oakland County/Kent County GIS, Michigan Outdoors Now curated places',
    'direct Huron-Clinton Metroparks/Oakland County/Kent County/Washtenaw County GIS, TNC Michigan open-access preserves, Michigan Outdoors Now curated places',
)

replace_all_expected(
    "src/app/api/discover/route.ts",
    'plus direct Huron-Clinton Metroparks, Oakland County and Kent County GIS.',
    'plus direct Huron-Clinton Metroparks, Oakland County, Kent County and Washtenaw County GIS plus TNC Michigan open-access lands.',
    2,
)

replace_once(
    "tests/local-authority-discovery.test.ts",
    'test("local authority expansion includes the first large direct Michigan systems", () => {',
    'test("local authority expansion includes large direct Michigan systems and open-access conservation lands", () => {',
)

replace_once(
    "tests/local-authority-discovery.test.ts",
    '''  assert.ok(ids.has("kent-parks"));\n  assert.ok(ids.has("kent-trails"));''',
    '''  assert.ok(ids.has("kent-parks"));\n  assert.ok(ids.has("kent-trails"));\n  assert.ok(ids.has("washtenaw-parks"));\n  assert.ok(ids.has("tnc-open-access"));''',
)

replace_once(
    "src/lib/place-intelligence.ts",
    '''const OVERPASS_ENDPOINTS = [\n  "https://overpass-api.de/api/interpreter",\n  "https://overpass.kumi.systems/api/interpreter",\n];\n''',
    '''const OVERPASS_ENDPOINTS = [\n  "https://overpass-api.de/api/interpreter",\n  "https://overpass.kumi.systems/api/interpreter",\n];\n\nconst DNR_RECREATION_AMENITIES_SERVICE =\n  "https://services3.arcgis.com/Jdnp1TjADvSDxMAX/arcgis/rest/services/DNRReferenceAssetsOPENDATA/FeatureServer/7/query";\n''',
)

replace_once(
    "src/lib/place-intelligence.ts",
    '''export type AccessIntelligence = {\n  closureCount: number;\n  rerouteCount: number;\n  notes: string[];\n  source: "Michigan DNR Trails Open Data";\n};\n\nexport type PlaceIntelligence = {''',
    '''export type AccessIntelligence = {\n  closureCount: number;\n  rerouteCount: number;\n  notes: string[];\n  source: "Michigan DNR Trails Open Data";\n};\n\nexport type RecreationAmenityIntelligence = {\n  label: string;\n  detail: string | null;\n  condition: string | null;\n  managedBy: string | null;\n  nearestMiles: number;\n};\n\nexport type PlaceIntelligence = {''',
)

replace_once(
    "src/lib/place-intelligence.ts",
    '''  elevation: ElevationIntelligence | null;\n  access: AccessIntelligence;\n  confidenceNote: string;''',
    '''  elevation: ElevationIntelligence | null;\n  access: AccessIntelligence;\n  amenities: RecreationAmenityIntelligence[];\n  confidenceNote: string;''',
)

amenity_fn = r'''
export function summarizeDnrAmenities(
  features: UniverseGeoJsonFeature[],
  latitude: number,
  longitude: number,
): RecreationAmenityIntelligence[] {
  const seen = new Set<string>();
  const items: RecreationAmenityIntelligence[] = [];

  for (const feature of features) {
    const nearestMiles = nearestFeatureMiles(feature, latitude, longitude);
    if (!Number.isFinite(nearestMiles) || nearestMiles > 2.5) continue;
    const properties = feature.properties as unknown as Record<string, unknown>;
    const text = (value: unknown, max = 120) =>
      typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
    const detailType = text(properties.ASSETDETAILTYPE);
    const description = text(properties.DESCRIP, 180);
    const functionName = text(properties.FUNCTION_);
    const assetType = text(properties.ASSETTYPE);
    const label = detailType || description || functionName || assetType;
    if (!label || /^recreation amenity$/i.test(label)) continue;
    const managedBy = text(properties.MAINTBY) || text(properties.ADMINBY) || null;
    const conditionRaw = text(properties.CONDITION);
    const condition = conditionRaw && !/^(unknown|n\/a|none)$/i.test(conditionRaw) ? conditionRaw : null;
    const surface = text(properties.SURFMATERIAL);
    const key = `${label.toLowerCase()}|${managedBy?.toLowerCase() ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      label,
      detail: surface ? `Surface: ${surface}` : description && description !== label ? description : null,
      condition,
      managedBy,
      nearestMiles: Number(nearestMiles.toFixed(1)),
    });
  }

  return items
    .sort((a, b) => a.nearestMiles - b.nearestMiles || a.label.localeCompare(b.label))
    .slice(0, 8);
}

'''

replace_once(
    "src/lib/place-intelligence.ts",
    'function buildOverpassTrailQuery(latitude: number, longitude: number) {\n',
    amenity_fn + 'function buildOverpassTrailQuery(latitude: number, longitude: number) {\n',
)

replace_once(
    "src/lib/place-intelligence.ts",
    '''  const rerouteUrl = buildDnrSpatialQuery(\n    DNR_TRAIL_REROUTES_SERVICE,\n    args.latitude,\n    args.longitude,\n    "1=1",\n    "OBJECTID,TrailNamePrimary,PublicComments,PRDTrailUnit,SegmentLengthMiles",\n  );\n\n  const [weatherResult, trailResult, closureResult, rerouteResult, osmResult] =\n    await Promise.allSettled([\n      fetchPointWeather(args.latitude, args.longitude),\n      fetchGeoJson(trailUrl),\n      fetchGeoJson(closureUrl),\n      fetchGeoJson(rerouteUrl),\n      fetchOsmTrailElements(args.latitude, args.longitude),\n    ]);''',
    '''  const rerouteUrl = buildDnrSpatialQuery(\n    DNR_TRAIL_REROUTES_SERVICE,\n    args.latitude,\n    args.longitude,\n    "1=1",\n    "OBJECTID,TrailNamePrimary,PublicComments,PRDTrailUnit,SegmentLengthMiles",\n  );\n  const amenityUrl = buildDnrSpatialQuery(\n    DNR_RECREATION_AMENITIES_SERVICE,\n    args.latitude,\n    args.longitude,\n    "ASSETTYPE='Recreation Amenity'",\n    "OBJECTID,ASSETTYPE,ASSETDETAILTYPE,DESCRIP,CONDITION,ADMINBY,MAINTBY,FUNCTION_,SURFMATERIAL",\n  );\n\n  const [weatherResult, trailResult, closureResult, rerouteResult, amenityResult, osmResult] =\n    await Promise.allSettled([\n      fetchPointWeather(args.latitude, args.longitude),\n      fetchGeoJson(trailUrl),\n      fetchGeoJson(closureUrl),\n      fetchGeoJson(rerouteUrl),\n      fetchGeoJson(amenityUrl),\n      fetchOsmTrailElements(args.latitude, args.longitude),\n    ]);''',
)

replace_once(
    "src/lib/place-intelligence.ts",
    '''  const reroutes =\n    rerouteResult.status === "fulfilled"\n      ? rerouteResult.value\n      : ({ type: "FeatureCollection", features: [] } as UniverseGeoJson);\n  const osmElements = osmResult.status === "fulfilled" ? osmResult.value : [];''',
    '''  const reroutes =\n    rerouteResult.status === "fulfilled"\n      ? rerouteResult.value\n      : ({ type: "FeatureCollection", features: [] } as UniverseGeoJson);\n  const amenitiesGeoJson =\n    amenityResult.status === "fulfilled"\n      ? amenityResult.value\n      : ({ type: "FeatureCollection", features: [] } as UniverseGeoJson);\n  const osmElements = osmResult.status === "fulfilled" ? osmResult.value : [];''',
)

replace_once(
    "src/lib/place-intelligence.ts",
    '''    elevation,\n    access,\n    confidenceNote:\n      "Current weather, recent rain, daylight and air quality come from Open-Meteo. Nearby official trail and access-change data come from Michigan DNR. Trail Truth resolves the nearest mapped OSM hiking relation when one is available: tagged route distance is strongest, relation-member geometry is the fallback, and sampled ascent is explicitly estimated. Official land-manager maps and notices remain the final source for route choice, closures and seasonal rules.",''',
    '''    elevation,\n    access,\n    amenities: summarizeDnrAmenities(amenitiesGeoJson.features, args.latitude, args.longitude),\n    confidenceNote:\n      "Current weather, recent rain, daylight and air quality come from Open-Meteo. Nearby official trail, access-change and recreation-amenity data come from Michigan DNR. Trail Truth resolves the nearest mapped OSM hiking relation when one is available: tagged route distance is strongest, relation-member geometry is the fallback, and sampled ascent is explicitly estimated. Official land-manager maps and notices remain the final source for route choice, closures, amenity availability and seasonal rules.",''',
)

replace_once(
    "src/components/outdoor-intent-hub.tsx",
    '''                <small>{activeDiscovery.source === "OpenStreetMap" ? "Live mapped place from OpenStreetMap contributors." : "Curated Michigan Outdoors Now destination."}</small>''',
    '''                <small>{activeDiscovery.curatedPlaceId ? "Curated Michigan Outdoors Now destination with full planning depth." : `${activeDiscovery.source} mapped source. Verify current access, hours and local rules before departure.`}</small>''',
)

amenity_card = r'''

                    <article>
                      <span>Official amenities nearby</span>
                      <strong>
                        {placeIntelligence.amenities.length > 0
                          ? placeIntelligence.amenities.slice(0, 3).map((amenity) => amenity.label).join(" · ")
                          : "No DNR recreation amenity points returned nearby"}
                      </strong>
                      <small>
                        {placeIntelligence.amenities.length > 0
                          ? `${placeIntelligence.amenities.length} official DNR asset point${placeIntelligence.amenities.length === 1 ? "" : "s"} within about 2.5 miles.${placeIntelligence.amenities[0].condition ? ` Nearest condition: ${placeIntelligence.amenities[0].condition}.` : " Verify seasonal availability before departure."}`
                          : "Official DNR recreation-asset layer checked within about 2.5 miles."}
                      </small>
                    </article>
'''

replace_once(
    "src/components/outdoor-intent-hub.tsx",
    '''                    {activeTrailProfile && (activeTrailProfile.access || activeTrailheadAction) && (''',
    amenity_card + '''\n                    {activeTrailProfile && (activeTrailProfile.access || activeTrailheadAction) && (''',
)

replace_once(
    "scripts/runtime-check.mjs",
    '''  assert.ok(Number.isInteger(placeIntelligencePayload.access.rerouteCount));\n  assert.match(placeIntelligencePayload.confidenceNote, /Open-Meteo|Michigan DNR/);''',
    '''  assert.ok(Number.isInteger(placeIntelligencePayload.access.rerouteCount));\n  assert.ok(Array.isArray(placeIntelligencePayload.amenities));\n  assert.match(placeIntelligencePayload.confidenceNote, /Open-Meteo|Michigan DNR/);''',
)

Path("tests/recreation-amenities.test.ts").write_text(r'''import assert from "node:assert/strict";
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
  ] as any;

  const amenities = summarizeDnrAmenities(features, 44.3, -84.5);
  assert.equal(amenities.length, 1);
  assert.equal(amenities[0].label, "Vault Toilet");
  assert.equal(amenities[0].condition, "Good");
  assert.equal(amenities[0].managedBy, "Example State Park");
  assert.ok(amenities[0].nearestMiles <= 0.1);
});
''')

print("Conservation, provenance, and DNR amenity expansion applied")
