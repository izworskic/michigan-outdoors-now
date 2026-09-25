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
  regionalOverpassSelectors,
  scoreDiscoveryCandidate,
  type DiscoveryPlace,
  type DiscoveryResponse,
} from "../../../lib/discovery";
import { fetchAuthoritativeDiscoveryPlaces } from "../../../lib/authoritative-discovery";
import { resolveMichiganOrigin } from "../../../lib/live-data";
import { applyRoutedTravel, fetchRoutedTravel } from "../../../lib/route-intelligence";
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
  minDriveHours?: number;
  surpriseMode?: boolean;
  breadth?: "focused" | "regional";
  maxResults?: number;
  excludePlaceIds?: string[];
  preferences?: {
    kids?: boolean;
    dog?: boolean;
    accessible?: boolean;
  };
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
    (request.minDriveHours === undefined ||
      (typeof request.minDriveHours === "number" &&
        Number.isFinite(request.minDriveHours) &&
        request.minDriveHours >= 0 &&
        request.minDriveHours < (request.maxDriveHours as number))) &&
    (request.surpriseMode === undefined || typeof request.surpriseMode === "boolean") &&
    (request.breadth === undefined || request.breadth === "focused" || request.breadth === "regional") &&
    (request.maxResults === undefined ||
      (Number.isInteger(request.maxResults) &&
        (request.maxResults as number) >= 10 &&
        (request.maxResults as number) <= 80)) &&
    (request.excludePlaceIds === undefined ||
      (Array.isArray(request.excludePlaceIds) &&
        request.excludePlaceIds.length <= 50 &&
        request.excludePlaceIds.every(
          (id) => typeof id === "string" && id.length > 0 && id.length <= 140,
        ))) &&
    (request.preferences === undefined ||
      (request.preferences !== null &&
        typeof request.preferences === "object" &&
        ["kids", "dog", "accessible"].every(
          (key) =>
            !(key in (request.preferences as Record<string, unknown>)) ||
            typeof (request.preferences as Record<string, unknown>)[key] === "boolean",
        ))) &&
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

async function fetchOverpass(query: string, disabled = false, timeoutMs = 1_600) {
  if (disabled) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
    minDriveHours: number;
    intent: ReturnType<typeof interpretOutdoorQuery>;
    regional: boolean;
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
      args.regional ||
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

    if (metrics.driveHours + 0.05 < args.minDriveHours) continue;

    const categoryName = categoryLabel(category);
    const traits = args.intent.traits
      .filter((trait) => ["quiet", "wild", "water", "short", "night"].includes(trait))
      .slice(0, 2)
      .map((trait) => trait.replace("-", " "));
    const effortCaution = args.intent.traits.includes("long")
      ? " This is a mapped trailhead or place candidate; exact route length and mileage are not verified here."
      : "";
    const traitLine = traits.length
      ? ` It fits the ${traits.join(" / ")} direction you described, but crowd level and access still need a current check.`
      : "";

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
      why: `${categoryName} matched to your outdoor search.${traitLine}${effortCaution}`,
      source: "OpenStreetMap",
      sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      directionsUrl: `https://www.google.com/maps/dir/?api=1&destination=${latitude.toFixed(6)},${longitude.toFixed(6)}`,
      ...(website ? { website } : {}),
    });
  }

  return places;
}

const HOUSEHOLD_MICHIGAN_DESTINATION_PATTERNS = [
  "sleeping bear",
  "pictured rocks",
  "tahquamenon",
  "mackinac",
  "porcupine mountains",
  "kitch-iti-kipi",
  "torch lake",
];

function surpriseRank(place: DiscoveryPlace) {
  const normalized = place.name.toLowerCase();
  const householdPenalty = HOUSEHOLD_MICHIGAN_DESTINATION_PATTERNS.some((pattern) =>
    normalized.includes(pattern),
  )
    ? 26
    : 0;
  const sourceCredibility = place.curatedPlaceId
    ? 10
    : place.source === "Huron-Clinton Metroparks" || place.source === "Oakland County" || place.source === "Kent County" || place.source === "Washtenaw County" || place.source === "The Nature Conservancy"
      ? 9
      : place.source === "Michigan DNR" || place.source === "U.S. Forest Service" || place.source === "National Park Service" || place.source === "U.S. Fish & Wildlife Service" || place.source === "USGS PAD-US"
        ? 8
        : 3;
  const discoveryBonus = ["wildlife", "cave", "viewpoint", "waterfall", "paddling"].includes(
    place.category,
  )
    ? 5
    : 0;
  const enoughDriveToFeelDifferent = place.driveHours >= 0.6 ? 3 : 0;

  return place.score + sourceCredibility + discoveryBonus + enoughDriveToFeelDifferent - householdPenalty;
}

function surprisePlaces(places: DiscoveryPlace[]) {
  return [...places].sort(
    (a, b) =>
      surpriseRank(b) - surpriseRank(a) ||
      b.score - a.score ||
      a.driveHours - b.driveHours ||
      a.name.localeCompare(b.name),
  );
}

function normalizedPlaceName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sourcePriority(place: DiscoveryPlace) {
  if (place.curatedPlaceId) return 8;
  if (place.source === "Huron-Clinton Metroparks" || place.source === "Oakland County" || place.source === "Kent County" || place.source === "Washtenaw County" || place.source === "The Nature Conservancy") return 7;
  if (place.source === "Michigan DNR" || place.source === "U.S. Forest Service" || place.source === "National Park Service" || place.source === "U.S. Fish & Wildlife Service" || place.source === "USGS PAD-US") return 6;
  if (place.source === "OpenStreetMap") return 1;
  return 4;
}

function mergePlaces(groups: DiscoveryPlace[][], limit: number) {
  const all = groups.flat().sort(
    (a, b) =>
      b.score + sourcePriority(b) - (a.score + sourcePriority(a)) ||
      a.driveHours - b.driveHours ||
      a.name.localeCompare(b.name),
  );

  const seen = new Set<string>();
  return all.filter((place) => {
    const key = normalizedPlaceName(place.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function driveBand(place: DiscoveryPlace) {
  if (place.driveHours <= 0.5) return "0-30";
  if (place.driveHours <= 1) return "30-60";
  if (place.driveHours <= 1.5) return "60-90";
  if (place.driveHours <= 2.25) return "90-135";
  return "far";
}

function regionalDiversityOrder(places: DiscoveryPlace[]) {
  const remaining = [...places];
  const result: DiscoveryPlace[] = [];
  const categoryCounts = new Map<string, number>();
  const areaCounts = new Map<string, number>();
  const driveCounts = new Map<string, number>();
  const sourceCounts = new Map<string, number>();

  while (remaining.length) {
    let bestIndex = 0;
    let bestValue = Number.NEGATIVE_INFINITY;

    remaining.forEach((place, index) => {
      const areaKey = place.area.toLowerCase() === "michigan" ? "" : place.area.toLowerCase();
      const categoryCount = categoryCounts.get(place.category) ?? 0;
      const areaCount = areaKey ? areaCounts.get(areaKey) ?? 0 : 0;
      const driveCount = driveCounts.get(driveBand(place)) ?? 0;
      const sourceCount = sourceCounts.get(place.source) ?? 0;
      const value =
        place.score +
        sourcePriority(place) -
        categoryCount * 5 -
        areaCount * 3 -
        driveCount * 2 -
        sourceCount * 0.6;

      if (
        value > bestValue ||
        (value === bestValue && place.score > remaining[bestIndex].score) ||
        (value === bestValue && place.score === remaining[bestIndex].score && place.name.localeCompare(remaining[bestIndex].name) < 0)
      ) {
        bestValue = value;
        bestIndex = index;
      }
    });

    const [chosen] = remaining.splice(bestIndex, 1);
    result.push(chosen);
    const areaKey = chosen.area.toLowerCase() === "michigan" ? "" : chosen.area.toLowerCase();
    categoryCounts.set(chosen.category, (categoryCounts.get(chosen.category) ?? 0) + 1);
    if (areaKey) areaCounts.set(areaKey, (areaCounts.get(areaKey) ?? 0) + 1);
    driveCounts.set(driveBand(chosen), (driveCounts.get(driveBand(chosen)) ?? 0) + 1);
    sourceCounts.set(chosen.source, (sourceCounts.get(chosen.source) ?? 0) + 1);
  }

  return result;
}

function countSources(places: DiscoveryPlace[]) {
  return places.reduce<Record<string, number>>((counts, place) => {
    counts[place.source] = (counts[place.source] ?? 0) + 1;
    return counts;
  }, {});
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
  const preferenceTraits = [
    body.preferences?.kids ? "family" : null,
    body.preferences?.dog ? "dog" : null,
    body.preferences?.accessible ? "accessible" : null,
  ].filter((trait): trait is "family" | "dog" | "accessible" => trait !== null);
  if (preferenceTraits.length) {
    intent.traits = [...new Set([...intent.traits, ...preferenceTraits])];
    intent.summary = `${intent.summary} · verified for ${preferenceTraits.map((trait) => trait.replace("-", " ")).join(", ")} fit`;
  }

  const minDriveHours = Math.max(0, body.minDriveHours ?? 0);
  const breadth = body.breadth ?? "focused";
  const regional = breadth === "regional";
  const resultLimit = body.maxResults ?? (regional ? 60 : 40);
  const strictPreferenceMode = preferenceTraits.length > 0;

  const curated = curatedDiscoveryPlaces({
    destinations,
    intent,
    originLatitude: origin.latitude,
    originLongitude: origin.longitude,
    maxDriveHours: body.maxDriveHours,
  }).filter((place) => place.driveHours + 0.05 >= minDriveHours);

  const selectors = regional ? regionalOverpassSelectors() : overpassSelectorsFor(intent);
  const overpassQuery = buildOverpassQuery(
    selectors,
    discoveryRadiusMeters(body.maxDriveHours),
    origin.latitude,
    origin.longitude,
  );

  const [elements, authoritativeState] = await Promise.all([
    fetchOverpass(overpassQuery, strictPreferenceMode, regional ? 3_500 : 1_600),
    !strictPreferenceMode
      ? fetchAuthoritativeDiscoveryPlaces({
          originLatitude: origin.latitude,
          originLongitude: origin.longitude,
          maxDriveHours: body.maxDriveHours,
          minDriveHours,
          intent,
        })
      : Promise.resolve({ places: [] as DiscoveryPlace[], sources: [] }),
  ]);

  const live = elements
    ? osmPlaces(elements, {
        originLatitude: origin.latitude,
        originLongitude: origin.longitude,
        maxDriveHours: body.maxDriveHours,
        minDriveHours,
        intent,
        regional,
      })
    : [];

  const authoritative = authoritativeState.places;

  const excludedIds = new Set(body.excludePlaceIds ?? []);
  const mergeLimit = Math.min(120, Math.max(resultLimit + 30, regional ? 90 : 50));
  const mergedPlaces = mergePlaces([curated, authoritative, live], mergeLimit)
    .filter((place) => !excludedIds.has(place.id));
  const preRoutePlaces = regional ? regionalDiversityOrder(mergedPlaces) : mergedPlaces;

  const routedTravel = await fetchRoutedTravel({
    originLatitude: origin.latitude,
    originLongitude: origin.longitude,
    places: preRoutePlaces,
    maxPlaces: Math.min(30, resultLimit),
  });
  const routedPlaces = applyRoutedTravel(preRoutePlaces, routedTravel)
    .filter(
      (place) =>
        place.driveHours <= body.maxDriveHours + 0.08 &&
        place.driveHours + 0.05 >= minDriveHours,
    );

  const orderedPlaces = body.surpriseMode
    ? surprisePlaces(routedPlaces)
    : regional
      ? regionalDiversityOrder(routedPlaces)
      : routedPlaces.sort(
          (a, b) =>
            b.score - a.score ||
            a.driveHours - b.driveHours ||
            a.name.localeCompare(b.name),
        );
  const places = orderedPlaces.slice(0, resultLimit);

  const authoritativeLive = authoritativeState.sources.some((source) => source.status === "live");
  const response: DiscoveryResponse = {
    origin,
    query: body.query.trim(),
    intent,
    places,
    generatedAt: new Date().toISOString(),
    status: elements || authoritativeLive ? "live" : "fallback",
    mode: body.surpriseMode ? "surprise" : "search",
    breadth,
    sourceNote: strictPreferenceMode
      ? `Results are limited to Michigan Outdoors Now destinations with verified household/access attributes for the saved preferences. ${routedTravel.size ? "Top results include best-effort routed driving times from OSRM." : "Drive times remain planning estimates."}`
      : regional
        ? `Regional discovery blends Michigan DNR parks, wildlife lands, campgrounds, boating/fishing access and trail systems, U.S. Forest Service recreation sites and trail systems, National Park Service units, U.S. Fish & Wildlife Service refuges/conservation areas, USGS PAD-US open-access local/regional/nonprofit protected lands, direct Huron-Clinton Metroparks/Oakland County/Kent County/Washtenaw County GIS, TNC Michigan open-access preserves, Michigan Outdoors Now curated places, and time-bounded OpenStreetMap enrichment. It returns a broad deterministic candidate set before live-condition and safety gates. ${routedTravel.size ? "The leading candidates include best-effort routed driving times; remaining places retain planning estimates." : "Drive times remain planning estimates."}`
        : elements
          ? `Fast OpenStreetMap enrichment is blended with Michigan Outdoors Now plus authoritative Michigan DNR, U.S. Forest Service, National Park Service, U.S. Fish & Wildlife Service, USGS PAD-US open-access protected-land inventories, plus direct Huron-Clinton Metroparks, Oakland County, Kent County and Washtenaw County GIS plus TNC Michigan open-access lands. ${routedTravel.size ? "Top results include best-effort routed driving times from OSRM; unrouted places fall back to planning estimates." : "Routing did not answer inside the fast budget, so drive times remain planning estimates."}`
          : authoritativeLive
            ? `Results blend Michigan Outdoors Now with authoritative Michigan DNR, U.S. Forest Service, National Park Service, U.S. Fish & Wildlife Service, USGS PAD-US open-access protected-land inventories, plus direct Huron-Clinton Metroparks, Oakland County, Kent County and Washtenaw County GIS plus TNC Michigan open-access lands. OpenStreetMap enrichment did not answer inside the fast-search budget. ${routedTravel.size ? "Top results include best-effort routed driving times from OSRM." : "Drive times remain planning estimates."}`
            : `Results are from the curated Michigan Outdoors Now destination set. External place enrichment did not answer inside the fast-search budget. ${routedTravel.size ? "Top results include best-effort routed driving times from OSRM." : "Drive times remain planning estimates."}`,
    universe: {
      discoveredCount: mergedPlaces.length,
      resultLimit,
      routedCount: routedTravel.size,
      sourceCounts: countSources(mergedPlaces),
      sourceStatus: authoritativeState.sources,
    },
  };

  console.info(
    JSON.stringify({
      event: "semantic_discovery_completed",
      breadth,
      maxDriveHours: body.maxDriveHours,
      minDriveHours,
      resultLimit,
      categoryCount: intent.categories.length,
      activityCount: intent.activities.length,
      livePlaceCount: live.length,
      curatedPlaceCount: curated.length,
      authoritativePlaceCount: authoritative.length,
      universePlaceCount: mergedPlaces.length,
      returnedPlaceCount: places.length,
      routedPlaceCount: routedTravel.size,
      surpriseMode: Boolean(body.surpriseMode),
      excludedPlaceCount: excludedIds.size,
      sourceCounts: response.universe?.sourceCounts,
      sourceStatus: authoritativeState.sources,
      status: response.status,
    }),
  );

  return NextResponse.json(response, { headers: responseHeaders });
}
