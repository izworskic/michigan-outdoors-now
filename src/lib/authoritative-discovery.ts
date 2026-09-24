import {
  categoryLabel,
  isDiscoveryCandidateInRange,
  scoreDiscoveryCandidate,
  type DiscoveryCategory,
  type DiscoveryIntent,
  type DiscoveryPlace,
} from "./discovery";

const DNR_OPEN_DATA = "https://services3.arcgis.com/Jdnp1TjADvSDxMAX/ArcGIS/rest/services";
const DNR_TRAILS = "https://gisagoegle.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/FeatureServer/21/query";

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

export type AuthoritativeSourceId = (typeof authoritativeDiscoverySources)[number]["id"] | "dnr-trails";

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

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

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
        signal: AbortSignal.timeout(3_200),
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
      signal: AbortSignal.timeout(3_200),
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

export async function fetchAuthoritativeDiscoveryPlaces(args: {
  originLatitude: number;
  originLongitude: number;
  maxDriveHours: number;
  minDriveHours: number;
  intent: DiscoveryIntent;
}): Promise<AuthoritativeDiscoveryState> {
  const results = await Promise.all([
    ...authoritativeDiscoverySources.map((source) => fetchSource(source, args)),
    fetchNearbyTrailSystems(args),
  ]);

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
