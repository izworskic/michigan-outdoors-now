export const universeLayerIds = [
  "hiking",
  "biking",
  "water",
  "skiing",
  "snowshoe",
  "orv",
  "snowmobile",
  "railtrail",
] as const;

export type UniverseLayerId = (typeof universeLayerIds)[number];

export const universeLayerLabels: Record<UniverseLayerId, string> = {
  hiking: "Hiking trails",
  biking: "Biking trails",
  water: "Water trails",
  skiing: "Cross-country ski trails",
  snowshoe: "Snowshoe trails",
  orv: "ORV trails",
  snowmobile: "Snowmobile trails",
  railtrail: "Rail trails",
};

const trailWhere: Record<UniverseLayerId, string> = {
  hiking: "TrailType='Hiking'",
  biking: "TrailType='Biking'",
  water: "TrailType='Water Trail'",
  skiing: "TrailType='Skiing'",
  snowshoe: "TrailType='Snowshoe'",
  orv: "TrailType IN ('ORV Route','ORV Trail','Motorcycle Trail','MCCCT')",
  snowmobile: "TrailType='Snowmobile'",
  railtrail: "TrailType='Railtrail'",
};

const accessWhere: Record<UniverseLayerId, string> = {
  hiking: "Hiking IS NOT NULL AND Hiking <> 'No'",
  biking: "Biking IS NOT NULL AND Biking <> 'No'",
  water: "WaterTrail IS NOT NULL AND WaterTrail <> 'No'",
  skiing: "Skiing IS NOT NULL AND Skiing <> 'No'",
  snowshoe: "Snowshoe IS NOT NULL AND Snowshoe <> 'No'",
  orv: "((ORVRoute IS NOT NULL AND ORVRoute <> 'No') OR (ATVTrail IS NOT NULL AND ATVTrail <> 'No') OR (Motorcycle IS NOT NULL AND Motorcycle <> 'No'))",
  snowmobile: "Snowmobile IS NOT NULL AND Snowmobile <> 'No'",
  railtrail: "RailtrailType IN ('Railtrail','Rail With Trail')",
};

const DNR_TRAIL_ROOT =
  "https://gisagoegle.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/FeatureServer";

export const DNR_TRAIL_SERVICE = `${DNR_TRAIL_ROOT}/21/query`;
export const DNR_TRAIL_CLOSURES_SERVICE = `${DNR_TRAIL_ROOT}/0/query`;
export const DNR_TRAIL_REROUTES_SERVICE = `${DNR_TRAIL_ROOT}/1/query`;

const PAGE_SIZE = 2000;
const MAX_TRAIL_PAGES = 12;
const MAX_ACCESS_PAGES = 4;

export type UniverseTrailProperties = {
  OBJECTID?: number;
  TrailType?: string | null;
  Name?: string | null;
  TrailNamePrimary?: string | null;
  PRDTrailUnit?: string | null;
  RecreationSearchFacilityID?: string | null;
  RecreationSearchTrailID?: string | null;
  SegmentLengthMiles?: number | null;
  SpecialRestrictionType?: string | null;
  SpecialDesignation?: string | null;
  PublicComments?: string | null;
  OpenClosedStatusNonmotor?: string | null;
  OpenClosedStatusORV?: string | null;
  OpenClosedStatusSnowmobile?: string | null;
  Hiking?: string | null;
  Biking?: string | null;
  Skiing?: string | null;
  Snowshoe?: string | null;
  WaterTrail?: string | null;
  ORVRoute?: string | null;
  ATVTrail?: string | null;
  Motorcycle?: string | null;
  Snowmobile?: string | null;
  RailtrailType?: string | null;
};

export type UniverseGeoJsonFeature = {
  type: "Feature";
  geometry: {
    type: string;
    coordinates: unknown;
  } | null;
  properties: UniverseTrailProperties;
};

export type UniverseGeoJson = {
  type: "FeatureCollection";
  features: UniverseGeoJsonFeature[];
};

export type UniverseTrailSystem = {
  name: string;
  type: string;
  unit: string | null;
  miles: number;
  segments: number;
  longitude: number | null;
  latitude: number | null;
};

export type UniverseAccessState = {
  status: "live" | "partial" | "unavailable";
  closureCount: number;
  rerouteCount: number;
  closures: UniverseGeoJson;
  reroutes: UniverseGeoJson;
  partial: boolean;
  note: string;
};

export type OutdoorUniverseResponse = {
  layer: UniverseLayerId;
  label: string;
  status: "live" | "unavailable";
  fetchedAt: string;
  source: {
    name: string;
    url: string;
    authority: "Michigan Department of Natural Resources";
  };
  featureCount: number;
  systemCount: number;
  miles: number;
  partial: boolean;
  pagesFetched: number;
  geojson: UniverseGeoJson;
  systems: UniverseTrailSystem[];
  access: UniverseAccessState;
  note: string;
};

type PagedGeoJson = {
  collection: UniverseGeoJson;
  partial: boolean;
  pagesFetched: number;
};

export function isUniverseLayerId(value: string): value is UniverseLayerId {
  return universeLayerIds.includes(value as UniverseLayerId);
}

function buildArcGisQuery(
  service: string,
  where: string,
  outFields: string,
  offset = 0,
) {
  const params = new URLSearchParams({
    where,
    outFields,
    returnGeometry: "true",
    outSR: "4326",
    geometryPrecision: "5",
    resultRecordCount: String(PAGE_SIZE),
    resultOffset: String(offset),
    orderByFields: "OBJECTID ASC",
    f: "geojson",
  });
  return `${service}?${params.toString()}`;
}

export function buildDnrTrailQuery(layer: UniverseLayerId, offset = 0) {
  return buildArcGisQuery(
    DNR_TRAIL_SERVICE,
    trailWhere[layer],
    "OBJECTID,TrailType,Name,TrailNamePrimary,PRDTrailUnit,RecreationSearchFacilityID,RecreationSearchTrailID,SegmentLengthMiles,SpecialRestrictionType,SpecialDesignation",
    offset,
  );
}

export function buildDnrAccessQuery(
  kind: "closures" | "reroutes",
  layer: UniverseLayerId,
  offset = 0,
) {
  const service = kind === "closures" ? DNR_TRAIL_CLOSURES_SERVICE : DNR_TRAIL_REROUTES_SERVICE;
  return buildArcGisQuery(
    service,
    accessWhere[layer],
    "OBJECTID,TrailNamePrimary,PublicComments,PRDTrailUnit,SegmentLengthMiles,OpenClosedStatusNonmotor,OpenClosedStatusORV,OpenClosedStatusSnowmobile,Hiking,Biking,Skiing,Snowshoe,WaterTrail,ORVRoute,ATVTrail,Motorcycle,Snowmobile,RailtrailType",
    offset,
  );
}

function trailName(feature: UniverseGeoJsonFeature) {
  const properties = feature.properties ?? {};
  const value = properties.Name || properties.TrailNamePrimary;
  return typeof value === "string" && value.trim() ? value.trim() : "Unnamed DNR trail segment";
}

function trailMiles(feature: UniverseGeoJsonFeature) {
  const value = feature.properties?.SegmentLengthMiles;
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, value) : 0;
}

type TrailSystemAccumulator = UniverseTrailSystem & {
  minLongitude: number | null;
  maxLongitude: number | null;
  minLatitude: number | null;
  maxLatitude: number | null;
};

type CoordinateBounds = {
  minLongitude: number;
  maxLongitude: number;
  minLatitude: number;
  maxLatitude: number;
};

function coordinateBounds(coordinates: unknown): CoordinateBounds | null {
  const bounds: CoordinateBounds = {
    minLongitude: Number.POSITIVE_INFINITY,
    maxLongitude: Number.NEGATIVE_INFINITY,
    minLatitude: Number.POSITIVE_INFINITY,
    maxLatitude: Number.NEGATIVE_INFINITY,
  };

  function visit(value: unknown) {
    if (!Array.isArray(value)) return;
    if (
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number" &&
      Number.isFinite(value[0]) &&
      Number.isFinite(value[1])
    ) {
      bounds.minLongitude = Math.min(bounds.minLongitude, value[0]);
      bounds.maxLongitude = Math.max(bounds.maxLongitude, value[0]);
      bounds.minLatitude = Math.min(bounds.minLatitude, value[1]);
      bounds.maxLatitude = Math.max(bounds.maxLatitude, value[1]);
      return;
    }
    for (const item of value) visit(item);
  }

  visit(coordinates);
  return Number.isFinite(bounds.minLongitude) &&
    Number.isFinite(bounds.maxLongitude) &&
    Number.isFinite(bounds.minLatitude) &&
    Number.isFinite(bounds.maxLatitude)
    ? bounds
    : null;
}

function coordinateAnchor(coordinates: unknown): [number, number] | null {
  let anchor: [number, number] | null = null;

  function visit(value: unknown) {
    if (anchor || !Array.isArray(value)) return;
    if (
      value.length >= 2 &&
      typeof value[0] === "number" &&
      typeof value[1] === "number" &&
      Number.isFinite(value[0]) &&
      Number.isFinite(value[1])
    ) {
      anchor = [value[0], value[1]];
      return;
    }
    for (const item of value) visit(item);
  }

  visit(coordinates);
  return anchor;
}

function mergeBounds(existing: TrailSystemAccumulator, bounds: CoordinateBounds | null) {
  if (!bounds) return;
  existing.minLongitude = existing.minLongitude === null
    ? bounds.minLongitude
    : Math.min(existing.minLongitude, bounds.minLongitude);
  existing.maxLongitude = existing.maxLongitude === null
    ? bounds.maxLongitude
    : Math.max(existing.maxLongitude, bounds.maxLongitude);
  existing.minLatitude = existing.minLatitude === null
    ? bounds.minLatitude
    : Math.min(existing.minLatitude, bounds.minLatitude);
  existing.maxLatitude = existing.maxLatitude === null
    ? bounds.maxLatitude
    : Math.max(existing.maxLatitude, bounds.maxLatitude);
}

export function summarizeTrailSystems(collection: UniverseGeoJson) {
  const grouped = new Map<string, TrailSystemAccumulator>();
  for (const feature of collection.features) {
    const name = trailName(feature);
    const existing = grouped.get(name);
    const type = feature.properties?.TrailType || "Trail";
    const unit = feature.properties?.PRDTrailUnit || null;
    const bounds = coordinateBounds(feature.geometry?.coordinates);
    const anchor = coordinateAnchor(feature.geometry?.coordinates);

    if (existing) {
      existing.segments += 1;
      existing.miles += trailMiles(feature);
      mergeBounds(existing, bounds);
    } else {
      const system: TrailSystemAccumulator = {
        name,
        type,
        unit,
        miles: trailMiles(feature),
        segments: 1,
        longitude: anchor ? Number(anchor[0].toFixed(5)) : null,
        latitude: anchor ? Number(anchor[1].toFixed(5)) : null,
        minLongitude: null,
        maxLongitude: null,
        minLatitude: null,
        maxLatitude: null,
      };
      mergeBounds(system, bounds);
      grouped.set(name, system);
    }
  }

  return [...grouped.values()]
    .map((system): UniverseTrailSystem => ({
      name: system.name,
      type: system.type,
      unit: system.unit,
      miles: Number(system.miles.toFixed(1)),
      segments: system.segments,
      longitude: system.longitude,
      latitude: system.latitude,
    }))
    .sort((a, b) => b.miles - a.miles || a.name.localeCompare(b.name));
}

async function fetchGeoJsonPages(
  queryForOffset: (offset: number) => string,
  maxPages: number,
): Promise<PagedGeoJson> {
  const features: UniverseGeoJsonFeature[] = [];
  let pagesFetched = 0;
  let partial = false;

  for (let page = 0; page < maxPages; page += 1) {
    const response = await fetch(queryForOffset(page * PAGE_SIZE), {
      headers: { Accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(15_000),
      next: { revalidate: 1800 },
    });
    if (!response.ok) throw new Error(`DNR trail service returned ${response.status}`);

    const payload = (await response.json()) as Partial<UniverseGeoJson> & {
      exceededTransferLimit?: boolean;
      error?: unknown;
    };
    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
      throw new Error("DNR trail service did not return GeoJSON");
    }

    const pageFeatures = payload.features as UniverseGeoJsonFeature[];
    features.push(...pageFeatures);
    pagesFetched += 1;

    const serverSaysMore = payload.exceededTransferLimit === true;
    if (pageFeatures.length < PAGE_SIZE && !serverSaysMore) {
      return {
        collection: { type: "FeatureCollection", features },
        partial: false,
        pagesFetched,
      };
    }
  }

  partial = true;
  return {
    collection: { type: "FeatureCollection", features },
    partial,
    pagesFetched,
  };
}

function emptyAccess(note: string): UniverseAccessState {
  return {
    status: "unavailable",
    closureCount: 0,
    rerouteCount: 0,
    closures: { type: "FeatureCollection", features: [] },
    reroutes: { type: "FeatureCollection", features: [] },
    partial: false,
    note,
  };
}

async function fetchAccessState(layer: UniverseLayerId): Promise<UniverseAccessState> {
  const [closuresResult, reroutesResult] = await Promise.allSettled([
    fetchGeoJsonPages((offset) => buildDnrAccessQuery("closures", layer, offset), MAX_ACCESS_PAGES),
    fetchGeoJsonPages((offset) => buildDnrAccessQuery("reroutes", layer, offset), MAX_ACCESS_PAGES),
  ]);

  if (closuresResult.status === "rejected" && reroutesResult.status === "rejected") {
    return emptyAccess("Michigan DNR temporary closure and reroute layers are temporarily unavailable.");
  }

  const closures = closuresResult.status === "fulfilled"
    ? closuresResult.value
    : { collection: { type: "FeatureCollection" as const, features: [] }, partial: false, pagesFetched: 0 };
  const reroutes = reroutesResult.status === "fulfilled"
    ? reroutesResult.value
    : { collection: { type: "FeatureCollection" as const, features: [] }, partial: false, pagesFetched: 0 };
  const partial =
    closuresResult.status === "rejected" ||
    reroutesResult.status === "rejected" ||
    closures.partial ||
    reroutes.partial;

  return {
    status: partial ? "partial" : "live",
    closureCount: closures.collection.features.length,
    rerouteCount: reroutes.collection.features.length,
    closures: closures.collection,
    reroutes: reroutes.collection,
    partial,
    note: partial
      ? "Some DNR access-change data is incomplete. Verify the selected trail with the managing agency before leaving."
      : "Temporary closures and reroutes come from Michigan DNR's public trail layers and are shown directly on the map.",
  };
}

export async function fetchOutdoorUniverse(layer: UniverseLayerId): Promise<OutdoorUniverseResponse> {
  const fetchedAt = new Date().toISOString();
  try {
    const [trailData, access] = await Promise.all([
      fetchGeoJsonPages((offset) => buildDnrTrailQuery(layer, offset), MAX_TRAIL_PAGES),
      fetchAccessState(layer),
    ]);

    const geojson = trailData.collection;
    const systems = summarizeTrailSystems(geojson);
    const miles = Number(
      geojson.features.reduce((sum, feature) => sum + trailMiles(feature), 0).toFixed(1),
    );

    return {
      layer,
      label: universeLayerLabels[layer],
      status: "live",
      fetchedAt,
      source: {
        name: "Michigan DNR Trails Open Data",
        url: `${DNR_TRAIL_ROOT}/layers`,
        authority: "Michigan Department of Natural Resources",
      },
      featureCount: geojson.features.length,
      systemCount: systems.length,
      miles,
      partial: trailData.partial,
      pagesFetched: trailData.pagesFetched,
      geojson,
      systems,
      access,
      note: trailData.partial
        ? `Loaded ${geojson.features.length.toLocaleString()} DNR trail segments across ${trailData.pagesFetched} pages, but the layer still exceeded the platform pagination ceiling. The map labels this as partial rather than implying complete coverage.`
        : `Loaded the full returned ${universeLayerLabels[layer].toLowerCase()} layer across ${trailData.pagesFetched} DNR data page${trailData.pagesFetched === 1 ? "" : "s"}.`,
    };
  } catch {
    return {
      layer,
      label: universeLayerLabels[layer],
      status: "unavailable",
      fetchedAt,
      source: {
        name: "Michigan DNR Trails Open Data",
        url: `${DNR_TRAIL_ROOT}/layers`,
        authority: "Michigan Department of Natural Resources",
      },
      featureCount: 0,
      systemCount: 0,
      miles: 0,
      partial: false,
      pagesFetched: 0,
      geojson: { type: "FeatureCollection", features: [] },
      systems: [],
      access: emptyAccess("Trail geometry is unavailable, so no access overlay is asserted."),
      note: "The official DNR trail layer is temporarily unavailable. Decision-ready places still remain on the map.",
    };
  }
}
