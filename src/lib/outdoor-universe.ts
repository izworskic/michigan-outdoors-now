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

export const DNR_TRAIL_SERVICE =
  "https://gisagoegle.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/FeatureServer/21/query";

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
  geojson: UniverseGeoJson;
  systems: UniverseTrailSystem[];
  note: string;
};

export function isUniverseLayerId(value: string): value is UniverseLayerId {
  return universeLayerIds.includes(value as UniverseLayerId);
}

export function buildDnrTrailQuery(layer: UniverseLayerId) {
  const params = new URLSearchParams({
    where: trailWhere[layer],
    outFields:
      "OBJECTID,TrailType,Name,TrailNamePrimary,PRDTrailUnit,RecreationSearchFacilityID,RecreationSearchTrailID,SegmentLengthMiles,SpecialRestrictionType,SpecialDesignation",
    returnGeometry: "true",
    outSR: "4326",
    geometryPrecision: "5",
    resultRecordCount: "2000",
    f: "geojson",
  });
  return `${DNR_TRAIL_SERVICE}?${params.toString()}`;
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

export function summarizeTrailSystems(collection: UniverseGeoJson) {
  const grouped = new Map<string, UniverseTrailSystem>();
  for (const feature of collection.features) {
    const name = trailName(feature);
    const existing = grouped.get(name);
    const type = feature.properties?.TrailType || "Trail";
    const unit = feature.properties?.PRDTrailUnit || null;
    if (existing) {
      existing.segments += 1;
      existing.miles += trailMiles(feature);
    } else {
      grouped.set(name, {
        name,
        type,
        unit,
        miles: trailMiles(feature),
        segments: 1,
      });
    }
  }
  return [...grouped.values()]
    .map((system) => ({ ...system, miles: Number(system.miles.toFixed(1)) }))
    .sort((a, b) => b.miles - a.miles || a.name.localeCompare(b.name));
}

export async function fetchOutdoorUniverse(layer: UniverseLayerId): Promise<OutdoorUniverseResponse> {
  const fetchedAt = new Date().toISOString();
  const sourceUrl = buildDnrTrailQuery(layer);
  try {
    const response = await fetch(sourceUrl, {
      headers: { Accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(15_000),
      next: { revalidate: 3600 },
    });
    if (!response.ok) throw new Error(`DNR trail service returned ${response.status}`);

    const payload = (await response.json()) as Partial<UniverseGeoJson> & { error?: unknown };
    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
      throw new Error("DNR trail service did not return GeoJSON");
    }
    const geojson: UniverseGeoJson = {
      type: "FeatureCollection",
      features: payload.features as UniverseGeoJsonFeature[],
    };
    const systems = summarizeTrailSystems(geojson);
    const miles = Number(
      geojson.features.reduce((sum, feature) => sum + trailMiles(feature), 0).toFixed(1),
    );
    const partial = geojson.features.length >= 2000;
    return {
      layer,
      label: universeLayerLabels[layer],
      status: "live",
      fetchedAt,
      source: {
        name: "Michigan DNR Trails Open Data",
        url: "https://gisagoegle.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/FeatureServer/21",
        authority: "Michigan Department of Natural Resources",
      },
      featureCount: geojson.features.length,
      systemCount: systems.length,
      miles,
      partial,
      geojson,
      systems,
      note: partial
        ? "Showing the first 2,000 simplified DNR trail segments for this layer. Zoom and filters remain useful, but this response may not include every segment."
        : "Official statewide DNR trail geometry. Decision-ready dots use a separate, stricter live-intelligence dataset.",
    };
  } catch {
    return {
      layer,
      label: universeLayerLabels[layer],
      status: "unavailable",
      fetchedAt,
      source: {
        name: "Michigan DNR Trails Open Data",
        url: "https://gisagoegle.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/FeatureServer/21",
        authority: "Michigan Department of Natural Resources",
      },
      featureCount: 0,
      systemCount: 0,
      miles: 0,
      partial: false,
      geojson: { type: "FeatureCollection", features: [] },
      systems: [],
      note: "The official DNR trail layer is temporarily unavailable. Decision-ready places still remain on the map.",
    };
  }
}
