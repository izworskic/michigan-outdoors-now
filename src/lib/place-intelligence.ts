import {
  DNR_TRAIL_CLOSURES_SERVICE,
  DNR_TRAIL_REROUTES_SERVICE,
  DNR_TRAIL_SERVICE,
  type UniverseGeoJson,
  type UniverseGeoJsonFeature,
} from "./outdoor-universe";
import { haversineMiles } from "./planner";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export type PointWeatherIntelligence = {
  temperature: number | null;
  high: number | null;
  low: number | null;
  precipitationProbability: number | null;
  windGust: number | null;
  aqi: number | null;
  weatherCode: number | null;
  recentRainInches: number | null;
  recentSnowInches: number | null;
  daylightHoursRemaining: number | null;
  outingWindow: {
    start: string;
    end: string;
    maxPrecipitationProbability: number | null;
    maxWindGust: number | null;
    minTemperature: number | null;
    maxTemperature: number | null;
  } | null;
};

export type TrailSystemIntelligence = {
  name: string;
  nearbyMappedMiles: number;
  nearestMiles: number;
  status: string | null;
  restriction: string | null;
  designation: string | null;
};

export type TrailMetadataIntelligence = {
  routeName: string | null;
  taggedDistanceMiles: number | null;
  taggedAscentFeet: number | null;
  difficulty: string | null;
  trailVisibility: string | null;
  surface: string | null;
  footAccess: string | null;
  source: "OpenStreetMap" | null;
};

export type TrailRouteTruth = {
  routeName: string | null;
  routeKind: "loop" | "point-to-point" | "unknown";
  distanceMiles: number | null;
  distanceSource: "osm-tag" | "osm-geometry" | null;
  ascentFeet: number | null;
  ascentSource: "osm-tag" | "sampled-route" | null;
  difficulty: string | null;
  difficultyLabel: string | null;
  surface: string | null;
  trailVisibility: string | null;
  footAccess: string | null;
  relationId: number | null;
  mappedWayCount: number;
  confidence: "high" | "medium" | "limited";
  caveats: string[];
};

export type GoSignal = {
  status: "good" | "mixed" | "poor" | "unknown";
  headline: string;
  reasons: string[];
  cautions: string[];
};

export type ElevationIntelligence = {
  lowFeet: number;
  highFeet: number;
  rangeFeet: number;
  sampleCount: number;
};

export type AccessIntelligence = {
  closureCount: number;
  rerouteCount: number;
  notes: string[];
  source: "Michigan DNR Trails Open Data";
};

export type PlaceIntelligence = {
  generatedAt: string;
  weather: PointWeatherIntelligence | null;
  trailSystems: TrailSystemIntelligence[];
  trailMetadata: TrailMetadataIntelligence | null;
  trailTruth: TrailRouteTruth | null;
  goSignal: GoSignal;
  elevation: ElevationIntelligence | null;
  access: AccessIntelligence;
  confidenceNote: string;
};

type OSMElement = {
  type: "node" | "way" | "relation";
  id: number;
  center?: { lat?: number; lon?: number };
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  members?: Array<{
    type: "node" | "way" | "relation";
    ref: number;
    role?: string;
  }>;
  geometry?: Array<{ lat: number; lon: number }>;
};

type GeoJsonPayload = Partial<UniverseGeoJson> & {
  error?: unknown;
};

type ForecastPayload = {
  current?: {
    temperature_2m?: number | null;
    wind_gusts_10m?: number | null;
    weather_code?: number | null;
  };
  hourly?: {
    time?: number[];
    temperature_2m?: Array<number | null>;
    precipitation_probability?: Array<number | null>;
    rain?: Array<number | null>;
    snowfall?: Array<number | null>;
    wind_gusts_10m?: Array<number | null>;
  };
  daily?: {
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    precipitation_probability_max?: Array<number | null>;
    sunrise?: number[];
    sunset?: number[];
  };
};

type AirPayload = {
  hourly?: {
    time?: string[];
    us_aqi?: Array<number | null>;
  };
};

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function todayInDetroit() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function fetchPointWeather(
  latitude: number,
  longitude: number,
): Promise<PointWeatherIntelligence | null> {
  const forecastParams = new URLSearchParams({
    latitude: latitude.toFixed(5),
    longitude: longitude.toFixed(5),
    timezone: "America/Detroit",
    timeformat: "unixtime",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    current: "temperature_2m,wind_gusts_10m,weather_code",
    hourly:
      "temperature_2m,precipitation_probability,rain,snowfall,wind_gusts_10m",
    daily:
      "temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
    past_days: "1",
    forecast_days: "2",
  });
  const airParams = new URLSearchParams({
    latitude: latitude.toFixed(5),
    longitude: longitude.toFixed(5),
    timezone: "America/Detroit",
    hourly: "us_aqi",
    forecast_days: "2",
  });

  const [forecastResult, airResult] = await Promise.allSettled([
    fetch(`https://api.open-meteo.com/v1/forecast?${forecastParams}`, {
      signal: AbortSignal.timeout(2_400),
      next: { revalidate: 900 },
    }).then(async (response) => {
      if (!response.ok) throw new Error("Weather unavailable");
      return (await response.json()) as ForecastPayload;
    }),
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${airParams}`, {
      signal: AbortSignal.timeout(2_400),
      next: { revalidate: 1800 },
    }).then(async (response) => {
      if (!response.ok) throw new Error("Air quality unavailable");
      return (await response.json()) as AirPayload;
    }),
  ]);

  if (forecastResult.status !== "fulfilled") return null;
  const forecast = forecastResult.value;
  const targetDate = todayInDetroit();
  let aqi: number | null = null;

  if (airResult.status === "fulfilled") {
    const times = airResult.value.hourly?.time ?? [];
    const values = airResult.value.hourly?.us_aqi ?? [];
    const matching = values.filter(
      (value, index): value is number =>
        times[index]?.startsWith(targetDate) === true &&
        typeof value === "number" &&
        Number.isFinite(value),
    );
    if (matching.length) aqi = Math.max(...matching);
  }

  const nowSeconds = Date.now() / 1000;
  const hourlyTimes = forecast.hourly?.time ?? [];
  const rain = forecast.hourly?.rain ?? [];
  const snowfall = forecast.hourly?.snowfall ?? [];
  const recentIndexes = hourlyTimes
    .map((time, index) => ({ time, index }))
    .filter(({ time }) => time >= nowSeconds - 86_400 && time <= nowSeconds);
  const futureIndexes = hourlyTimes
    .map((time, index) => ({ time, index }))
    .filter(({ time }) => time >= nowSeconds && time <= nowSeconds + 21_600);

  const recentRain = recentIndexes
    .map(({ index }) => rain[index])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .reduce((sum, value) => sum + value, 0);
  // Open-Meteo reports snowfall depth in centimeters even when liquid precipitation uses inches.
  const recentSnowCm = recentIndexes
    .map(({ index }) => snowfall[index])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .reduce((sum, value) => sum + value, 0);

  const precipitationValues = futureIndexes
    .map(({ index }) => forecast.hourly?.precipitation_probability?.[index])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const gustValues = futureIndexes
    .map(({ index }) => forecast.hourly?.wind_gusts_10m?.[index])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const temperatureValues = futureIndexes
    .map(({ index }) => forecast.hourly?.temperature_2m?.[index])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  const timeLabel = (seconds: number) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Detroit",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(seconds * 1000));

  const sunset =
    (forecast.daily?.sunset ?? []).find(
      (value) => typeof value === "number" && Number.isFinite(value) && value > nowSeconds,
    ) ?? null;

  return {
    temperature: numberOrNull(forecast.current?.temperature_2m),
    high: numberOrNull(forecast.daily?.temperature_2m_max?.[0]),
    low: numberOrNull(forecast.daily?.temperature_2m_min?.[0]),
    precipitationProbability: numberOrNull(forecast.daily?.precipitation_probability_max?.[0]),
    windGust: numberOrNull(forecast.current?.wind_gusts_10m),
    aqi,
    weatherCode: numberOrNull(forecast.current?.weather_code),
    recentRainInches: recentIndexes.length ? Number(recentRain.toFixed(2)) : null,
    recentSnowInches: recentIndexes.length ? Number((recentSnowCm / 2.54).toFixed(1)) : null,
    daylightHoursRemaining:
      sunset === null ? null : Number(Math.max(0, (sunset - nowSeconds) / 3600).toFixed(1)),
    outingWindow:
      futureIndexes.length > 0
        ? {
            start: timeLabel(futureIndexes[0].time),
            end: timeLabel(futureIndexes[futureIndexes.length - 1].time),
            maxPrecipitationProbability: precipitationValues.length
              ? Math.max(...precipitationValues)
              : null,
            maxWindGust: gustValues.length ? Math.max(...gustValues) : null,
            minTemperature: temperatureValues.length ? Math.min(...temperatureValues) : null,
            maxTemperature: temperatureValues.length ? Math.max(...temperatureValues) : null,
          }
        : null,
  };
}

function spatialEnvelope(latitude: number, longitude: number, miles = 5) {
  const latSpan = miles / 69;
  const lonSpan = miles / Math.max(20, 69 * Math.cos((latitude * Math.PI) / 180));
  return [
    longitude - lonSpan,
    latitude - latSpan,
    longitude + lonSpan,
    latitude + latSpan,
  ];
}

function buildDnrSpatialQuery(
  service: string,
  latitude: number,
  longitude: number,
  where: string,
  outFields: string,
) {
  const bounds = spatialEnvelope(latitude, longitude, 5);
  const params = new URLSearchParams({
    where,
    geometry: bounds.map((value) => value.toFixed(5)).join(","),
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields,
    returnGeometry: "true",
    outSR: "4326",
    geometryPrecision: "5",
    resultRecordCount: "250",
    f: "geojson",
  });
  return `${service}?${params}`;
}

async function fetchGeoJson(url: string): Promise<UniverseGeoJson> {
  const response = await fetch(url, {
    headers: { Accept: "application/geo+json, application/json" },
    signal: AbortSignal.timeout(2_000),
    next: { revalidate: 900 },
  });
  if (!response.ok) throw new Error("DNR spatial query unavailable");
  const payload = (await response.json()) as GeoJsonPayload;
  if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
    throw new Error("DNR spatial query returned invalid data");
  }
  return payload as UniverseGeoJson;
}

function flattenCoordinates(coordinates: unknown, result: Array<[number, number]> = []) {
  if (!Array.isArray(coordinates)) return result;
  if (
    coordinates.length >= 2 &&
    typeof coordinates[0] === "number" &&
    typeof coordinates[1] === "number" &&
    Number.isFinite(coordinates[0]) &&
    Number.isFinite(coordinates[1])
  ) {
    result.push([coordinates[0], coordinates[1]]);
    return result;
  }
  for (const value of coordinates) flattenCoordinates(value, result);
  return result;
}

function nearestFeatureMiles(
  feature: UniverseGeoJsonFeature,
  latitude: number,
  longitude: number,
) {
  const points = flattenCoordinates(feature.geometry?.coordinates);
  if (!points.length) return Number.POSITIVE_INFINITY;
  let nearest = Number.POSITIVE_INFINITY;
  for (const [lon, lat] of points) {
    nearest = Math.min(nearest, haversineMiles(latitude, longitude, lat, lon));
  }
  return nearest;
}

function trailFeatureName(feature: UniverseGeoJsonFeature) {
  const raw = feature.properties?.Name || feature.properties?.TrailNamePrimary;
  return typeof raw === "string" && raw.trim() ? raw.trim() : "Unnamed DNR hiking trail";
}

function summarizeTrailSystems(
  features: UniverseGeoJsonFeature[],
  latitude: number,
  longitude: number,
): TrailSystemIntelligence[] {
  const groups = new Map<string, TrailSystemIntelligence>();

  for (const feature of features) {
    const nearestMiles = nearestFeatureMiles(feature, latitude, longitude);
    if (!Number.isFinite(nearestMiles) || nearestMiles > 5.5) continue;

    const name = trailFeatureName(feature);
    const miles = numberOrNull(feature.properties?.SegmentLengthMiles) ?? 0;
    const existing = groups.get(name);
    const status =
      typeof feature.properties?.OpenClosedStatusNonmotor === "string"
        ? feature.properties.OpenClosedStatusNonmotor
        : null;
    const restriction =
      typeof feature.properties?.SpecialRestrictionType === "string"
        ? feature.properties.SpecialRestrictionType
        : null;
    const designation =
      typeof feature.properties?.SpecialDesignation === "string"
        ? feature.properties.SpecialDesignation
        : null;

    if (existing) {
      existing.nearbyMappedMiles += miles;
      existing.nearestMiles = Math.min(existing.nearestMiles, nearestMiles);
      existing.status ||= status;
      existing.restriction ||= restriction;
      existing.designation ||= designation;
    } else {
      groups.set(name, {
        name,
        nearbyMappedMiles: miles,
        nearestMiles,
        status,
        restriction,
        designation,
      });
    }
  }

  return [...groups.values()]
    .map((system) => ({
      ...system,
      nearbyMappedMiles: Number(system.nearbyMappedMiles.toFixed(1)),
      nearestMiles: Number(system.nearestMiles.toFixed(1)),
    }))
    .sort((a, b) => a.nearestMiles - b.nearestMiles || b.nearbyMappedMiles - a.nearbyMappedMiles)
    .slice(0, 4);
}

function accessNote(feature: UniverseGeoJsonFeature, kind: "closure" | "reroute") {
  const name = trailFeatureName(feature);
  const detail =
    typeof feature.properties?.PublicComments === "string"
      ? feature.properties.PublicComments.trim()
      : "";
  return detail ? `${kind === "closure" ? "Closure" : "Reroute"} · ${name}: ${detail}` : `${kind === "closure" ? "Closure" : "Reroute"} · ${name}`;
}

function summarizeAccess(
  closures: UniverseGeoJson,
  reroutes: UniverseGeoJson,
  latitude: number,
  longitude: number,
): AccessIntelligence {
  const nearbyClosures = closures.features.filter(
    (feature) => nearestFeatureMiles(feature, latitude, longitude) <= 5.5,
  );
  const nearbyReroutes = reroutes.features.filter(
    (feature) => nearestFeatureMiles(feature, latitude, longitude) <= 5.5,
  );

  return {
    closureCount: nearbyClosures.length,
    rerouteCount: nearbyReroutes.length,
    notes: [
      ...nearbyClosures.slice(0, 3).map((feature) => accessNote(feature, "closure")),
      ...nearbyReroutes.slice(0, 3).map((feature) => accessNote(feature, "reroute")),
    ],
    source: "Michigan DNR Trails Open Data",
  };
}

function buildOverpassTrailQuery(latitude: number, longitude: number) {
  const lat = latitude.toFixed(5);
  const lon = longitude.toFixed(5);
  return (
    "[out:json][timeout:12];" +
    `relation(around:3500,${lat},${lon})["route"~"^(hiking|foot)$"]->.routes;` +
    ".routes out body center 20;" +
    "way(r.routes);out tags geom 160;" +
    `way(around:1800,${lat},${lon})["highway"~"^(path|footway|track)$"];out tags center 60;`
  );
}

async function fetchOsmTrailElements(latitude: number, longitude: number): Promise<OSMElement[]> {
  const query = buildOverpassTrailQuery(latitude, longitude);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_500);

  const attempts = OVERPASS_ENDPOINTS.map(async (endpoint) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        Accept: "application/json",
        "User-Agent": "MichiganOutdoorsNow/1.0 (https://michiganoutdoorsnow.chrisizworski.com/)",
      },
      body: new URLSearchParams({ data: query }).toString(),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Overpass trail metadata unavailable");
    const payload = (await response.json()) as { elements?: OSMElement[] };
    if (!Array.isArray(payload.elements)) throw new Error("No OSM trail elements");
    return payload.elements;
  });

  try {
    const result = await Promise.any(attempts);
    controller.abort();
    return result;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

function numericValue(raw: string | undefined) {
  if (!raw) return null;
  const text = raw.trim().toLowerCase().replace(",", ".");
  const match = text.match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? { value, text } : null;
}

export function parseDistanceMiles(
  raw: string | undefined,
  defaultUnit: "km" | "m" | "mi",
) {
  const parsed = numericValue(raw);
  if (!parsed) return null;
  const { value, text } = parsed;

  if (/\bmi\b|mile/.test(text)) return Number(value.toFixed(1));
  if (/\bkm\b|kilomet/.test(text)) return Number((value * 0.621371).toFixed(1));
  if (/\bm\b|meter/.test(text)) return Number((value / 1609.344).toFixed(1));

  if (defaultUnit === "km") return Number((value * 0.621371).toFixed(1));
  if (defaultUnit === "m") return Number((value / 1609.344).toFixed(1));
  return Number(value.toFixed(1));
}

export function parseElevationFeet(raw: string | undefined) {
  const parsed = numericValue(raw);
  if (!parsed) return null;
  const { value, text } = parsed;
  if (/\bft\b|feet|foot/.test(text)) return Math.round(value);
  return Math.round(value * 3.28084);
}

function difficultyRank(value: string | undefined) {
  const order = [
    "strolling",
    "hiking",
    "mountain_hiking",
    "demanding_mountain_hiking",
    "alpine_hiking",
    "demanding_alpine_hiking",
    "difficult_alpine_hiking",
  ];
  return value ? order.indexOf(value) : -1;
}

function osmElementDistance(
  element: OSMElement,
  latitude: number,
  longitude: number,
) {
  const lat = element.lat ?? element.center?.lat ?? element.geometry?.[0]?.lat;
  const lon = element.lon ?? element.center?.lon ?? element.geometry?.[0]?.lon;
  return typeof lat === "number" && typeof lon === "number"
    ? haversineMiles(latitude, longitude, lat, lon)
    : Number.POSITIVE_INFINITY;
}

function selectOsmRoute(
  elements: OSMElement[],
  latitude: number,
  longitude: number,
) {
  return (
    elements
      .filter((element) => element.type === "relation")
      .map((element) => ({
        element,
        distance: osmElementDistance(element, latitude, longitude),
        named: Boolean(element.tags?.name || element.tags?.ref),
      }))
      .sort(
        (a, b) =>
          Number(b.named) - Number(a.named) ||
          a.distance - b.distance ||
          a.element.id - b.element.id,
      )[0]?.element ?? null
  );
}

function routeMemberWays(route: OSMElement | null, elements: OSMElement[]) {
  if (!route?.members?.length) return [];
  const wayById = new Map(
    elements
      .filter((element) => element.type === "way")
      .map((element) => [element.id, element] as const),
  );
  return route.members
    .filter((member) => member.type === "way")
    .map((member) => ({ member, way: wayById.get(member.ref) }))
    .filter(
      (item): item is {
        member: { type: "node" | "way" | "relation"; ref: number; role?: string };
        way: OSMElement;
      } => Boolean(item.way?.geometry?.length),
    );
}

function geometryDistanceMiles(geometry: Array<{ lat: number; lon: number }>) {
  let miles = 0;
  for (let index = 1; index < geometry.length; index += 1) {
    miles += haversineMiles(
      geometry[index - 1].lat,
      geometry[index - 1].lon,
      geometry[index].lat,
      geometry[index].lon,
    );
  }
  return miles;
}

function orderedRoutePoints(route: OSMElement | null, elements: OSMElement[]) {
  const parts = routeMemberWays(route, elements);
  const points: Array<{ lat: number; lon: number }> = [];
  let previous: { lat: number; lon: number } | null = null;

  for (const { member, way } of parts) {
    let geometry = [...(way.geometry ?? [])];
    if (!geometry.length) continue;

    if (member.role === "backward" || member.role === "-1") {
      geometry.reverse();
    } else if (previous && geometry.length > 1) {
      const first = geometry[0];
      const last = geometry[geometry.length - 1];
      const firstGap = haversineMiles(previous.lat, previous.lon, first.lat, first.lon);
      const lastGap = haversineMiles(previous.lat, previous.lon, last.lat, last.lon);
      if (lastGap < firstGap) geometry.reverse();
    }

    if (points.length && geometry.length) {
      const first = geometry[0];
      const lastPoint = points[points.length - 1];
      if (haversineMiles(lastPoint.lat, lastPoint.lon, first.lat, first.lon) < 0.01) {
        geometry = geometry.slice(1);
      }
    }

    points.push(...geometry);
    previous = points[points.length - 1] ?? previous;
  }

  return points;
}

function routeKind(tags: Record<string, string>) {
  const roundtrip = tags.roundtrip?.toLowerCase();
  if (roundtrip === "yes" || roundtrip === "true" || roundtrip === "1") return "loop" as const;
  if (roundtrip === "no" || tags.from || tags.to) return "point-to-point" as const;
  return "unknown" as const;
}

function difficultyLabel(value: string | null) {
  if (!value) return null;
  const labels: Record<string, string> = {
    strolling: "strolling",
    hiking: "hiking",
    mountain_hiking: "mountain hiking",
    demanding_mountain_hiking: "demanding mountain hiking",
    alpine_hiking: "alpine hiking",
    demanding_alpine_hiking: "demanding alpine hiking",
    difficult_alpine_hiking: "difficult alpine hiking",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function summarizeOsmTrailMetadata(
  elements: OSMElement[],
  latitude: number,
  longitude: number,
): TrailMetadataIntelligence | null {
  if (!elements.length) return null;

  const route = selectOsmRoute(elements, latitude, longitude);
  const routeWays = routeMemberWays(route, elements).map(({ way }) => way);
  const nearbyWays = elements
    .filter((element) => element.type === "way")
    .sort(
      (a, b) =>
        osmElementDistance(a, latitude, longitude) -
        osmElementDistance(b, latitude, longitude),
    )
    .slice(0, 24);
  const ways = routeWays.length ? routeWays : nearbyWays;

  const hardest =
    ways
      .map((element) => element.tags?.sac_scale)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => difficultyRank(b) - difficultyRank(a))[0] ?? null;
  const visibility =
    ways.map((element) => element.tags?.trail_visibility).find(Boolean) ?? null;
  const surface = ways.map((element) => element.tags?.surface).find(Boolean) ?? null;
  const footAccess =
    ways.map((element) => element.tags?.foot || element.tags?.access).find(Boolean) ?? null;

  const routeTags = route?.tags ?? {};
  const taggedDistance =
    parseDistanceMiles(routeTags.distance, "km") ??
    parseDistanceMiles(routeTags.length, "m") ??
    parseDistanceMiles(routeTags["distance:mi"], "mi");
  const taggedAscentFeet = parseElevationFeet(routeTags.ascent);

  if (!route && !hardest && !visibility && !surface && !footAccess) return null;

  return {
    routeName: routeTags.name || routeTags.ref || null,
    taggedDistanceMiles: taggedDistance,
    taggedAscentFeet,
    difficulty: hardest,
    trailVisibility: visibility,
    surface,
    footAccess,
    source: "OpenStreetMap",
  };
}

async function buildTrailTruth(
  elements: OSMElement[],
  latitude: number,
  longitude: number,
): Promise<TrailRouteTruth | null> {
  const route = selectOsmRoute(elements, latitude, longitude);
  if (!route) return null;

  const routeTags = route.tags ?? {};
  const memberWays = routeMemberWays(route, elements);
  const routePoints = orderedRoutePoints(route, elements);
  const taggedDistance =
    parseDistanceMiles(routeTags.distance, "km") ??
    parseDistanceMiles(routeTags.length, "m") ??
    parseDistanceMiles(routeTags["distance:mi"], "mi");
  const geometryDistance = memberWays.length
    ? memberWays.reduce(
        (sum, { way }) => sum + geometryDistanceMiles(way.geometry ?? []),
        0,
      )
    : 0;
  const taggedAscent = parseElevationFeet(routeTags.ascent);
  const sampledAscent =
    taggedAscent === null && routePoints.length >= 8
      ? await fetchRouteAscentFeet(routePoints)
      : null;
  const routeWays = memberWays.map(({ way }) => way);
  const hardest =
    routeWays
      .map((way) => way.tags?.sac_scale)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => difficultyRank(b) - difficultyRank(a))[0] ?? null;
  const surface = routeWays.map((way) => way.tags?.surface).find(Boolean) ?? null;
  const trailVisibility =
    routeWays.map((way) => way.tags?.trail_visibility).find(Boolean) ?? null;
  const footAccess =
    routeWays.map((way) => way.tags?.foot || way.tags?.access).find(Boolean) ?? null;
  const distanceMiles =
    taggedDistance ??
    (geometryDistance > 0.2 ? Number(geometryDistance.toFixed(1)) : null);
  const distanceSource =
    taggedDistance !== null
      ? ("osm-tag" as const)
      : distanceMiles !== null
        ? ("osm-geometry" as const)
        : null;
  const routeName = routeTags.name || routeTags.ref || null;
  const confidence: TrailRouteTruth["confidence"] =
    routeName && taggedDistance !== null
      ? "high"
      : routeName && distanceMiles !== null && memberWays.length >= 2
        ? "medium"
        : "limited";
  const caveats = [
    distanceSource === "osm-geometry"
      ? "Mileage is computed from mapped OSM relation members, not an official land-manager route statement."
      : "",
    sampledAscent !== null
      ? "Ascent is sampled from mapped route geometry and terrain elevation; it is an estimate, not a surveyed route total."
      : "",
    "Use the official land manager for closures, reroutes, seasonal rules and the final route choice.",
  ].filter(Boolean);

  return {
    routeName,
    routeKind: routeKind(routeTags),
    distanceMiles,
    distanceSource,
    ascentFeet: taggedAscent ?? sampledAscent,
    ascentSource:
      taggedAscent !== null
        ? "osm-tag"
        : sampledAscent !== null
          ? "sampled-route"
          : null,
    difficulty: hardest,
    difficultyLabel: difficultyLabel(hardest),
    surface,
    trailVisibility,
    footAccess,
    relationId: route.id,
    mappedWayCount: memberWays.length,
    confidence,
    caveats,
  };
}

function sampleFeaturePoints(
  features: UniverseGeoJsonFeature[],
  latitude: number,
  longitude: number,
) {
  const selected = features
    .map((feature) => ({
      feature,
      distance: nearestFeatureMiles(feature, latitude, longitude),
    }))
    .filter((item) => Number.isFinite(item.distance))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 3)
    .flatMap(({ feature }) => flattenCoordinates(feature.geometry?.coordinates));

  if (selected.length <= 80) return selected;
  const step = (selected.length - 1) / 79;
  return Array.from({ length: 80 }, (_, index) => selected[Math.round(index * step)]);
}

async function fetchElevationRange(
  features: UniverseGeoJsonFeature[],
  latitude: number,
  longitude: number,
): Promise<ElevationIntelligence | null> {
  const points = sampleFeaturePoints(features, latitude, longitude);
  if (points.length < 2) return null;

  const params = new URLSearchParams({
    latitude: points.map((point) => point[1].toFixed(5)).join(","),
    longitude: points.map((point) => point[0].toFixed(5)).join(","),
  });

  try {
    const response = await fetch(`https://api.open-meteo.com/v1/elevation?${params}`, {
      signal: AbortSignal.timeout(1_800),
      next: { revalidate: 86_400 },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { elevation?: Array<number | null> };
    const meters = (payload.elevation ?? []).filter(
      (value): value is number => typeof value === "number" && Number.isFinite(value),
    );
    if (meters.length < 2) return null;

    const lowFeet = Math.round(Math.min(...meters) * 3.28084);
    const highFeet = Math.round(Math.max(...meters) * 3.28084);
    return {
      lowFeet,
      highFeet,
      rangeFeet: Math.max(0, highFeet - lowFeet),
      sampleCount: meters.length,
    };
  } catch {
    return null;
  }
}

async function fetchRouteAscentFeet(
  routePoints: Array<{ lat: number; lon: number }>,
) {
  const selected =
    routePoints.length <= 96
      ? routePoints
      : Array.from({ length: 96 }, (_, index) => {
          const step = (routePoints.length - 1) / 95;
          return routePoints[Math.round(index * step)];
        });

  const params = new URLSearchParams({
    latitude: selected.map((point) => point.lat.toFixed(5)).join(","),
    longitude: selected.map((point) => point.lon.toFixed(5)).join(","),
  });

  try {
    const response = await fetch(`https://api.open-meteo.com/v1/elevation?${params}`, {
      signal: AbortSignal.timeout(1_800),
      next: { revalidate: 86_400 },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { elevation?: Array<number | null> };
    const feet = (payload.elevation ?? [])
      .map((value) =>
        typeof value === "number" && Number.isFinite(value) ? value * 3.28084 : null,
      )
      .filter((value): value is number => value !== null);
    if (feet.length < 8) return null;

    let gain = 0;
    for (let index = 1; index < feet.length; index += 1) {
      const delta = feet[index] - feet[index - 1];
      // Ignore tiny DEM jitter so sampled terrain does not manufacture climb.
      if (delta > 6) gain += delta;
    }

    if (!Number.isFinite(gain) || gain <= 0 || gain > 15_000) return null;
    return Math.round(gain);
  } catch {
    return null;
  }
}

function buildGoSignal(args: {
  weather: PointWeatherIntelligence | null;
  access: AccessIntelligence;
  trailTruth: TrailRouteTruth | null;
}): GoSignal {
  const { weather, access, trailTruth } = args;
  const reasons: string[] = [];
  const cautions: string[] = [];

  if (access.closureCount > 0) {
    cautions.push(
      `Michigan DNR returned ${access.closureCount} nearby closure item${access.closureCount === 1 ? "" : "s"}.`,
    );
  }
  if (access.rerouteCount > 0) {
    cautions.push(
      `Michigan DNR returned ${access.rerouteCount} nearby reroute item${access.rerouteCount === 1 ? "" : "s"}.`,
    );
  }

  if (!weather) {
    return {
      status: access.closureCount > 0 ? "poor" : access.rerouteCount > 0 ? "mixed" : "unknown",
      headline:
        access.closureCount > 0
          ? "Access deserves a check before committing."
          : "Current weather did not return, so the day cannot be ranked confidently.",
      reasons,
      cautions,
    };
  }

  const window = weather.outingWindow;
  const naturalSurface =
    !trailTruth?.surface ||
    !["paved", "asphalt", "concrete", "paving_stones"].includes(trailTruth.surface);

  if (
    window?.maxPrecipitationProbability !== null &&
    window?.maxPrecipitationProbability !== undefined
  ) {
    if (window.maxPrecipitationProbability >= 70) {
      cautions.push(
        `Rain chance reaches ${Math.round(window.maxPrecipitationProbability)}% in the next several hours.`,
      );
    } else if (window.maxPrecipitationProbability <= 30) {
      reasons.push("The next several hours have a relatively low rain signal.");
    }
  }

  if (window?.maxWindGust !== null && window?.maxWindGust !== undefined) {
    if (window.maxWindGust >= 30) {
      cautions.push(`Gusts may reach about ${Math.round(window.maxWindGust)} mph.`);
    } else if (window.maxWindGust < 20) {
      reasons.push("Wind looks relatively modest in the near-term window.");
    }
  }

  if (weather.aqi !== null) {
    if (weather.aqi >= 101) {
      cautions.push(`Air quality reaches AQI ${Math.round(weather.aqi)}.`);
    } else if (weather.aqi <= 80) {
      reasons.push("Air quality is not currently a major negative signal.");
    }
  }

  if (naturalSurface && weather.recentRainInches !== null && weather.recentRainInches >= 0.35) {
    cautions.push(
      `About ${weather.recentRainInches.toFixed(2)} in of rain was reported in the prior 24 hours; natural surfaces may be wet or muddy.`,
    );
  }

  if (weather.recentSnowInches !== null && weather.recentSnowInches >= 0.5) {
    cautions.push(
      `Recent snowfall is about ${weather.recentSnowInches.toFixed(1)} in; route footing may differ from normal conditions.`,
    );
  }

  if (weather.daylightHoursRemaining !== null) {
    if (weather.daylightHoursRemaining < 2) {
      cautions.push(
        `Only about ${weather.daylightHoursRemaining.toFixed(1)} hours of daylight remain.`,
      );
    } else if (weather.daylightHoursRemaining >= 4) {
      reasons.push(
        `About ${weather.daylightHoursRemaining.toFixed(1)} hours of daylight remain.`,
      );
    }
  }

  const severeWeatherSignal =
    (window?.maxPrecipitationProbability ?? 0) >= 85 ||
    (window?.maxWindGust ?? 0) >= 40 ||
    (weather.aqi ?? 0) >= 151;
  const status: GoSignal["status"] =
    access.closureCount > 0 || severeWeatherSignal
      ? "poor"
      : cautions.length > 0
        ? "mixed"
        : reasons.length >= 2
          ? "good"
          : "unknown";

  const headline =
    status === "good"
      ? "This place is making a relatively strong case for the next several hours."
      : status === "mixed"
        ? "The day is workable on paper, but one or more conditions deserve a second look."
        : status === "poor"
          ? "A current condition or access signal argues for checking an alternative."
          : "There is not enough current evidence to make a strong go-or-skip call.";

  return { status, headline, reasons: reasons.slice(0, 4), cautions: cautions.slice(0, 5) };
}

export async function fetchPlaceIntelligence(args: {
  latitude: number;
  longitude: number;
}): Promise<PlaceIntelligence> {
  const trailUrl = buildDnrSpatialQuery(
    DNR_TRAIL_SERVICE,
    args.latitude,
    args.longitude,
    "TrailType='Hiking'",
    "OBJECTID,TrailType,Name,TrailNamePrimary,PRDTrailUnit,SegmentLengthMiles,SpecialRestrictionType,SpecialDesignation,OpenClosedStatusNonmotor",
  );
  const closureUrl = buildDnrSpatialQuery(
    DNR_TRAIL_CLOSURES_SERVICE,
    args.latitude,
    args.longitude,
    "1=1",
    "OBJECTID,TrailNamePrimary,PublicComments,PRDTrailUnit,SegmentLengthMiles",
  );
  const rerouteUrl = buildDnrSpatialQuery(
    DNR_TRAIL_REROUTES_SERVICE,
    args.latitude,
    args.longitude,
    "1=1",
    "OBJECTID,TrailNamePrimary,PublicComments,PRDTrailUnit,SegmentLengthMiles",
  );

  const [weatherResult, trailResult, closureResult, rerouteResult, osmResult] =
    await Promise.allSettled([
      fetchPointWeather(args.latitude, args.longitude),
      fetchGeoJson(trailUrl),
      fetchGeoJson(closureUrl),
      fetchGeoJson(rerouteUrl),
      fetchOsmTrailElements(args.latitude, args.longitude),
    ]);

  const trails =
    trailResult.status === "fulfilled"
      ? trailResult.value
      : ({ type: "FeatureCollection", features: [] } as UniverseGeoJson);
  const closures =
    closureResult.status === "fulfilled"
      ? closureResult.value
      : ({ type: "FeatureCollection", features: [] } as UniverseGeoJson);
  const reroutes =
    rerouteResult.status === "fulfilled"
      ? rerouteResult.value
      : ({ type: "FeatureCollection", features: [] } as UniverseGeoJson);
  const osmElements = osmResult.status === "fulfilled" ? osmResult.value : [];

  const elevation = await fetchElevationRange(trails.features, args.latitude, args.longitude);

  return {
    generatedAt: new Date().toISOString(),
    weather: weatherResult.status === "fulfilled" ? weatherResult.value : null,
    trailSystems: summarizeTrailSystems(trails.features, args.latitude, args.longitude),
    trailMetadata: summarizeOsmTrailMetadata(osmElements, args.latitude, args.longitude),
    elevation,
    access: summarizeAccess(closures, reroutes, args.latitude, args.longitude),
    confidenceNote:
      "Weather and air quality come from Open-Meteo. Nearby official trail and access-change data come from Michigan DNR. OSM difficulty, surface, route-distance and visibility fields appear only when nearby mapped trail data includes those tags. Elevation is a sampled nearby-trail terrain range, not total route gain.",
  };
}
