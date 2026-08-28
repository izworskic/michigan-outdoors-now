import { NextResponse } from "next/server";
import { destinations } from "../../../data/destinations";
import {
  categoryFromTags,
  categoryLabel,
  curatedDiscoveryPlaces,
  discoveryRadiusMeters,
  interpretOutdoorQuery,
  isDiscoveryCandidateInRange,
  overpassSelectorsFor,
  scoreDiscoveryCandidate,
  type DiscoveryPlace,
  type DiscoveryResponse,
} from "../../../lib/discovery";
import { resolveMichiganOrigin } from "../../../lib/live-data";
import { isPlausibleMichiganCoordinate } from "../../../lib/planner";

export const runtime = "nodejs";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

type DiscoverRequest = {
  origin: string;
  originCoordinates?: {
    latitude: number;
    longitude: number;
  };
  query: string;
  maxDriveHours: number;
};

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

function invalid(message: string) {
  return NextResponse.json({ error: message }, { status: 400, headers: responseHeaders });
}

function isDiscoverRequest(value: unknown): value is DiscoverRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Record<string, unknown>;
  const coordinates = request.originCoordinates as Record<string, unknown> | undefined;
  const validCoordinates =
    coordinates === undefined ||
    (coordinates !== null &&
      typeof coordinates === "object" &&
      typeof coordinates.latitude === "number" &&
      typeof coordinates.longitude === "number" &&
      isPlausibleMichiganCoordinate(coordinates.latitude, coordinates.longitude));

  return (
    typeof request.origin === "string" &&
    request.origin.trim().length >= 2 &&
    request.origin.trim().length <= 80 &&
    typeof request.query === "string" &&
    request.query.trim().length >= 2 &&
    request.query.trim().length <= 180 &&
    Number.isInteger(request.maxDriveHours) &&
    (request.maxDriveHours as number) >= 1 &&
    (request.maxDriveHours as number) <= 8 &&
    validCoordinates
  );
}

function buildOverpassQuery(
  selectors: string[],
  radiusMeters: number,
  latitude: number,
  longitude: number,
) {
  const around = `(around:${radiusMeters},${latitude.toFixed(5)},${longitude.toFixed(5)})`;
  const clauses = selectors.map((selector) => {
    const namedSelector = selector.endsWith("]") ? `${selector}["name"]` : selector;
    return `${namedSelector}${around};`;
  });

  return `[out:json][timeout:20];(${clauses.join("")});out center tags qt;`;
}

async function fetchOverpass(query: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_600);

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
    if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
    const payload = (await response.json()) as { elements?: OverpassElement[] };
    if (!Array.isArray(payload.elements)) throw new Error("Overpass returned no elements");
    return payload.elements;
  });

  try {
    const result = await Promise.any(attempts);
    controller.abort();
    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

function cleanArea(tags: Record<string, string>) {
  return (
    tags["addr:city"] ||
    tags["addr:place"] ||
    tags["addr:town"] ||
    tags["addr:village"] ||
    (tags["addr:county"] ? tags["addr:county"].replace(/\s+County$/i, "") : "") ||
    "Michigan"
  );
}

function externalWebsite(tags: Record<string, string>) {
  const website = tags.website || tags["contact:website"] || tags.url;
  if (!website) return undefined;
  try {
    const parsed = new URL(website);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return parsed.toString();
  } catch {
    return undefined;
  }
  return undefined;
}

function osmPlaces(
  elements: OverpassElement[],
  args: {
    originLatitude: number;
    originLongitude: number;
    maxDriveHours: number;
    intent: ReturnType<typeof interpretOutdoorQuery>;
  },
): DiscoveryPlace[] {
  const seen = new Set<string>();
  const places: DiscoveryPlace[] = [];

  for (const element of elements) {
    const tags = element.tags ?? {};
    const name = (tags.name || tags["name:en"] || "").trim();
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (!name || latitude === undefined || longitude === undefined) continue;

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

    const category = categoryFromTags(tags);
    const categoryAccepted =
      args.intent.categories.includes(category) ||
      (category === "wildlife" && args.intent.categories.includes("park")) ||
      (category === "park" && args.intent.categories.includes("wildlife"));
    if (!categoryAccepted) continue;

    const dedupeKey = `${name.toLowerCase()}|${category}|${latitude.toFixed(3)}|${longitude.toFixed(3)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const website = externalWebsite(tags);
    const metrics = scoreDiscoveryCandidate({
      latitude,
      longitude,
      originLatitude: args.originLatitude,
      originLongitude: args.originLongitude,
      maxDriveHours: args.maxDriveHours,
      category,
      intent: args.intent,
      name,
      website,
    });

    const categoryName = categoryLabel(category);
    const traits = args.intent.traits
      .filter((trait) => ["quiet", "wild", "water", "short", "night"].includes(trait))
      .slice(0, 2)
      .map((trait) => trait.replace("-", " "));
    const traitLine = traits.length ? ` It fits the ${traits.join(" / ")} direction you described, but crowd level and access still need a current check.` : "";

    places.push({
      id: `osm:${element.type}:${element.id}`,
      name,
      area: cleanArea(tags),
      latitude,
      longitude,
      category,
      categoryLabel: categoryName,
      distanceMiles: metrics.distanceMiles,
      driveHours: metrics.driveHours,
      score: metrics.score,
      why: `${categoryName} matched to your outdoor search.${traitLine}`,
      source: "OpenStreetMap",
      sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${latitude.toFixed(6)},${longitude.toFixed(6)}`,
      ...(website ? { website } : {}),
    });
  }

  return places;
}

function mergePlaces(live: DiscoveryPlace[], curated: DiscoveryPlace[]) {
  const all = [...live, ...curated].sort(
    (a, b) =>
      b.score - a.score ||
      a.driveHours - b.driveHours ||
      a.name.localeCompare(b.name),
  );

  const seen = new Set<string>();
  return all.filter((place) => {
    const key = place.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 40);
}

export async function POST(request: Request) {
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > 16_000) return invalid("That search is too large.");

  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 16_000) return invalid("That search is too large.");
    body = JSON.parse(raw);
  } catch {
    return invalid("Send a valid outdoor search.");
  }

  if (!isDiscoverRequest(body)) {
    return invalid("Check the starting place, search, and travel time, then try again.");
  }

  let origin;
  if (body.originCoordinates) {
    origin = {
      name: `${body.origin} area`,
      latitude: body.originCoordinates.latitude,
      longitude: body.originCoordinates.longitude,
    };
  } else {
    try {
      origin = await resolveMichiganOrigin(body.origin);
    } catch {
      return NextResponse.json(
        { error: "The location service is temporarily unavailable. Try a Michigan city or ZIP." },
        { status: 503, headers: responseHeaders },
      );
    }
  }

  if (!origin) return invalid("Enter a Michigan city or ZIP code.");

  const intent = interpretOutdoorQuery(body.query);

  // Curated results are the guaranteed first layer. Public POI enrichment is
  // optional and strictly time-bounded so a useful response never waits on it.
  const curated = curatedDiscoveryPlaces({
    destinations,
    intent,
    originLatitude: origin.latitude,
    originLongitude: origin.longitude,
    maxDriveHours: body.maxDriveHours,
  });

  const selectors = overpassSelectorsFor(intent);
  const overpassQuery = buildOverpassQuery(
    selectors,
    discoveryRadiusMeters(body.maxDriveHours),
    origin.latitude,
    origin.longitude,
  );
  const elements = await fetchOverpass(overpassQuery);
  const live = elements
    ? osmPlaces(elements, {
        originLatitude: origin.latitude,
        originLongitude: origin.longitude,
        maxDriveHours: body.maxDriveHours,
        intent,
      })
    : [];

  const places = mergePlaces(live, curated);
  const response: DiscoveryResponse = {
    origin,
    query: body.query.trim(),
    intent,
    places,
    generatedAt: new Date().toISOString(),
    status: elements ? "live" : "fallback",
    sourceNote: elements
      ? "Fast mapped-place enrichment from OpenStreetMap contributors is blended with Michigan Outdoors Now curated destinations. Drive times are rough planning estimates, not route-engine ETAs."
      : "Results are from the curated Michigan Outdoors Now destination set. Live mapped-place enrichment did not answer inside the fast-search budget, so it was skipped rather than delaying your results.",
  };

  console.info(
    JSON.stringify({
      event: "semantic_discovery_completed",
      maxDriveHours: body.maxDriveHours,
      categoryCount: intent.categories.length,
      activityCount: intent.activities.length,
      livePlaceCount: live.length,
      curatedPlaceCount: curated.length,
      returnedPlaceCount: places.length,
      status: response.status,
    }),
  );

  return NextResponse.json(response, { headers: responseHeaders });
}
