import {
  categoryLabel,
  isDiscoveryCandidateInRange,
  scoreDiscoveryCandidate,
  type DiscoveryCategory,
  type DiscoveryIntent,
  type DiscoveryPlace,
} from "./discovery";
import {
  fetchLocalAuthorityDiscoveryPlaces,
  localAuthorityDiscoverySourceIds,
} from "./local-authority-discovery";

const DNR_OPEN_DATA = "https://services3.arcgis.com/Jdnp1TjADvSDxMAX/ArcGIS/rest/services";
const DNR_TRAILS = "https://gisagoegle.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/FeatureServer/21/query";
const USFS_RECREATION = "https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_RecreationOpportunities_01/MapServer/0/query";
const NPS_BOUNDARIES = "https://services1.arcgis.com/fBc8EJBxQRMcHlei/ArcGIS/rest/services/National_Park_Service_Boundaries/FeatureServer/0/query";
const USFS_TRAILS = "https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_TrailNFSPublishWithDataStatus_01/MapServer/0/query";
const FWS_BOUNDARIES = "https://services.arcgis.com/QVENGdaPbd4LUkLV/arcgis/rest/services/National_Wildlife_Refuge_System_Boundaries/FeatureServer/0/query";
const PADUS_LOCAL_OPEN = "https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Manager_Type_PADUS/FeatureServer/0/query";

export const authoritativeDiscoverySources = [
  {
    id: "dnr-parks",
    label: "Michigan DNR parks and recreation units",
    url: `${DNR_OPEN_DATA}/DNRManagementBoundariesOPENDATA/FeatureServer/8/query`,
    category: "park" as const,
    nameFields: ["Facility", "EditName", "Name", "name"],
  },
  {
    id: "dnr-wildlife",
    label: "Michigan DNR wildlife lands",
    url: `${DNR_OPEN_DATA}/DNRWILDLandsOPENDATA/FeatureServer/1/query`,
    category: "wildlife" as const,
    nameFields: ["PropertyName", "Facility", "UnitName", "Name", "name"],
  },
  {
    id: "dnr-state-campgrounds",
    label: "Michigan state park campgrounds",
    url: `${DNR_OPEN_DATA}/dnrParksAndRecreation/FeatureServer/2/query`,
    category: "campground" as const,
    nameFields: ["Facility", "Campground", "Name", "name", "Detail"],
  },
  {
    id: "dnr-forest-campgrounds",
    label: "Michigan state forest campgrounds",
    url: `${DNR_OPEN_DATA}/dnrParksAndRecreation/FeatureServer/3/query`,
    category: "campground" as const,
    nameFields: ["Facility", "Campground", "Name", "name", "Detail"],
  },
  {
    id: "dnr-boat-access",
    label: "Michigan DNR boating access sites",
    url: `${DNR_OPEN_DATA}/PRDBASPublicView/FeatureServer/0/query`,
    category: "paddling" as const,
    nameFields: ["name", "LABELNAME", "Name", "Facility", "legacyid"],
  },
  {
    id: "dnr-fishing-access",
    label: "Michigan DNR fishing access sites",
    url: `${DNR_OPEN_DATA}/dnrParksAndRecreation/FeatureServer/0/query`,
    category: "fishing" as const,
    nameFields: ["Name", "name", "Detail", "Facility", "Management"],
  },
] as const;

export const federalDiscoverySourceIds = ["usfs-recreation", "usfs-trails", "nps-units", "fws-refuges"] as const;
export const protectedLandDiscoverySourceIds = ["padus-local-open"] as const;
export const padusLocalOpenWhere = "State_Nm='MI' AND Mang_Type IN ('LOC','DIST','NGO') AND Pub_Access='OA' AND FeatClass='Fee'";

export type AuthoritativeSourceId =
  | (typeof authoritativeDiscoverySources)[number]["id"]
  | "dnr-trails"
  | (typeof federalDiscoverySourceIds)[number]
  | (typeof protectedLandDiscoverySourceIds)[number]
  | (typeof localAuthorityDiscoverySourceIds)[number];

export type AuthoritativeDiscoveryState = {
  places: DiscoveryPlace[];
  sources: Array<{
    id: AuthoritativeSourceId;
    label: string;
    status: "live" | "unavailable";
    count: number;
  }>;
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

type AuthoritativeSourceDefinition = (typeof authoritativeDiscoverySources)[number];

function cleanText(value: unknown, max = 180) {
  return typeof value === "string"
    ? value.replace(/[<>\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
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

export function buildAuthoritativeQuery(args: {
  url: string;
  originLatitude: number;
  originLongitude: number;
  maxDriveHours: number;
  resultRecordCount?: number;
}) {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    returnGeometry: "true",
    outSR: "4326",
    inSR: "4326",
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    geometry: envelopeFor(args.originLatitude, args.originLongitude, args.maxDriveHours).join(","),
    resultRecordCount: String(args.resultRecordCount ?? 500),
    f: "geojson",
  });
  return `${args.url}?${params.toString()}`;
}

function candidateName(properties: Record<string, unknown>, fields: readonly string[]) {
  for (const field of fields) {
    const value = cleanText(properties[field]);
    if (!value) continue;
    if (/^(park|campground|fishing access|access site|boating access|public access|unknown|n\/a)$/i.test(value)) continue;
    return value;
  }

  for (const [key, raw] of Object.entries(properties)) {
    if (!/(name|facility|property|campground|detail)/i.test(key)) continue;
    const value = cleanText(raw);
    if (value && !/^(unknown|n\/a)$/i.test(value)) return value;
  }
  return "";
}

function areaFrom(properties: Record<string, unknown>) {
  const candidates = [
    properties.City,
    properties.city,
    properties.Municipality,
    properties.County,
    properties.COUNTY,
    properties.District,
    properties.PRDTrailUnit,
  ];
  for (const value of candidates) {
    const text = cleanText(value, 100);
    if (text) return text.replace(/\s+County$/i, "");
  }
  return "Michigan";
}

function officialDiscoveryUrl(source: AuthoritativeSourceDefinition) {
  if (source.id === "dnr-boat-access") return "https://www.michigan.gov/dnr/things-to-do/boating/where";
  if (source.id === "dnr-fishing-access") return "https://www.michigan.gov/dnr/things-to-do/fishing/where";
  if (source.id.includes("campground")) return "https://www.michigan.gov/dnr/things-to-do/camping-and-lodging";
  if (source.id === "dnr-wildlife") return "https://www.michigan.gov/dnr/places/state-wildlife-game-areas";
  return "https://www.michigan.gov/dnr/places/state-parks";
}

function placeFromFeature(
  feature: GeoJsonFeature,
  source: AuthoritativeSourceDefinition,
  args: {
    originLatitude: number;
    originLongitude: number;
    maxDriveHours: number;
    minDriveHours: number;
    intent: DiscoveryIntent;
  },
): DiscoveryPlace | null {
  const properties = feature.properties ?? {};
  const center = featureCenter(feature);
  const name = candidateName(properties, source.nameFields);
  if (!center || !name) return null;
  if (
    !isDiscoveryCandidateInRange({
      latitude: center.latitude,
      longitude: center.longitude,
      originLatitude: args.originLatitude,
      originLongitude: args.originLongitude,
      maxDriveHours: args.maxDriveHours,
    })
  ) {
    return null;
  }

  const metrics = scoreDiscoveryCandidate({
    latitude: center.latitude,
    longitude: center.longitude,
    originLatitude: args.originLatitude,
    originLongitude: args.originLongitude,
    maxDriveHours: args.maxDriveHours,
    category: source.category,
    intent: args.intent,
    name,
    website: officialDiscoveryUrl(source),
  });
  if (metrics.driveHours + 0.05 < args.minDriveHours) return null;

  const objectId = cleanText(properties.OBJECTID ?? properties.ObjectID ?? properties.objectid, 40);
  const score = Math.min(99, metrics.score + 6);
  return {
    id: `dnr:${source.id}:${objectId || sourceKey(name)}`,
    name,
    area: areaFrom(properties),
    latitude: center.latitude,
    longitude: center.longitude,
    category: source.category,
    categoryLabel: categoryLabel(source.category),
    distanceMiles: metrics.distanceMiles,
    driveHours: metrics.driveHours,
    score,
    why: `${source.label} places this ${categoryLabel(source.category).toLowerCase()} in the official statewide outdoor inventory.`,
    source: "Michigan DNR",
    sourceUrl: source.url.replace(/\/query$/, ""),
    directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${center.latitude.toFixed(6)},${center.longitude.toFixed(6)}`,
    website: officialDiscoveryUrl(source),
  };
}

async function fetchSource(
  source: AuthoritativeSourceDefinition,
  args: {
    originLatitude: number;
    originLongitude: number;
    maxDriveHours: number;
    minDriveHours: number;
    intent: DiscoveryIntent;
  },
) {
  try {
    const response = await fetch(
      buildAuthoritativeQuery({
        url: source.url,
        originLatitude: args.originLatitude,
        originLongitude: args.originLongitude,
        maxDriveHours: args.maxDriveHours,
      }),
      {
        headers: { Accept: "application/geo+json, application/json" },
        signal: AbortSignal.timeout(1_250),
        next: { revalidate: 1800 },
      },
    );
    if (!response.ok) throw new Error(`${source.id} returned ${response.status}`);
    const payload = (await response.json()) as GeoJsonCollection;
    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
      throw new Error(`${source.id} returned invalid GeoJSON`);
    }
    const seen = new Set<string>();
    const places = payload.features
      .map((feature) => placeFromFeature(feature, source, args))
      .filter((place): place is DiscoveryPlace => place !== null)
      .filter((place) => {
        const key = normalized(place.name);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    return { id: source.id, label: source.label, status: "live" as const, places };
  } catch {
    return { id: source.id, label: source.label, status: "unavailable" as const, places: [] as DiscoveryPlace[] };
  }
}

function firstCoordinate(value: unknown): [number, number] | null {
  if (!Array.isArray(value)) return null;
  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  ) {
    return [value[0], value[1]];
  }
  for (const item of value) {
    const coordinate = firstCoordinate(item);
    if (coordinate) return coordinate;
  }
  return null;
}

function trailCategory(type: string): DiscoveryCategory {
  if (/water/i.test(type)) return "paddling";
  return "trailhead";
}

async function fetchNearbyTrailSystems(args: {
  originLatitude: number;
  originLongitude: number;
  maxDriveHours: number;
  minDriveHours: number;
  intent: DiscoveryIntent;
}) {
  const params = new URLSearchParams({
    where: "TrailType IN ('Hiking','Biking','Water Trail','Skiing','Snowshoe','Railtrail')",
    outFields: "OBJECTID,TrailType,Name,TrailNamePrimary,PRDTrailUnit,SegmentLengthMiles",
    returnGeometry: "true",
    outSR: "4326",
    inSR: "4326",
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    geometry: envelopeFor(args.originLatitude, args.originLongitude, args.maxDriveHours).join(","),
    resultRecordCount: "1200",
    f: "geojson",
  });

  try {
    const response = await fetch(`${DNR_TRAILS}?${params.toString()}`, {
      headers: { Accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(1_250),
      next: { revalidate: 1800 },
    });
    if (!response.ok) throw new Error(`dnr-trails returned ${response.status}`);
    const payload = (await response.json()) as GeoJsonCollection;
    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
      throw new Error("dnr-trails returned invalid GeoJSON");
    }

    const systems = new Map<string, { name: string; type: string; unit: string; coordinate: [number, number] }>();
    for (const feature of payload.features) {
      const properties = feature.properties ?? {};
      const name = cleanText(properties.Name ?? properties.TrailNamePrimary);
      const coordinate = firstCoordinate(feature.geometry?.coordinates);
      if (!name || !coordinate) continue;
      const key = normalized(name);
      if (!key || systems.has(key)) continue;
      systems.set(key, {
        name,
        type: cleanText(properties.TrailType, 80) || "Trail",
        unit: cleanText(properties.PRDTrailUnit, 100),
        coordinate,
      });
    }

    const places: DiscoveryPlace[] = [];
    for (const system of systems.values()) {
      const [longitude, latitude] = system.coordinate;
      if (
        !isDiscoveryCandidateInRange({
          latitude,
          longitude,
          originLatitude: args.originLatitude,
          originLongitude: args.originLongitude,
          maxDriveHours: args.maxDriveHours,
        })
      ) {
        continue;
      }
      const category = trailCategory(system.type);
      const metrics = scoreDiscoveryCandidate({
        latitude,
        longitude,
        originLatitude: args.originLatitude,
        originLongitude: args.originLongitude,
        maxDriveHours: args.maxDriveHours,
        category,
        intent: args.intent,
        name: system.name,
      });
      if (metrics.driveHours + 0.05 < args.minDriveHours) continue;
      places.push({
        id: `dnr:trail:${sourceKey(system.name)}`,
        name: system.name,
        area: system.unit || "Michigan",
        latitude,
        longitude,
        category,
        categoryLabel: categoryLabel(category),
        distanceMiles: metrics.distanceMiles,
        driveHours: metrics.driveHours,
        score: Math.min(99, metrics.score + 5),
        why: `Michigan DNR's official trail layer maps this ${system.type.toLowerCase()} system inside the requested drive range.`,
        source: "Michigan DNR",
        sourceUrl: DNR_TRAILS.replace(/\/query$/, ""),
        directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${latitude.toFixed(6)},${longitude.toFixed(6)}`,
        website: "https://www.michigan.gov/dnr/things-to-do/trails",
      });
    }
    return { id: "dnr-trails" as const, label: "Michigan DNR trail systems", status: "live" as const, places };
  } catch {
    return { id: "dnr-trails" as const, label: "Michigan DNR trail systems", status: "unavailable" as const, places: [] as DiscoveryPlace[] };
  }
}

function safeFederalWebsite(value: unknown) {
  const raw = cleanText(value, 500);
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function usfsCategory(properties: Record<string, unknown>): DiscoveryCategory {
  const text = [
    properties.markeractivity,
    properties.markeractivitygroup,
    properties.markertype,
    properties.recareaname,
  ]
    .map((value) => cleanText(value, 160).toLowerCase())
    .filter(Boolean)
    .join(" ");

  if (/camp|cabins?|overnight/.test(text)) return "campground";
  if (/fish|angling/.test(text)) return "fishing";
  if (/canoe|kayak|boat|paddl|water access|river access|launch/.test(text)) return "paddling";
  if (/beach|swim/.test(text)) return "beach";
  if (/bird|wildlife|watchable wildlife/.test(text)) return "wildlife";
  if (/trail|hiking|backpack|snowshoe|cross.country|ski/.test(text)) return "trailhead";
  if (/lookout|view|scenic/.test(text)) return "viewpoint";
  return "park";
}

async function fetchUsfsRecreation(args: {
  originLatitude: number;
  originLongitude: number;
  maxDriveHours: number;
  minDriveHours: number;
  intent: DiscoveryIntent;
}) {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "objectid,recareaid,recareaname,longitude,latitude,recareaurl,forestname,markertype,markeractivity,markeractivitygroup,openstatus,open_season_start,open_season_end",
    returnGeometry: "true",
    outSR: "4326",
    inSR: "4326",
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    geometry: envelopeFor(args.originLatitude, args.originLongitude, args.maxDriveHours).join(","),
    resultRecordCount: "1400",
    f: "geojson",
  });

  try {
    const response = await fetch(`${USFS_RECREATION}?${params.toString()}`, {
      headers: { Accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(1_250),
      next: { revalidate: 1800 },
    });
    if (!response.ok) throw new Error(`usfs-recreation returned ${response.status}`);
    const payload = (await response.json()) as GeoJsonCollection;
    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
      throw new Error("usfs-recreation returned invalid GeoJSON");
    }

    const seen = new Set<string>();
    const places: DiscoveryPlace[] = [];
    for (const feature of payload.features) {
      const properties = feature.properties ?? {};
      const center = featureCenter(feature);
      const name = cleanText(properties.recareaname, 180);
      if (!center || !name) continue;
      if (!isDiscoveryCandidateInRange({
        latitude: center.latitude,
        longitude: center.longitude,
        originLatitude: args.originLatitude,
        originLongitude: args.originLongitude,
        maxDriveHours: args.maxDriveHours,
      })) continue;

      const openStatus = cleanText(properties.openstatus, 80);
      if (/^closed$/i.test(openStatus) || /temporarily closed/i.test(openStatus)) continue;

      const category = usfsCategory(properties);
      const website = safeFederalWebsite(properties.recareaurl);
      const metrics = scoreDiscoveryCandidate({
        latitude: center.latitude,
        longitude: center.longitude,
        originLatitude: args.originLatitude,
        originLongitude: args.originLongitude,
        maxDriveHours: args.maxDriveHours,
        category,
        intent: args.intent,
        name,
        website,
      });
      if (metrics.driveHours + 0.05 < args.minDriveHours) continue;

      const key = normalized(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const forest = cleanText(properties.forestname, 140) || "U.S. Forest Service";
      const recAreaId = typeof properties.recareaid === "number"
        ? String(properties.recareaid)
        : cleanText(properties.recareaid, 60);
      const objectId = typeof properties.objectid === "number"
        ? String(properties.objectid)
        : cleanText(properties.objectid, 60);
      const statusNote = openStatus ? ` Source status: ${openStatus}.` : "";

      places.push({
        id: `usfs:${recAreaId || objectId || sourceKey(name)}`,
        name,
        area: forest,
        latitude: center.latitude,
        longitude: center.longitude,
        category,
        categoryLabel: categoryLabel(category),
        distanceMiles: metrics.distanceMiles,
        driveHours: metrics.driveHours,
        score: Math.min(99, metrics.score + 7),
        why: `U.S. Forest Service recreation data places this ${categoryLabel(category).toLowerCase()} in ${forest}.${statusNote}`,
        source: "U.S. Forest Service",
        sourceUrl: USFS_RECREATION.replace(/\/query$/, ""),
        directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${center.latitude.toFixed(6)},${center.longitude.toFixed(6)}`,
        ...(website ? { website } : {}),
      });
    }

    return { id: "usfs-recreation" as const, label: "U.S. Forest Service recreation sites", status: "live" as const, places };
  } catch {
    return { id: "usfs-recreation" as const, label: "U.S. Forest Service recreation sites", status: "unavailable" as const, places: [] as DiscoveryPlace[] };
  }
}

async function fetchUsfsTrailSystems(args: {
  originLatitude: number;
  originLongitude: number;
  maxDriveHours: number;
  minDriveHours: number;
  intent: DiscoveryIntent;
}) {
  const params = new URLSearchParams({
    where: "trail_name IS NOT NULL",
    outFields: "objectid,trail_name,trail_type,trail_cn,segment_length,admin_org,managing_org,trail_class,accessibility_status,trail_surface,special_mgmt_area",
    returnGeometry: "true",
    outSR: "4326",
    inSR: "4326",
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    geometry: envelopeFor(args.originLatitude, args.originLongitude, args.maxDriveHours).join(","),
    resultRecordCount: "1800",
    f: "geojson",
  });

  try {
    const response = await fetch(`${USFS_TRAILS}?${params.toString()}`, {
      headers: { Accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(1_100),
      next: { revalidate: 1800 },
    });
    if (!response.ok) throw new Error(`usfs-trails returned ${response.status}`);
    const payload = (await response.json()) as GeoJsonCollection;
    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
      throw new Error("usfs-trails returned invalid GeoJSON");
    }

    const seen = new Set<string>();
    const places: DiscoveryPlace[] = [];
    for (const feature of payload.features) {
      const properties = feature.properties ?? {};
      const center = featureCenter(feature);
      const name = cleanText(properties.trail_name, 180);
      if (!center || !name) continue;
      const key = normalized(name);
      if (!key || seen.has(key)) continue;
      if (!isDiscoveryCandidateInRange({
        latitude: center.latitude,
        longitude: center.longitude,
        originLatitude: args.originLatitude,
        originLongitude: args.originLongitude,
        maxDriveHours: args.maxDriveHours,
      })) continue;

      const category: DiscoveryCategory = "trailhead";
      const metrics = scoreDiscoveryCandidate({
        latitude: center.latitude,
        longitude: center.longitude,
        originLatitude: args.originLatitude,
        originLongitude: args.originLongitude,
        maxDriveHours: args.maxDriveHours,
        category,
        intent: args.intent,
        name,
        website: "https://www.fs.usda.gov/visit/maps",
      });
      if (metrics.driveHours + 0.05 < args.minDriveHours) continue;
      seen.add(key);

      const specialArea = cleanText(properties.special_mgmt_area, 120);
      const surface = cleanText(properties.trail_surface, 80);
      const accessibility = cleanText(properties.accessibility_status, 80);
      const detail = [surface ? `Surface: ${surface}.` : "", accessibility ? `Accessibility: ${accessibility}.` : ""].filter(Boolean).join(" ");
      places.push({
        id: `usfs:trail:${cleanText(properties.trail_cn, 50) || sourceKey(name)}`,
        name,
        area: specialArea || "National Forest System",
        latitude: center.latitude,
        longitude: center.longitude,
        category,
        categoryLabel: categoryLabel(category),
        distanceMiles: metrics.distanceMiles,
        driveHours: metrics.driveHours,
        score: Math.min(99, metrics.score + 6),
        why: `U.S. Forest Service trail data maps this named National Forest System trail inside the requested travel range.${detail ? ` ${detail}` : ""}`,
        source: "U.S. Forest Service",
        sourceUrl: USFS_TRAILS.replace(/\/query$/, ""),
        directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${center.latitude.toFixed(6)},${center.longitude.toFixed(6)}`,
        website: "https://www.fs.usda.gov/visit/maps",
      });
    }

    return { id: "usfs-trails" as const, label: "U.S. Forest Service trail systems", status: "live" as const, places };
  } catch {
    return { id: "usfs-trails" as const, label: "U.S. Forest Service trail systems", status: "unavailable" as const, places: [] as DiscoveryPlace[] };
  }
}

async function fetchFwsRefuges(args: {
  originLatitude: number;
  originLongitude: number;
  maxDriveHours: number;
  minDriveHours: number;
  intent: DiscoveryIntent;
}) {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "OBJECTID,ORGNAME,ORGCODE,LIT,RSL_TYPE,FWSREGION",
    returnGeometry: "true",
    outSR: "4326",
    inSR: "4326",
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    geometry: envelopeFor(args.originLatitude, args.originLongitude, args.maxDriveHours).join(","),
    resultRecordCount: "500",
    f: "geojson",
  });

  try {
    const response = await fetch(`${FWS_BOUNDARIES}?${params.toString()}`, {
      headers: { Accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(1_100),
      next: { revalidate: 21600 },
    });
    if (!response.ok) throw new Error(`fws-refuges returned ${response.status}`);
    const payload = (await response.json()) as GeoJsonCollection;
    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
      throw new Error("fws-refuges returned invalid GeoJSON");
    }

    const seen = new Set<string>();
    const places: DiscoveryPlace[] = [];
    for (const feature of payload.features) {
      const properties = feature.properties ?? {};
      const center = featureCenter(feature);
      const name = cleanText(properties.ORGNAME, 180);
      const type = cleanText(properties.RSL_TYPE, 20).toUpperCase();
      if (!center || !name || type === "AS") continue;
      if (!isDiscoveryCandidateInRange({
        latitude: center.latitude,
        longitude: center.longitude,
        originLatitude: args.originLatitude,
        originLongitude: args.originLongitude,
        maxDriveHours: args.maxDriveHours,
      })) continue;

      const key = normalized(name);
      if (!key || seen.has(key)) continue;
      const category: DiscoveryCategory = /hatchery|fish/i.test(name) ? "fishing" : "wildlife";
      const website = `https://www.fws.gov/search?search=${encodeURIComponent(name)}`;
      const metrics = scoreDiscoveryCandidate({
        latitude: center.latitude,
        longitude: center.longitude,
        originLatitude: args.originLatitude,
        originLongitude: args.originLongitude,
        maxDriveHours: args.maxDriveHours,
        category,
        intent: args.intent,
        name,
        website,
      });
      if (metrics.driveHours + 0.05 < args.minDriveHours) continue;
      seen.add(key);

      const objectId = cleanText(properties.OBJECTID, 40);
      places.push({
        id: `fws:${objectId || sourceKey(name)}`,
        name,
        area: "U.S. Fish & Wildlife Service",
        latitude: center.latitude,
        longitude: center.longitude,
        category,
        categoryLabel: categoryLabel(category),
        distanceMiles: metrics.distanceMiles,
        driveHours: metrics.driveHours,
        score: Math.min(99, metrics.score + 6),
        why: "U.S. Fish & Wildlife Service boundary data identifies this refuge, hatchery or conservation area in the requested travel range. Public access varies by unit, so verify the official unit page before entering.",
        source: "U.S. Fish & Wildlife Service",
        sourceUrl: FWS_BOUNDARIES.replace(/\/query$/, ""),
        directionsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`,
        website,
      });
    }

    return { id: "fws-refuges" as const, label: "U.S. Fish & Wildlife Service refuges and conservation areas", status: "live" as const, places };
  } catch {
    return { id: "fws-refuges" as const, label: "U.S. Fish & Wildlife Service refuges and conservation areas", status: "unavailable" as const, places: [] as DiscoveryPlace[] };
  }
}

function padusCategory(properties: Record<string, unknown>): DiscoveryCategory {
  const text = [
    properties.Unit_Nm,
    properties.Loc_Nm,
    properties.Des_Tp,
    properties.Loc_Ds,
    properties.Loc_Mang,
    properties.Mang_Name,
  ]
    .map((value) => cleanText(value, 180).toLowerCase())
    .filter(Boolean)
    .join(" ");

  if (/beach|swim|shore|waterfront/.test(text)) return "beach";
  if (/campground|camping|camp\b/.test(text)) return "campground";
  if (/trail|greenway|pathway/.test(text)) return "trailhead";
  if (/wildlife|refuge|sanctuary|nature|natural area|preserve|conservation|wetland|marsh|bog|fen|prairie/.test(text)) return "wildlife";
  return "park";
}

function padusManagerLabel(properties: Record<string, unknown>) {
  const localManager = cleanText(properties.Loc_Mang, 120);
  const standardManager = cleanText(properties.Mang_Name, 120);
  const localOwner = cleanText(properties.Loc_Own, 120);
  if (localManager) return localManager;
  if (standardManager && !/^unknown$/i.test(standardManager)) return standardManager;
  if (localOwner) return localOwner;
  const type = cleanText(properties.Mang_Type, 20).toUpperCase();
  if (type === "LOC") return "Local government";
  if (type === "DIST") return "Regional agency / special district";
  if (type === "NGO") return "Nonprofit conservation organization";
  return "Local or nonprofit protected land";
}

async function fetchPadusLocalOpen(args: {
  originLatitude: number;
  originLongitude: number;
  maxDriveHours: number;
  minDriveHours: number;
  intent: DiscoveryIntent;
}) {
  const params = new URLSearchParams({
    where: padusLocalOpenWhere,
    outFields: "OBJECTID,Unit_Nm,Loc_Nm,Loc_Mang,Loc_Own,Mang_Type,Mang_Name,Pub_Access,Access_Src,GIS_Acres,Des_Tp,Loc_Ds,State_Nm,FeatClass",
    returnGeometry: "true",
    outSR: "4326",
    inSR: "4326",
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    geometry: envelopeFor(args.originLatitude, args.originLongitude, args.maxDriveHours).join(","),
    resultRecordCount: "1000",
    f: "geojson",
  });

  try {
    const response = await fetch(`${PADUS_LOCAL_OPEN}?${params.toString()}`, {
      headers: { Accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(1_250),
      next: { revalidate: 21600 },
    });
    if (!response.ok) throw new Error(`padus-local-open returned ${response.status}`);
    const payload = (await response.json()) as GeoJsonCollection;
    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
      throw new Error("padus-local-open returned invalid GeoJSON");
    }

    const seen = new Set<string>();
    const places: DiscoveryPlace[] = [];
    for (const feature of payload.features) {
      const properties = feature.properties ?? {};
      const center = featureCenter(feature);
      const name = cleanText(properties.Unit_Nm ?? properties.Loc_Nm, 180);
      const publicAccess = cleanText(properties.Pub_Access, 20).toUpperCase();
      const featureClass = cleanText(properties.FeatClass, 20).toLowerCase();
      const managerType = cleanText(properties.Mang_Type, 20).toUpperCase();
      if (!center || !name || /^(unknown|n\/a|none)$/i.test(name)) continue;
      if (publicAccess !== "OA" || featureClass !== "fee") continue;
      if (!["LOC", "DIST", "NGO"].includes(managerType)) continue;
      if (!isDiscoveryCandidateInRange({
        latitude: center.latitude,
        longitude: center.longitude,
        originLatitude: args.originLatitude,
        originLongitude: args.originLongitude,
        maxDriveHours: args.maxDriveHours,
      })) continue;

      const key = normalized(name);
      if (!key || seen.has(key)) continue;

      const category = padusCategory(properties);
      const metrics = scoreDiscoveryCandidate({
        latitude: center.latitude,
        longitude: center.longitude,
        originLatitude: args.originLatitude,
        originLongitude: args.originLongitude,
        maxDriveHours: args.maxDriveHours,
        category,
        intent: args.intent,
        name,
        website: "https://www.usgs.gov/programs/gap-analysis-project/science/protected-areas",
      });
      if (metrics.driveHours + 0.05 < args.minDriveHours) continue;
      seen.add(key);

      const manager = padusManagerLabel(properties);
      const acresRaw = properties.GIS_Acres;
      const acres = typeof acresRaw === "number" && Number.isFinite(acresRaw) && acresRaw > 0
        ? Math.round(acresRaw)
        : null;
      const acreageNote = acres ? ` PAD-US maps about ${acres.toLocaleString("en-US")} acres.` : "";
      const objectId = typeof properties.OBJECTID === "number"
        ? String(properties.OBJECTID)
        : cleanText(properties.OBJECTID, 40);

      places.push({
        id: `padus:${objectId || sourceKey(name)}`,
        name,
        area: manager,
        latitude: center.latitude,
        longitude: center.longitude,
        category,
        categoryLabel: categoryLabel(category),
        distanceMiles: metrics.distanceMiles,
        driveHours: metrics.driveHours,
        score: Math.min(99, metrics.score + 5),
        why: `USGS PAD-US 4.1 identifies this as fee-owned, open-access protected land managed by ${manager}.${acreageNote} Local hours, entrances and rules still need a current check before visiting.`,
        source: "USGS PAD-US",
        sourceUrl: PADUS_LOCAL_OPEN.replace(/\/query$/, ""),
        directionsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`,
        website: "https://www.usgs.gov/programs/gap-analysis-project/science/protected-areas",
      });
    }

    return {
      id: "padus-local-open" as const,
      label: "USGS PAD-US local, regional and nonprofit open-access protected lands",
      status: "live" as const,
      places,
    };
  } catch {
    return {
      id: "padus-local-open" as const,
      label: "USGS PAD-US local, regional and nonprofit open-access protected lands",
      status: "unavailable" as const,
      places: [] as DiscoveryPlace[],
    };
  }
}

async function fetchNpsUnits(args: {
  originLatitude: number;
  originLongitude: number;
  maxDriveHours: number;
  minDriveHours: number;
  intent: DiscoveryIntent;
}) {
  const params = new URLSearchParams({
    where: "STATE='MI'",
    outFields: "FID,UNIT_CODE,UNIT_NAME,STATE,UNIT_TYPE,PARKNAME",
    returnGeometry: "true",
    outSR: "4326",
    inSR: "4326",
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    geometry: envelopeFor(args.originLatitude, args.originLongitude, args.maxDriveHours).join(","),
    resultRecordCount: "250",
    f: "geojson",
  });

  try {
    const response = await fetch(`${NPS_BOUNDARIES}?${params.toString()}`, {
      headers: { Accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(1_250),
      next: { revalidate: 21600 },
    });
    if (!response.ok) throw new Error(`nps-units returned ${response.status}`);
    const payload = (await response.json()) as GeoJsonCollection;
    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
      throw new Error("nps-units returned invalid GeoJSON");
    }

    const seen = new Set<string>();
    const places: DiscoveryPlace[] = [];
    for (const feature of payload.features) {
      const properties = feature.properties ?? {};
      const center = featureCenter(feature);
      const name = cleanText(properties.UNIT_NAME ?? properties.PARKNAME, 180);
      if (!center || !name) continue;
      if (!isDiscoveryCandidateInRange({
        latitude: center.latitude,
        longitude: center.longitude,
        originLatitude: args.originLatitude,
        originLongitude: args.originLongitude,
        maxDriveHours: args.maxDriveHours,
      })) continue;

      const category: DiscoveryCategory = "park";
      const unitCode = cleanText(properties.UNIT_CODE, 20).toLowerCase();
      const website = /^[a-z0-9]{4,8}$/.test(unitCode)
        ? `https://www.nps.gov/${unitCode}/index.htm`
        : "https://www.nps.gov/state/mi/index.htm";
      const metrics = scoreDiscoveryCandidate({
        latitude: center.latitude,
        longitude: center.longitude,
        originLatitude: args.originLatitude,
        originLongitude: args.originLongitude,
        maxDriveHours: args.maxDriveHours,
        category,
        intent: args.intent,
        name,
        website,
      });
      if (metrics.driveHours + 0.05 < args.minDriveHours) continue;

      const key = normalized(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);

      const unitType = cleanText(properties.UNIT_TYPE, 100) || "National Park Service";
      const fid = typeof properties.FID === "number" ? String(properties.FID) : cleanText(properties.FID, 40);
      places.push({
        id: `nps:${unitCode || fid || sourceKey(name)}`,
        name,
        area: unitType,
        latitude: center.latitude,
        longitude: center.longitude,
        category,
        categoryLabel: categoryLabel(category),
        distanceMiles: metrics.distanceMiles,
        driveHours: metrics.driveHours,
        score: Math.min(99, metrics.score + 7),
        why: `National Park Service boundary data places this federal outdoor unit inside the requested Michigan travel range.`,
        source: "National Park Service",
        sourceUrl: NPS_BOUNDARIES.replace(/\/query$/, ""),
        directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${center.latitude.toFixed(6)},${center.longitude.toFixed(6)}`,
        website,
      });
    }

    return { id: "nps-units" as const, label: "National Park Service units", status: "live" as const, places };
  } catch {
    return { id: "nps-units" as const, label: "National Park Service units", status: "unavailable" as const, places: [] as DiscoveryPlace[] };
  }
}

export async function fetchAuthoritativeDiscoveryPlaces(args: {
  originLatitude: number;
  originLongitude: number;
  maxDriveHours: number;
  minDriveHours: number;
  intent: DiscoveryIntent;
}): Promise<AuthoritativeDiscoveryState> {
  const [coreResults, localAuthorityResults] = await Promise.all([
    Promise.all([
      ...authoritativeDiscoverySources.map((source) => fetchSource(source, args)),
      fetchNearbyTrailSystems(args),
      fetchUsfsRecreation(args),
      fetchUsfsTrailSystems(args),
      fetchNpsUnits(args),
      fetchFwsRefuges(args),
      fetchPadusLocalOpen(args),
    ]),
    fetchLocalAuthorityDiscoveryPlaces(args),
  ]);
  const results = [...coreResults, ...localAuthorityResults];

  return {
    places: results.flatMap((result) => result.places),
    sources: results.map((result) => ({
      id: result.id,
      label: result.label,
      status: result.status,
      count: result.places.length,
    })),
  };
}
