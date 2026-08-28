import { haversineMiles } from "./planner";
import { fetchRouteMatrix, type RoutedMatrix, type RoutingPoint } from "./route-intelligence";

export type DayPlanPlace = {
  id: string;
  name: string;
  area: string;
  latitude: number;
  longitude: number;
  category: string;
};

export type DayPlanLeg = {
  fromId: string;
  toId: string;
  driveMinutes: number;
  distanceMiles: number;
  source: "routed" | "estimated";
};

export type DayPlanStop = DayPlanPlace & {
  order: number;
  arrivalLabel: string;
  leaveLabel: string;
  suggestedMinutes: number;
};

export type DayPlanResponse = {
  generatedAt: string;
  source: "routed" | "estimated";
  totalDriveMinutes: number;
  totalDriveMiles: number;
  stops: DayPlanStop[];
  legs: DayPlanLeg[];
  note: string;
};

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) =>
    permutations(items.filter((_, itemIndex) => itemIndex !== index)).map((tail) => [
      item,
      ...tail,
    ]),
  );
}

function suggestedStopMinutes(category: string) {
  if (/paddl|river|water access/i.test(category)) return 180;
  if (/trail|hiking|natural area/i.test(category)) return 150;
  if (/beach|shore/i.test(category)) return 120;
  if (/waterfall|viewpoint|scenic/i.test(category)) return 75;
  return 90;
}

function formatDetroitTime(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Detroit",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function fallbackMatrix(points: RoutingPoint[]): RoutedMatrix {
  const durationsMinutes = points.map((from) =>
    points.map((to) => {
      if (from.id === to.id) return 0;
      const miles = haversineMiles(
        from.latitude,
        from.longitude,
        to.latitude,
        to.longitude,
      );
      return Math.max(1, Math.round((miles / 48) * 60));
    }),
  );
  const distancesMiles = points.map((from) =>
    points.map((to) => {
      if (from.id === to.id) return 0;
      return Number(
        haversineMiles(
          from.latitude,
          from.longitude,
          to.latitude,
          to.longitude,
        ).toFixed(1),
      );
    }),
  );
  return {
    pointIds: points.map((point) => point.id),
    durationsMinutes,
    distancesMiles,
  };
}

function routeCost(order: DayPlanPlace[], matrix: RoutedMatrix) {
  const indexById = new Map(matrix.pointIds.map((id, index) => [id, index]));
  let fromId = "__origin__";
  let minutes = 0;

  for (const stop of order) {
    const fromIndex = indexById.get(fromId);
    const toIndex = indexById.get(stop.id);
    if (fromIndex === undefined || toIndex === undefined) return Number.POSITIVE_INFINITY;
    const leg = matrix.durationsMinutes[fromIndex]?.[toIndex];
    if (typeof leg !== "number" || !Number.isFinite(leg)) return Number.POSITIVE_INFINITY;
    minutes += leg;
    fromId = stop.id;
  }

  return minutes;
}

function bestOrder(places: DayPlanPlace[], matrix: RoutedMatrix) {
  return permutations(places)
    .map((order) => ({ order, cost: routeCost(order, matrix) }))
    .sort(
      (a, b) =>
        a.cost - b.cost ||
        a.order.map((stop) => stop.name).join("|").localeCompare(
          b.order.map((stop) => stop.name).join("|"),
        ),
    )[0];
}

export async function buildDayPlan(args: {
  origin: { name: string; latitude: number; longitude: number };
  places: DayPlanPlace[];
  startAt?: Date;
}): Promise<DayPlanResponse> {
  const places = args.places.slice(0, 3);
  const points: RoutingPoint[] = [
    {
      id: "__origin__",
      latitude: args.origin.latitude,
      longitude: args.origin.longitude,
    },
    ...places.map((place) => ({
      id: place.id,
      latitude: place.latitude,
      longitude: place.longitude,
    })),
  ];

  const routedMatrix = await fetchRouteMatrix({ points, timeoutMs: 1_800 });
  const fallback = fallbackMatrix(points);
  const routedBest = routedMatrix ? bestOrder(places, routedMatrix) : null;
  const useRouted = Boolean(routedBest && Number.isFinite(routedBest.cost));
  const matrix = useRouted && routedMatrix ? routedMatrix : fallback;
  const selected = useRouted && routedBest ? routedBest : bestOrder(places, fallback);
  const indexById = new Map(matrix.pointIds.map((id, index) => [id, index]));
  const source: DayPlanResponse["source"] = useRouted ? "routed" : "estimated";
  const legs: DayPlanLeg[] = [];
  const stops: DayPlanStop[] = [];
  let current = args.startAt ? new Date(args.startAt) : new Date();
  let fromId = "__origin__";
  let totalDriveMinutes = 0;
  let totalDriveMiles = 0;

  selected.order.forEach((stop, index) => {
    const fromIndex = indexById.get(fromId) ?? 0;
    const toIndex = indexById.get(stop.id) ?? 0;
    const driveMinutes = matrix.durationsMinutes[fromIndex]?.[toIndex] ?? 0;
    const distanceMiles = matrix.distancesMiles[fromIndex]?.[toIndex] ?? 0;

    current = new Date(current.getTime() + driveMinutes * 60_000);
    const arrivalLabel = formatDetroitTime(current);
    const suggestedMinutes = suggestedStopMinutes(stop.category);
    current = new Date(current.getTime() + suggestedMinutes * 60_000);
    const leaveLabel = formatDetroitTime(current);

    legs.push({
      fromId,
      toId: stop.id,
      driveMinutes,
      distanceMiles,
      source,
    });
    stops.push({
      ...stop,
      order: index + 1,
      arrivalLabel,
      leaveLabel,
      suggestedMinutes,
    });

    totalDriveMinutes += driveMinutes;
    totalDriveMiles += distanceMiles;
    fromId = stop.id;
  });

  return {
    generatedAt: new Date().toISOString(),
    source,
    totalDriveMinutes,
    totalDriveMiles: Number(totalDriveMiles.toFixed(1)),
    stops,
    legs,
    note:
      source === "routed"
        ? "Stop order minimizes routed driving from your starting point across the kept places. Time at each stop is a planning suggestion, not an official itinerary."
        : "The routing service did not answer inside the fast budget, so stop order and travel remain straight-line planning estimates.",
  };
}
