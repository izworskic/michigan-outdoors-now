import { haversineMiles } from "./planner";

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

export type PlaceDepthKind = "trailhead" | "launch" | "viewpoint" | "access";

export type PlaceDepthPoint = {
  id: string;
  name: string;
  kind: PlaceDepthKind;
  latitude: number;
  longitude: number;
  distanceMiles: number;
  directionsUrl: string;
  sourceUrl: string;
  detail: string | null;
};

export type PlaceDepthResponse = {
  status: "live" | "unavailable";
  generatedAt: string;
  points: PlaceDepthPoint[];
  sourceNote: string;
};

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

function cleanText(value: unknown, max = 120) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

export function buildPlaceDepthOverpassQuery(latitude: number, longitude: number) {
  const lat = latitude.toFixed(5);
  const lon = longitude.toFixed(5);
  const radius = 7_000;
  return [
    "[out:json][timeout:10];(",
    `nwr(around:${radius},${lat},${lon})["highway"="trailhead"];`,
    `nwr(around:${radius},${lat},${lon})["tourism"="viewpoint"];`,
    `nwr(around:${radius},${lat},${lon})["leisure"="slipway"];`,
    `nwr(around:${radius},${lat},${lon})["canoe"="put_in"];`,
    `nwr(around:${radius},${lat},${lon})["waterway"="access_point"];`,
    `nwr(around:${radius},${lat},${lon})["amenity"="parking"]["name"];`,
    ");out center tags 140;",
  ].join("");
}

export function classifyPlaceDepthTags(tags: Record<string, string> | undefined): PlaceDepthKind | null {
  if (!tags) return null;
  if (tags.highway === "trailhead") return "trailhead";
  if (tags.tourism === "viewpoint") return "viewpoint";
  if (tags.leisure === "slipway" || tags.canoe === "put_in" || tags.waterway === "access_point") {
    return "launch";
  }
  if (tags.amenity === "parking") return "access";
  return null;
}

function pointForElement(element: OsmElement) {
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (typeof latitude !== "number" || !Number.isFinite(latitude)) return null;
  if (typeof longitude !== "number" || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function kindLabel(kind: PlaceDepthKind) {
  if (kind === "trailhead") return "Mapped trailhead";
  if (kind === "launch") return "Mapped water access";
  if (kind === "viewpoint") return "Mapped viewpoint";
  return "Named access / parking";
}

function detailFor(tags: Record<string, string> | undefined) {
  if (!tags) return null;
  const parts = [
    cleanText(tags.operator, 60),
    tags.surface ? `surface: ${cleanText(tags.surface, 40)}` : "",
    tags.fee ? `fee: ${cleanText(tags.fee, 20)}` : "",
    tags.access && tags.access !== "yes" ? `access: ${cleanText(tags.access, 30)}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

export function summarizePlaceDepthElements(args: {
  elements: OsmElement[];
  latitude: number;
  longitude: number;
  placeName?: string;
}) {
  const perKindLimit: Record<PlaceDepthKind, number> = {
    trailhead: 4,
    launch: 4,
    viewpoint: 4,
    access: 3,
  };
  const counts: Record<PlaceDepthKind, number> = {
    trailhead: 0,
    launch: 0,
    viewpoint: 0,
    access: 0,
  };
  const seen = new Set<string>();
  const candidates: PlaceDepthPoint[] = [];

  for (const element of args.elements) {
    const tags = element.tags ?? {};
    const kind = classifyPlaceDepthTags(tags);
    if (!kind) continue;
    const access = cleanText(tags.access, 30).toLowerCase();
    if (["private", "no", "customers"].includes(access)) continue;
    const point = pointForElement(element);
    if (!point) continue;
    const distanceMiles = haversineMiles(args.latitude, args.longitude, point.latitude, point.longitude);
    if (!Number.isFinite(distanceMiles) || distanceMiles > 4.7) continue;
    const explicitName = cleanText(tags.name || tags.official_name || tags.ref, 90);
    const name = explicitName || (args.placeName ? `${kindLabel(kind)} near ${args.placeName}` : kindLabel(kind));
    const key = `${kind}:${name.toLowerCase()}:${point.latitude.toFixed(4)}:${point.longitude.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      id: `osm-depth:${element.type}:${element.id}`,
      name,
      kind,
      latitude: point.latitude,
      longitude: point.longitude,
      distanceMiles: Number(distanceMiles.toFixed(1)),
      directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`,
      sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      detail: detailFor(tags),
    });
  }

  const kindOrder: Record<PlaceDepthKind, number> = {
    trailhead: 0,
    launch: 1,
    viewpoint: 2,
    access: 3,
  };

  return candidates
    .sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.distanceMiles - b.distanceMiles || a.name.localeCompare(b.name))
    .filter((point) => {
      if (counts[point.kind] >= perKindLimit[point.kind]) return false;
      counts[point.kind] += 1;
      return true;
    })
    .slice(0, 12);
}

async function fetchOverpassElements(latitude: number, longitude: number) {
  const query = buildPlaceDepthOverpassQuery(latitude, longitude);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_800);

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
    if (!response.ok) throw new Error("Overpass place-depth metadata unavailable");
    const payload = (await response.json()) as { elements?: OsmElement[] };
    if (!Array.isArray(payload.elements)) throw new Error("No OSM place-depth elements");
    return payload.elements;
  });

  try {
    const elements = await Promise.any(attempts);
    controller.abort();
    return elements;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

export async function fetchPlaceDepth(args: {
  latitude: number;
  longitude: number;
  placeName?: string;
}): Promise<PlaceDepthResponse> {
  const elements = await fetchOverpassElements(args.latitude, args.longitude);
  const points = elements
    ? summarizePlaceDepthElements({ ...args, elements })
    : [];

  return {
    status: elements ? "live" : "unavailable",
    generatedAt: new Date().toISOString(),
    points,
    sourceNote:
      "Trailheads, viewpoints and mapped access points come from OpenStreetMap contributors and are leads, not guarantees of legal/current access. Public boat launches shown elsewhere in the detail use Michigan Outdoors Now's source-qualified launch layer.",
  };
}
