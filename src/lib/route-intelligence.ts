import type { DiscoveryPlace } from "./discovery";

const OSRM_BASE_URL = process.env.ROUTING_BASE_URL?.trim() || "https://router.project-osrm.org";

type OsrmTableResponse = {
  code?: string;
  durations?: Array<Array<number | null>>;
  distances?: Array<Array<number | null>>;
};

export type RoutingPoint = {
  id: string;
  latitude: number;
  longitude: number;
};

export type RoutedTravelSummary = {
  placeId: string;
  distanceMiles: number;
  driveHours: number;
  driveMinutes: number;
};

export type RoutedMatrix = {
  pointIds: string[];
  durationsMinutes: Array<Array<number | null>>;
  distancesMiles: Array<Array<number | null>>;
};

function toMiles(meters: number) {
  return meters / 1609.344;
}

function requestHeaders() {
  return {
    Accept: "application/json",
    "User-Agent": "MichiganOutdoorsNow/1.0 (https://michiganoutdoorsnow.chrisizworski.com/)",
    Referer: "https://michiganoutdoorsnow.chrisizworski.com/",
  };
}

export async function fetchRoutedPoints(args: {
  originLatitude: number;
  originLongitude: number;
  points: RoutingPoint[];
  maxPoints?: number;
  timeoutMs?: number;
}): Promise<Map<string, RoutedTravelSummary>> {
  const selected = args.points.slice(0, Math.max(1, Math.min(24, args.maxPoints ?? 20)));
  if (!selected.length) return new Map();

  const coordinates = [
    `${args.originLongitude.toFixed(6)},${args.originLatitude.toFixed(6)}`,
    ...selected.map((point) => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`),
  ];
  const destinations = selected.map((_, index) => String(index + 1)).join(";");
  const url =
    `${OSRM_BASE_URL}/table/v1/driving/${coordinates.join(";")}` +
    `?sources=0&destinations=${destinations}&annotations=duration,distance`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs ?? 900);

  try {
    const response = await fetch(url, {
      headers: requestHeaders(),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return new Map();

    const payload = (await response.json()) as OsrmTableResponse;
    if (payload.code !== "Ok") return new Map();

    const durations = payload.durations?.[0] ?? [];
    const distances = payload.distances?.[0] ?? [];
    const result = new Map<string, RoutedTravelSummary>();

    selected.forEach((point, index) => {
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
      result.set(point.id, {
        placeId: point.id,
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

export async function fetchRoutedTravel(args: {
  originLatitude: number;
  originLongitude: number;
  places: DiscoveryPlace[];
  maxPlaces?: number;
}): Promise<Map<string, RoutedTravelSummary>> {
  return fetchRoutedPoints({
    originLatitude: args.originLatitude,
    originLongitude: args.originLongitude,
    points: args.places.map((place) => ({
      id: place.id,
      latitude: place.latitude,
      longitude: place.longitude,
    })),
    maxPoints: args.maxPlaces,
    timeoutMs: 900,
  });
}

export async function fetchRouteMatrix(args: {
  points: RoutingPoint[];
  timeoutMs?: number;
}): Promise<RoutedMatrix | null> {
  const selected = args.points.slice(0, 5);
  if (selected.length < 2) return null;

  const coordinates = selected.map(
    (point) => `${point.longitude.toFixed(6)},${point.latitude.toFixed(6)}`,
  );
  const url =
    `${OSRM_BASE_URL}/table/v1/driving/${coordinates.join(";")}` +
    "?annotations=duration,distance";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs ?? 1_600);

  try {
    const response = await fetch(url, {
      headers: requestHeaders(),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as OsrmTableResponse;
    if (payload.code !== "Ok" || !payload.durations || !payload.distances) return null;

    const durationsMinutes = payload.durations.map((row) =>
      row.map((seconds) =>
        typeof seconds === "number" && Number.isFinite(seconds)
          ? Math.max(0, Math.round(seconds / 60))
          : null,
      ),
    );
    const distancesMiles = payload.distances.map((row) =>
      row.map((meters) =>
        typeof meters === "number" && Number.isFinite(meters)
          ? Number(toMiles(meters).toFixed(1))
          : null,
      ),
    );

    if (
      durationsMinutes.length !== selected.length ||
      distancesMiles.length !== selected.length
    ) {
      return null;
    }

    return {
      pointIds: selected.map((point) => point.id),
      durationsMinutes,
      distancesMiles,
    };
  } catch {
    return null;
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
