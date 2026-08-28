import type { DiscoveryPlace } from "./discovery";

const OSRM_BASE_URL = process.env.ROUTING_BASE_URL?.trim() || "https://router.project-osrm.org";

type OsrmTableResponse = {
  code?: string;
  durations?: Array<Array<number | null>>;
  distances?: Array<Array<number | null>>;
};

export type RoutedTravelSummary = {
  placeId: string;
  distanceMiles: number;
  driveHours: number;
  driveMinutes: number;
};

function toMiles(meters: number) {
  return meters / 1609.344;
}

export async function fetchRoutedTravel(args: {
  originLatitude: number;
  originLongitude: number;
  places: DiscoveryPlace[];
  maxPlaces?: number;
}): Promise<Map<string, RoutedTravelSummary>> {
  const selected = args.places.slice(0, Math.max(1, Math.min(24, args.maxPlaces ?? 20)));
  if (!selected.length) return new Map();

  const coordinates = [
    `${args.originLongitude.toFixed(6)},${args.originLatitude.toFixed(6)}`,
    ...selected.map((place) => `${place.longitude.toFixed(6)},${place.latitude.toFixed(6)}`),
  ];
  const destinations = selected.map((_, index) => String(index + 1)).join(";");
  const url =
    `${OSRM_BASE_URL}/table/v1/driving/${coordinates.join(";")}` +
    `?sources=0&destinations=${destinations}&annotations=duration,distance`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_250);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MichiganOutdoorsNow/1.0 (https://michiganoutdoorsnow.chrisizworski.com/)",
        Referer: "https://michiganoutdoorsnow.chrisizworski.com/",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return new Map();

    const payload = (await response.json()) as OsrmTableResponse;
    if (payload.code !== "Ok") return new Map();

    const durations = payload.durations?.[0] ?? [];
    const distances = payload.distances?.[0] ?? [];
    const result = new Map<string, RoutedTravelSummary>();

    selected.forEach((place, index) => {
      const seconds = durations[index];
      const meters = distances[index];
      if (
        typeof seconds !== "number" ||
        !Number.isFinite(seconds) ||
        typeof meters !== "number" ||
        !Number.isFinite(meters)
      ) {
        return;
      }

      const driveMinutes = Math.max(1, Math.round(seconds / 60));
      result.set(place.id, {
        placeId: place.id,
        distanceMiles: Math.max(1, Math.round(toMiles(meters))),
        driveHours: Number((driveMinutes / 60).toFixed(2)),
        driveMinutes,
      });
    });

    return result;
  } catch {
    return new Map();
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

export function applyRoutedTravel(
  places: DiscoveryPlace[],
  routed: Map<string, RoutedTravelSummary>,
): DiscoveryPlace[] {
  return places.map((place) => {
    const travel = routed.get(place.id);
    if (!travel) {
      return {
        ...place,
        travelSource: "estimated" as const,
      };
    }

    return {
      ...place,
      distanceMiles: travel.distanceMiles,
      driveHours: travel.driveHours,
      driveMinutes: travel.driveMinutes,
      travelSource: "routed" as const,
    };
  });
}
