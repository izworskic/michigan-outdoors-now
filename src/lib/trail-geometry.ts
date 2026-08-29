import type { TrailProfile } from "../data/trail-profiles";

export type TrailGeometryFeature = {
  type: "Feature";
  geometry: {
    type: string;
    coordinates: unknown;
  } | null;
  properties: Record<string, unknown>;
};

export type TrailGeometryCollection = {
  type: "FeatureCollection";
  features: TrailGeometryFeature[];
};

export type TrailGeometryResult = {
  profileId: string;
  profileName: string;
  status: "official" | "mapped" | "unavailable";
  sourceLabel: string;
  sourceUrl: string;
  matchedName: string | null;
  segmentCount: number;
  geojson: TrailGeometryCollection;
  routeStart: {
    latitude: number;
    longitude: number;
  } | null;
  caveats: string[];
};

const DNR_TRAIL_SERVICE =
  "https://gisagoegle.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/FeatureServer/21/query";
const NPS_TRAIL_SERVICE =
  "https://mapservices.nps.gov/arcgis/rest/services/NationalDatasets/NPS_Public_Trails_Geographic/FeatureServer/0/query";
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const genericNameTokens = new Set([
  "trail",
  "trails",
  "loop",
  "path",
  "pathway",
  "network",
  "route",
  "hike",
  "hiking",
  "via",
  "the",
  "state",
  "park",
  "system",
  "memorial",
  "point",
]);

function emptyCollection(): TrailGeometryCollection {
  return { type: "FeatureCollection", features: [] };
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b[0-9]+(?:\.[0-9]+)?\s*(?:mi|mile|miles)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(value: string) {
  return normalizeName(value)
    .split(" ")
    .filter((token) => token.length > 2 && !genericNameTokens.has(token));
}

export function trailGeometryNameScore(profileName: string, candidateName: string) {
  const profile = normalizeName(profileName);
  const candidate = normalizeName(candidateName);
  if (!profile || !candidate) return 0;
  if (profile === candidate) return 120;
  if (profile.includes(candidate) || candidate.includes(profile)) return 85;

  const profileTokens = nameTokens(profileName);
  const candidateTokens = new Set(nameTokens(candidateName));
  if (!profileTokens.length || !candidateTokens.size) return 0;
  const overlap = profileTokens.filter((token) => candidateTokens.has(token)).length;
  if (!overlap) return 0;
  const coverage = overlap / Math.max(profileTokens.length, candidateTokens.size);
  return overlap * 16 + Math.round(coverage * 32);
}

function featureName(feature: TrailGeometryFeature, fields: string[]) {
  for (const field of fields) {
    const value = feature.properties?.[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function envelope(latitude: number, longitude: number, radiusDegrees = 0.24) {
  return [
    longitude - radiusDegrees,
    latitude - radiusDegrees,
    longitude + radiusDegrees,
    latitude + radiusDegrees,
  ]
    .map((value) => value.toFixed(5))
    .join(",");
}

async function fetchArcGisGeoJson(
  service: string,
  latitude: number,
  longitude: number,
  where: string,
  outFields: string,
) {
  const params = new URLSearchParams({
    where,
    geometry: envelope(latitude, longitude),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields,
    returnGeometry: "true",
    outSR: "4326",
    geometryPrecision: "5",
    resultRecordCount: "1200",
    f: "geojson",
  });
  const response = await fetch(`${service}?${params}`, {
    headers: { Accept: "application/geo+json, application/json" },
    signal: AbortSignal.timeout(4_500),
    next: { revalidate: 21_600 },
  });
  if (!response.ok) throw new Error(`Trail geometry service returned ${response.status}`);
  const payload = (await response.json()) as Partial<TrailGeometryCollection>;
  if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
    throw new Error("Trail geometry service returned invalid GeoJSON");
  }
  return payload as TrailGeometryCollection;
}

function chooseNamedFeatures(
  collection: TrailGeometryCollection,
  profileName: string,
  fields: string[],
) {
  const ranked = collection.features
    .map((feature) => {
      const name = featureName(feature, fields);
      return { feature, name, score: name ? trailGeometryNameScore(profileName, name) : 0 };
    })
    .filter((candidate) => candidate.name && candidate.score >= 28)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best?.name) return null;
  const target = normalizeName(best.name);
  const selected = ranked
    .filter((candidate) => candidate.name && normalizeName(candidate.name) === target)
    .map((candidate) => candidate.feature);

  return {
    matchedName: best.name,
    score: best.score,
    collection: {
      type: "FeatureCollection" as const,
      features: selected.length ? selected : [best.feature],
    },
  };
}

function firstCoordinate(coordinates: unknown): [number, number] | null {
  if (!Array.isArray(coordinates)) return null;
  if (
    coordinates.length >= 2 &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number" &&
    Number.isFinite(coordinates[0]) &&
    Number.isFinite(coordinates[1])
  ) {
    return [coordinates[0], coordinates[1]];
  }
  for (const child of coordinates) {
    const found = firstCoordinate(child);
    if (found) return found;
  }
  return null;
}

function routeStart(collection: TrailGeometryCollection) {
  for (const feature of collection.features) {
    const coordinate = firstCoordinate(feature.geometry?.coordinates);
    if (coordinate) {
      return { longitude: coordinate[0], latitude: coordinate[1] };
    }
  }
  return null;
}

async function fetchDnrGeometry(
  profile: TrailProfile,
  latitude: number,
  longitude: number,
): Promise<TrailGeometryResult | null> {
  const collection = await fetchArcGisGeoJson(
    DNR_TRAIL_SERVICE,
    latitude,
    longitude,
    "TrailType='Hiking'",
    "OBJECTID,Name,TrailNamePrimary,PRDTrailUnit,SegmentLengthMiles,OpenClosedStatusNonmotor",
  );
  const selected = chooseNamedFeatures(collection, profile.name, ["Name", "TrailNamePrimary"]);
  if (!selected) return null;
  return {
    profileId: profile.id,
    profileName: profile.name,
    status: "official",
    sourceLabel: "Michigan DNR Trails Open Data",
    sourceUrl:
      "https://gisagoegle.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/FeatureServer",
    matchedName: selected.matchedName,
    segmentCount: selected.collection.features.length,
    geojson: selected.collection,
    routeStart: routeStart(selected.collection),
    caveats: [
      "Highlighted geometry comes from Michigan DNR's public hiking-trail layer.",
      profile.routeKind === "network"
        ? "Published network mileage is not converted into a single loop."
        : "Official published mileage remains the distance authority when mapped geometry and published mileage differ.",
    ],
  };
}

async function fetchNpsGeometry(
  profile: TrailProfile,
  latitude: number,
  longitude: number,
): Promise<TrailGeometryResult | null> {
  const collection = await fetchArcGisGeoJson(
    NPS_TRAIL_SERVICE,
    latitude,
    longitude,
    "(PUBLICDISPLAY IS NULL OR PUBLICDISPLAY <> 'No')",
    "OBJECTID,TRLNAME,TRLALTNAME,MAPLABEL,TRLSTATUS,TRLSURFACE,TRLTYPE,TRLUSE,UNITCODE,UNITNAME,OPENTOPUBLIC,SEASONAL,SEASDESC",
  );
  const selected = chooseNamedFeatures(collection, profile.name, ["TRLNAME", "TRLALTNAME", "MAPLABEL"]);
  if (!selected) return null;
  return {
    profileId: profile.id,
    profileName: profile.name,
    status: "official",
    sourceLabel: "National Park Service Public Trails",
    sourceUrl:
      "https://mapservices.nps.gov/arcgis/rest/services/NationalDatasets/NPS_Public_Trails_Geographic/FeatureServer/0",
    matchedName: selected.matchedName,
    segmentCount: selected.collection.features.length,
    geojson: selected.collection,
    routeStart: routeStart(selected.collection),
    caveats: [
      "Highlighted geometry is from the National Park Service public Trails dataset.",
      "Official published mileage remains the distance authority when centerline geometry and published mileage differ.",
    ],
  };
}

type OsmElement = {
  type: "way" | "relation" | "node";
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
  members?: Array<{
    type: "way" | "node" | "relation";
    ref: number;
    role?: string;
    geometry?: Array<{ lat: number; lon: number }>;
  }>;
};

function overpassQuery(latitude: number, longitude: number) {
  const lat = latitude.toFixed(5);
  const lon = longitude.toFixed(5);
  return (
    "[out:json][timeout:12];(" +
    `relation(around:9000,${lat},${lon})["route"~"^(hiking|foot)$"]["name"];` +
    `way(around:9000,${lat},${lon})["highway"~"^(path|footway|track)$"]["name"];` +
    ");out body geom;"
  );
}

function osmFeature(element: OsmElement): TrailGeometryFeature | null {
  const points =
    element.geometry ??
    element.members?.flatMap((member) => member.geometry ?? []) ??
    [];
  if (points.length < 2) return null;
  return {
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: points.map((point) => [point.lon, point.lat]),
    },
    properties: {
      name: element.tags?.name ?? "",
      osmType: element.type,
      osmId: element.id,
    },
  };
}

async function fetchMappedGeometry(
  profile: TrailProfile,
  latitude: number,
  longitude: number,
): Promise<TrailGeometryResult | null> {
  const query = overpassQuery(latitude, longitude);
  const attempts = OVERPASS_ENDPOINTS.map(async (endpoint) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "application/json",
        "User-Agent": "MichiganOutdoorsNow/1.0 (https://michiganoutdoorsnow.chrisizworski.com/)",
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: AbortSignal.timeout(3_200),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Mapped trail geometry unavailable");
    const payload = (await response.json()) as { elements?: OsmElement[] };
    if (!Array.isArray(payload.elements)) throw new Error("Mapped trail geometry missing");
    return payload.elements;
  });

  let elements: OsmElement[];
  try {
    elements = await Promise.any(attempts);
  } catch {
    return null;
  }

  const features = elements
    .map((element) => ({ element, feature: osmFeature(element) }))
    .filter((item): item is { element: OsmElement; feature: TrailGeometryFeature } => Boolean(item.feature))
    .map((item) => ({
      feature: item.feature,
      name: item.element.tags?.name?.trim() ?? "",
      score: trailGeometryNameScore(profile.name, item.element.tags?.name ?? ""),
    }))
    .filter((item) => item.name && item.score >= 30)
    .sort((a, b) => b.score - a.score);

  const best = features[0];
  if (!best) return null;
  const target = normalizeName(best.name);
  const selectedFeatures = features
    .filter((item) => normalizeName(item.name) === target)
    .map((item) => item.feature);
  const collection = {
    type: "FeatureCollection" as const,
    features: selectedFeatures.length ? selectedFeatures : [best.feature],
  };

  return {
    profileId: profile.id,
    profileName: profile.name,
    status: "mapped",
    sourceLabel: "OpenStreetMap contributors",
    sourceUrl: "https://www.openstreetmap.org/",
    matchedName: best.name,
    segmentCount: collection.features.length,
    geojson: collection,
    routeStart: routeStart(collection),
    caveats: [
      "This geometry is a name-matched OpenStreetMap fallback, not an official land-manager centerline.",
      "Use the managing agency's published map and signage as the final route authority.",
    ],
  };
}

export async function fetchTrailGeometry(
  profile: TrailProfile,
  latitude: number,
  longitude: number,
): Promise<TrailGeometryResult> {
  const officialFetcher =
    profile.sourceLabel.includes("Michigan DNR")
      ? fetchDnrGeometry
      : profile.sourceLabel === "National Park Service"
        ? fetchNpsGeometry
        : null;

  if (officialFetcher) {
    try {
      const official = await officialFetcher(profile, latitude, longitude);
      if (official) return official;
    } catch {
      // Continue to an explicitly labeled mapped fallback.
    }
  }

  try {
    const mapped = await fetchMappedGeometry(profile, latitude, longitude);
    if (mapped) return mapped;
  } catch {
    // Return an honest empty state.
  }

  return {
    profileId: profile.id,
    profileName: profile.name,
    status: "unavailable",
    sourceLabel: profile.sourceLabel,
    sourceUrl: profile.sourceUrl,
    matchedName: null,
    segmentCount: 0,
    geojson: emptyCollection(),
    routeStart: null,
    caveats: [
      "No route-specific geometry resolved from the official or mapped sources checked.",
      "Trail Truth still keeps the published mileage and land-manager source; verify the official map before departure.",
    ],
  };
}
