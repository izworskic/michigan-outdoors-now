import {
  categoryLabel,
  isDiscoveryCandidateInRange,
  scoreDiscoveryCandidate,
  type DiscoveryCategory,
  type DiscoveryIntent,
  type DiscoveryPlace,
} from "./discovery";

const HCMA_PARKS =
  "https://services.arcgis.com/W8lmhbiyq5nrZIV6/ArcGIS/rest/services/Huron_Clinton_Metroparks/FeatureServer/0/query";
const OAKLAND_RECREATION =
  "https://gisservices.oakgov.com/arcgis/rest/services/Enterprise/EnterpriseRecreationDataMapService/MapServer/0/query";
const KENT_PARKS =
  "https://gis.kentcountymi.gov/agisprod/rest/services/BaseMap/MapServer/6/query";
const KENT_TRAILS =
  "https://gis.kentcountymi.gov/agisprod/rest/services/OpenData/Transportation_Layers/MapServer/0/query";
const WASHTENAW_PARKS =
  "https://services2.arcgis.com/xRI3cTw3hPVoEJP0/ArcGIS/rest/services/WCPARCFacilities_Response/FeatureServer/1/query";
const TNC_LANDS =
  "https://services.arcgis.com/F7DSX1DSNSiWmOqh/ArcGIS/rest/services/TNC_Lands_Public_Layer/FeatureServer/0/query";

export const localAuthorityDiscoverySourceIds = [
  "hcma-parks",
  "oakland-recreation",
  "kent-parks",
  "kent-trails",
  "washtenaw-parks",
  "tnc-open-access",
] as const;

export type LocalAuthorityDiscoverySourceId =
  (typeof localAuthorityDiscoverySourceIds)[number];

export type LocalAuthorityDiscoveryResult = {
  id: LocalAuthorityDiscoverySourceId;
  label: string;
  status: "live" | "unavailable";
  places: DiscoveryPlace[];
};

type GeoJsonFeature = {
  type?: string;
  geometry?: { type?: string; coordinates?: unknown } | null;
  properties?: Record<string, unknown> | null;
};

type GeoJsonCollection = {
  type?: string;
  features?: GeoJsonFeature[];
};

type FetchArgs = {
  originLatitude: number;
  originLongitude: number;
  maxDriveHours: number;
  minDriveHours: number;
  intent: DiscoveryIntent;
};

function cleanText(value: unknown, max = 180) {
  return typeof value === "string"
    ? value.replace(/[<>\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : "";
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sourceKey(value: string) {
  return normalized(value).replace(/\s+/g, "-");
}

function coordinateBounds(coordinates: unknown) {
  let minLon = Number.POSITIVE_INFINITY;
  let maxLon = Number.NEGATIVE_INFINITY;
  let minLat = Number.POSITIVE_INFINITY;
  let maxLat = Number.NEGATIVE_INFINITY;

  function visit(value: unknown) {
    if (!Array.isArray(value)) return;
    if (
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number" &&
      Number.isFinite(value[0]) &&
      Number.isFinite(value[1])
    ) {
      minLon = Math.min(minLon, value[0]);
      maxLon = Math.max(maxLon, value[0]);
      minLat = Math.min(minLat, value[1]);
      maxLat = Math.max(maxLat, value[1]);
      return;
    }
    for (const item of value) visit(item);
  }

  visit(coordinates);
  if (![minLon, maxLon, minLat, maxLat].every(Number.isFinite)) return null;
  return { minLon, maxLon, minLat, maxLat };
}

function featureCenter(feature: GeoJsonFeature) {
  const geometry = feature.geometry;
  if (!geometry) return null;
  if (
    geometry.type === "Point" &&
    Array.isArray(geometry.coordinates) &&
    typeof geometry.coordinates[0] === "number" &&
    typeof geometry.coordinates[1] === "number"
  ) {
    return { longitude: geometry.coordinates[0], latitude: geometry.coordinates[1] };
  }
  const bounds = coordinateBounds(geometry.coordinates);
  if (!bounds) return null;
  return {
    longitude: (bounds.minLon + bounds.maxLon) / 2,
    latitude: (bounds.minLat + bounds.maxLat) / 2,
  };
}

function envelopeFor(originLatitude: number, originLongitude: number, maxDriveHours: number) {
  const miles = Math.max(35, Math.min(440, maxDriveHours * 62));
  const latDegrees = miles / 69;
  const lonDegrees = miles / Math.max(32, 69 * Math.cos((originLatitude * Math.PI) / 180));
  return [
    originLongitude - lonDegrees,
    originLatitude - latDegrees,
    originLongitude + lonDegrees,
    originLatitude + latDegrees,
  ];
}

export function buildLocalAuthorityQuery(args: {
  url: string;
  where: string;
  outFields: string;
  originLatitude: number;
  originLongitude: number;
  maxDriveHours: number;
  resultRecordCount?: number;
}) {
  const params = new URLSearchParams({
    where: args.where,
    outFields: args.outFields,
    returnGeometry: "true",
    outSR: "4326",
    inSR: "4326",
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    geometry: envelopeFor(args.originLatitude, args.originLongitude, args.maxDriveHours).join(","),
    resultRecordCount: String(args.resultRecordCount ?? 1000),
    f: "geojson",
  });
  return `${args.url}?${params.toString()}`;
}

async function fetchGeoJson(
  args: FetchArgs,
  config: { url: string; where: string; outFields: string; resultRecordCount?: number; timeoutMs?: number },
) {
  const response = await fetch(
    buildLocalAuthorityQuery({
      ...config,
      originLatitude: args.originLatitude,
      originLongitude: args.originLongitude,
      maxDriveHours: args.maxDriveHours,
    }),
    {
      headers: { Accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(config.timeoutMs ?? 1_100),
      next: { revalidate: 21600 },
    },
  );
  if (!response.ok) throw new Error(`local authority GIS returned ${response.status}`);
  const payload = (await response.json()) as GeoJsonCollection;
  if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
    throw new Error("local authority GIS returned invalid GeoJSON");
  }
  return payload.features;
}

function inRange(center: { latitude: number; longitude: number }, args: FetchArgs) {
  return isDiscoveryCandidateInRange({
    latitude: center.latitude,
    longitude: center.longitude,
    originLatitude: args.originLatitude,
    originLongitude: args.originLongitude,
    maxDriveHours: args.maxDriveHours,
  });
}

function candidateName(properties: Record<string, unknown>) {
  const fields = [
    "NAME",
    "Name",
    "name",
    "ParkName",
    "PARK_NAME",
    "Park",
    "SHORTNAME",
    "PUBLIC_NA",
    "TRAIL_NAME",
    "TrailName",
    "Facility",
    "LOCATION",
    "Location",
  ];
  for (const field of fields) {
    const value = cleanText(properties[field]);
    if (value && !/^(park|trail|unknown|n\/a|none)$/i.test(value)) return value;
  }
  return "";
}

function isYes(value: unknown) {
  const text = cleanText(value, 30).toLowerCase();
  return Boolean(text) && !/^(no|n|none|false|0|n\/a|unknown)$/i.test(text);
}

function safeWebsite(value: unknown) {
  const raw = cleanText(value, 500);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
  } catch {
    return undefined;
  }
  return undefined;
}

function categoryFromText(text: string): DiscoveryCategory {
  const value = text.toLowerCase();
  if (/beach|swim|shore|waterfront/.test(value)) return "beach";
  if (/campground|camping|camp\b/.test(value)) return "campground";
  if (/fish|angl/.test(value)) return "fishing";
  if (/boat|launch|canoe|kayak|paddl|marina/.test(value)) return "paddling";
  if (/trail|greenway|pathway|hike|bike/.test(value)) return "trailhead";
  if (/wildlife|nature|natural area|preserve|marsh|wetland|sanctuary/.test(value)) return "wildlife";
  if (/picnic/.test(value)) return "picnic";
  return "park";
}

function oaklandCategory(properties: Record<string, unknown>, intent: DiscoveryIntent): DiscoveryCategory {
  const agency = cleanText(properties.AGENCY, 80);
  if (/trail lands/i.test(agency)) return "trailhead";
  if (intent.categories.includes("paddling") && isYes(properties.BOATLAUNCH)) return "paddling";
  if (intent.categories.includes("fishing") && isYes(properties.FISHING)) return "fishing";
  if (intent.categories.includes("beach") && isYes(properties.SWIMMING)) return "beach";
  if (intent.categories.includes("campground") && isYes(properties.CAMPING)) return "campground";
  if (intent.categories.includes("trailhead") && isYes(properties.TRAIL)) return "trailhead";
  if (intent.categories.includes("picnic") && isYes(properties.PICNIC)) return "picnic";
  return "park";
}

function oaklandAmenities(properties: Record<string, unknown>) {
  const pairs: Array<[string, unknown]> = [
    ["boat launch", properties.BOATLAUNCH],
    ["camping", properties.CAMPING],
    ["fishing", properties.FISHING],
    ["picnic", properties.PICNIC],
    ["swimming", properties.SWIMMING],
    ["trails", properties.TRAIL],
    ["cross-country skiing", properties.CrossCountySki],
    ["snowmobiling", properties.Snowmobile],
    ["winter fat biking", properties.WinterFatTireBike],
  ];
  return pairs.filter(([, value]) => isYes(value)).map(([label]) => label).slice(0, 5);
}

function scoredPlace(args: FetchArgs, input: {
  id: string;
  name: string;
  area: string;
  center: { latitude: number; longitude: number };
  category: DiscoveryCategory;
  source: DiscoveryPlace["source"];
  sourceUrl: string;
  website?: string;
  why: string;
  scoreBonus?: number;
  nameSearchDirections?: boolean;
}) {
  if (!inRange(input.center, args)) return null;
  const metrics = scoreDiscoveryCandidate({
    latitude: input.center.latitude,
    longitude: input.center.longitude,
    originLatitude: args.originLatitude,
    originLongitude: args.originLongitude,
    maxDriveHours: args.maxDriveHours,
    category: input.category,
    intent: args.intent,
    name: input.name,
    website: input.website,
  });
  if (metrics.driveHours + 0.05 < args.minDriveHours) return null;

  return {
    id: input.id,
    name: input.name,
    area: input.area,
    latitude: input.center.latitude,
    longitude: input.center.longitude,
    category: input.category,
    categoryLabel: categoryLabel(input.category),
    distanceMiles: metrics.distanceMiles,
    driveHours: metrics.driveHours,
    score: Math.min(99, metrics.score + (input.scoreBonus ?? 8)),
    why: input.why,
    source: input.source,
    sourceUrl: input.sourceUrl.replace(/\/query$/, ""),
    directionsUrl: input.nameSearchDirections
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(input.name)}`
      : `https://www.google.com/maps/dir/?api=1&destination=${input.center.latitude.toFixed(6)},${input.center.longitude.toFixed(6)}`,
    ...(input.website ? { website: input.website } : {}),
  } satisfies DiscoveryPlace;
}

async function fetchHcmaParks(args: FetchArgs): Promise<LocalAuthorityDiscoveryResult> {
  try {
    const features = await fetchGeoJson(args, {
      url: HCMA_PARKS,
      where: "1=1",
      outFields: "*",
      resultRecordCount: 500,
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
      const text = Object.values(properties).map((value) => cleanText(value, 100)).join(" ");
      const category = categoryFromText(text);
      const place = scoredPlace(args, {
        id: `hcma:${cleanText(properties.OBJECTID, 50) || sourceKey(name)}`,
        name,
        area: "Huron-Clinton Metroparks",
        center,
        category: category === "park" ? "park" : category,
        source: "Huron-Clinton Metroparks",
        sourceUrl: HCMA_PARKS,
        website: "https://www.metroparks.com/",
        why: `Huron-Clinton Metroparks' own GIS maps this ${categoryLabel(category).toLowerCase()} in the requested travel range. Check the Metroparks site for current hours, closures and seasonal facility status.`,
        nameSearchDirections: true,
      });
      if (!place) continue;
      seen.add(key);
      places.push(place);
    }
    return { id: "hcma-parks", label: "Huron-Clinton Metroparks direct GIS", status: "live", places };
  } catch {
    return { id: "hcma-parks", label: "Huron-Clinton Metroparks direct GIS", status: "unavailable", places: [] };
  }
}

async function fetchOaklandRecreation(args: FetchArgs): Promise<LocalAuthorityDiscoveryResult> {
  try {
    const features = await fetchGeoJson(args, {
      url: OAKLAND_RECREATION,
      where: "AGENCY IN ('County','Municipality','Huron-Clinton Metropolitan Authority','Multi-Jurisdictional Trail Lands')",
      outFields: "OBJECTID,NAME,AGENCY,ACRES,BOATLAUNCH,BOATTYPE,CAMPING,FISHING,HABITAT,HUNTING,INTERPRETIVE,PICNIC,PLAYGROUND,SWIMMING,TRAIL,WEBSITE,EntryFee,CrossCountySki,Snowmobile,WinterFatTireBike,SwimmingType",
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
      const category = oaklandCategory(properties, args.intent);
      const amenities = oaklandAmenities(properties);
      const website = safeWebsite(properties.WEBSITE) ?? "https://www.oakgov.com/community/parks-trails";
      const agency = cleanText(properties.AGENCY, 100) || "Oakland County recreation land";
      const acresRaw = properties.ACRES;
      const acres = typeof acresRaw === "number" && acresRaw > 0 ? Math.round(acresRaw) : null;
      const detail = [
        amenities.length ? `Mapped amenities include ${amenities.join(", ")}.` : "",
        acres ? `About ${acres.toLocaleString("en-US")} acres are mapped.` : "",
      ].filter(Boolean).join(" ");
      const place = scoredPlace(args, {
        id: `oakland:${cleanText(properties.OBJECTID, 50) || sourceKey(name)}`,
        name,
        area: agency,
        center,
        category,
        source: "Oakland County",
        sourceUrl: OAKLAND_RECREATION,
        website,
        why: `Oakland County's recreation GIS identifies this ${categoryLabel(category).toLowerCase()} and provides locally maintained activity attributes.${detail ? ` ${detail}` : ""}`,
        nameSearchDirections: true,
      });
      if (!place) continue;
      seen.add(key);
      places.push(place);
    }
    return { id: "oakland-recreation", label: "Oakland County recreation lands", status: "live", places };
  } catch {
    return { id: "oakland-recreation", label: "Oakland County recreation lands", status: "unavailable", places: [] };
  }
}

async function fetchKentParks(args: FetchArgs): Promise<LocalAuthorityDiscoveryResult> {
  try {
    const features = await fetchGeoJson(args, {
      url: KENT_PARKS,
      where: "1=1",
      outFields: "OBJECTID,SOURCE,JURISDICTION,GOVT_UNIT_NAME,MAINT_RESP,NAME,OWNER,PRIVATE_FLAG,ST_NAME,ST_NUMBER,TYPE,COMMENTS,PARK_AMENITY_NAME,RESERVABLE_FACILITIES,STAFFED_FLAG,PARK_AMENITY_TYPE",
      resultRecordCount: 1000,
    });
    const seen = new Set<string>();
    const places: DiscoveryPlace[] = [];
    for (const feature of features) {
      const properties = feature.properties ?? {};
      const center = featureCenter(feature);
      const name = candidateName(properties);
      const privateFlag = cleanText(properties.PRIVATE_FLAG, 20).toLowerCase();
      if (!center || !name || /^(y|yes|true|1|private)$/.test(privateFlag)) continue;
      const key = normalized(name);
      if (!key || seen.has(key)) continue;
      const text = [properties.TYPE, properties.PARK_AMENITY_NAME, properties.PARK_AMENITY_TYPE, properties.COMMENTS]
        .map((value) => cleanText(value, 120))
        .join(" ");
      const category = categoryFromText(text);
      const manager = cleanText(properties.MAINT_RESP, 100) || cleanText(properties.OWNER, 100) || cleanText(properties.GOVT_UNIT_NAME, 100) || "Kent County";
      const place = scoredPlace(args, {
        id: `kent:park:${cleanText(properties.OBJECTID, 50) || sourceKey(name)}`,
        name,
        area: manager,
        center,
        category,
        source: "Kent County",
        sourceUrl: KENT_PARKS,
        website: "https://kentcountyparks.org/",
        why: `Kent County GIS maps this ${categoryLabel(category).toLowerCase()} and identifies the maintaining or owning public agency. Verify current park hours and facility availability before visiting.`,
        nameSearchDirections: true,
      });
      if (!place) continue;
      seen.add(key);
      places.push(place);
    }
    return { id: "kent-parks", label: "Kent County parks", status: "live", places };
  } catch {
    return { id: "kent-parks", label: "Kent County parks", status: "unavailable", places: [] };
  }
}

async function fetchKentTrails(args: FetchArgs): Promise<LocalAuthorityDiscoveryResult> {
  try {
    const features = await fetchGeoJson(args, {
      url: KENT_TRAILS,
      where: "TRAIL_NAME IS NOT NULL AND TRAIL_STATUS='Existing'",
      outFields: "OBJECTID,JURISDICTION,MAINT_RESP,RESTRICTIONS,SURFACE_TYPE,TRAIL_LENGTH,TRAIL_NAME,TRAIL_OWNER,TRAIL_STATUS,TRAIL_USE,TRAIL_WIDTH,LOCATION,CONDITION",
      resultRecordCount: 1800,
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
      const surface = cleanText(properties.SURFACE_TYPE, 60);
      const use = cleanText(properties.TRAIL_USE, 100);
      const restrictions = cleanText(properties.RESTRICTIONS, 120);
      const manager = cleanText(properties.MAINT_RESP, 100) || cleanText(properties.TRAIL_OWNER, 100) || cleanText(properties.JURISDICTION, 100) || "Kent County";
      const details = [surface ? `Surface: ${surface}.` : "", use ? `Use: ${use}.` : "", restrictions ? `Restrictions: ${restrictions}.` : ""].filter(Boolean).join(" ");
      const place = scoredPlace(args, {
        id: `kent:trail:${cleanText(properties.OBJECTID, 50) || sourceKey(name)}`,
        name,
        area: manager,
        center,
        category: "trailhead",
        source: "Kent County",
        sourceUrl: KENT_TRAILS,
        website: "https://www.kentcountymi.gov/246/Geographic-Information-System-GIS",
        why: `Kent County's maintained trail layer identifies this existing trail and its local manager.${details ? ` ${details}` : ""}`,
        nameSearchDirections: true,
      });
      if (!place) continue;
      seen.add(key);
      places.push(place);
    }
    return { id: "kent-trails", label: "Kent County existing trails", status: "live", places };
  } catch {
    return { id: "kent-trails", label: "Kent County existing trails", status: "unavailable", places: [] };
  }
}


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

export async function fetchLocalAuthorityDiscoveryPlaces(args: FetchArgs) {
  return Promise.all([
    fetchHcmaParks(args),
    fetchOaklandRecreation(args),
    fetchKentParks(args),
    fetchKentTrails(args),
    fetchWashtenawParks(args),
    fetchTncOpenAccess(args),
  ]);
}
