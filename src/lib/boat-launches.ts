export const BOAT_LAUNCH_API = "https://chrisizworski.com/api/boat-launches";
export const BOAT_LAUNCH_FINDER = "https://chrisizworski.com/michigan-boat-launches/";

export type BoatLaunchProperties = {
  id: string;
  name: string;
  waterbody: string | null;
  county: string | null;
  waterScope: "great-lakes" | "inland-or-other" | string | null;
  launchStatus: string | null;
  facilityCondition: string | null;
  lanes: number | null;
  trailerParking: number | null;
  piers: number | null;
  carryDown: boolean;
  fee: string | null;
  operator: string | null;
  verificationStatus: string | null;
  sourceLabel: string | null;
};

export type BoatLaunchFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: BoatLaunchProperties;
};

export type BoatLaunchGeoJson = {
  type: "FeatureCollection";
  features: BoatLaunchFeature[];
};

export type BoatLaunchResponse = {
  status: "live" | "unavailable";
  fetchedAt: string;
  source: {
    name: string;
    url: string;
    authority: "Michigan Department of Natural Resources + source-qualified municipal operators";
  };
  count: number;
  greatLakesCount: number;
  inlandCount: number;
  geojson: BoatLaunchGeoJson;
  note: string;
};

export type ExistingLaunchApiPayload = {
  fetched_at?: string;
  count?: number;
  great_lakes_count?: number;
  inland_or_other_count?: number;
  source?: string;
  source_url?: string;
  launches?: Array<Record<string, unknown>>;
};

function numberOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function emptyResponse(note: string): BoatLaunchResponse {
  return {
    status: "unavailable",
    fetchedAt: new Date().toISOString(),
    source: {
      name: "Michigan Boat Launches source adapter",
      url: BOAT_LAUNCH_API,
      authority: "Michigan Department of Natural Resources + source-qualified municipal operators",
    },
    count: 0,
    greatLakesCount: 0,
    inlandCount: 0,
    geojson: { type: "FeatureCollection", features: [] },
    note,
  };
}

export function normalizeBoatLaunchPayload(payload: ExistingLaunchApiPayload): BoatLaunchResponse {
  if (!Array.isArray(payload.launches)) throw new Error("Boat launch source returned no launch inventory");

  const features: BoatLaunchFeature[] = [];
  for (const launch of payload.launches) {
    const latitude = numberOrNull(launch.latitude);
    const longitude = numberOrNull(launch.longitude);
    const id = stringOrNull(launch.id);
    const name = stringOrNull(launch.name);
    if (latitude === null || longitude === null || !id || !name) continue;

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [longitude, latitude] },
      properties: {
        id,
        name,
        waterbody: stringOrNull(launch.waterbody),
        county: stringOrNull(launch.county),
        waterScope: stringOrNull(launch.waterScope),
        launchStatus: stringOrNull(launch.launchStatus),
        facilityCondition: stringOrNull(launch.facilityCondition),
        lanes: numberOrNull(launch.lanes),
        trailerParking: numberOrNull(launch.trailerParking),
        piers: numberOrNull(launch.piers),
        carryDown: launch.carryDown === true,
        fee: stringOrNull(launch.fee),
        operator: stringOrNull(launch.operator),
        verificationStatus: stringOrNull(launch.verificationStatus),
        sourceLabel: stringOrNull(launch.sourceLabel),
      },
    });
  }

  if (!features.length) throw new Error("Boat launch source returned no usable mapped launches");

  return {
    status: "live",
    fetchedAt: payload.fetched_at || new Date().toISOString(),
    source: {
      name: payload.source || "Michigan Boat Launches",
      url: payload.source_url || BOAT_LAUNCH_API,
      authority: "Michigan Department of Natural Resources + source-qualified municipal operators",
    },
    count: features.length,
    greatLakesCount: Number(payload.great_lakes_count) || features.filter((feature) => feature.properties.waterScope === "great-lakes").length,
    inlandCount: Number(payload.inland_or_other_count) || features.filter((feature) => feature.properties.waterScope === "inland-or-other").length,
    geojson: { type: "FeatureCollection", features },
    note: "Launches come from the existing Michigan Boat Launches source-qualified inventory. The atlas fails closed if that inventory is unavailable.",
  };
}

export async function fetchBoatLaunches(): Promise<BoatLaunchResponse> {
  try {
    const response = await fetch(BOAT_LAUNCH_API, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
      next: { revalidate: 1800 },
    });
    if (!response.ok) throw new Error(`Boat launch source returned ${response.status}`);

    const payload = (await response.json()) as ExistingLaunchApiPayload;
    return normalizeBoatLaunchPayload(payload);
  } catch {
    return emptyResponse("The existing Michigan Boat Launches inventory is temporarily unavailable. No launch pins are guessed or substituted.");
  }
}
