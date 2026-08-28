import { NextResponse } from "next/server";
import { destinations } from "../../../data/destinations";
import { fetchWeatherSnapshots, resolveMichiganOrigin } from "../../../lib/live-data";
import {
  isPlausibleMichiganCoordinate,
  rankDestinations,
  targetDatesFor,
} from "../../../lib/planner";
import { fetchRoutedPoints } from "../../../lib/route-intelligence";
import {
  activityIds,
  type ActivityId,
  type DateChoice,
  type PlannerRequest,
  type PlannerResponse,
} from "../../../lib/types";

export const runtime = "nodejs";

const responseHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

function invalid(message: string) {
  return NextResponse.json({ error: message }, { status: 400, headers: responseHeaders });
}

function isPlannerRequest(value: unknown): value is PlannerRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Record<string, unknown>;
  const allowedDates: DateChoice[] = ["today", "tomorrow", "weekend"];
  const allowedDriveHours = [1, 2, 3, 4, 5, 6, 7, 8];

  const coordinates = request.originCoordinates;
  const coordinateRecord = coordinates as Record<string, unknown> | undefined;
  const validCoordinates =
    coordinates === undefined ||
    (typeof coordinates === "object" &&
      coordinates !== null &&
      typeof coordinateRecord?.latitude === "number" &&
      typeof coordinateRecord.longitude === "number" &&
      isPlausibleMichiganCoordinate(
        coordinateRecord.latitude,
        coordinateRecord.longitude,
      ));

  return (
    typeof request.origin === "string" &&
    request.origin.trim().length >= 2 &&
    request.origin.trim().length <= 80 &&
    allowedDates.includes(request.date as DateChoice) &&
    allowedDriveHours.includes(request.maxDriveHours as number) &&
    Array.isArray(request.activities) &&
    request.activities.length <= activityIds.length &&
    request.activities.every(
      (activity) => typeof activity === "string" && activityIds.includes(activity as ActivityId),
    ) &&
    new Set(request.activities).size === request.activities.length &&
    typeof request.kids === "boolean" &&
    typeof request.dog === "boolean" &&
    typeof request.accessible === "boolean" &&
    validCoordinates
  );
}

export async function POST(request: Request) {
  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > 20_000) return invalid("That request is too large.");

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > 20_000) return invalid("That request is too large.");
    body = JSON.parse(rawBody);
  } catch {
    return invalid("Send a valid planner request.");
  }

  if (!isPlannerRequest(body)) {
    return invalid("Check the starting place and planner choices, then try again.");
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
        { error: "The location service is temporarily unavailable. Try a listed Michigan city." },
        { status: 503, headers: responseHeaders },
      );
    }
  }

  if (!origin) return invalid("Enter a Michigan city or ZIP code.");

  const targetDates = targetDatesFor(body.date);
  const rankedPlanSets = await Promise.all(
    targetDates.map(async (targetDate) => {
      let weatherByDestination = new Map();
      try {
        weatherByDestination = await fetchWeatherSnapshots(destinations, targetDate);
      } catch {
        // A distance-and-fit result remains useful when a live provider is unavailable.
      }

      return rankDestinations({
        latitude: origin.latitude,
        longitude: origin.longitude,
        originName: origin.name,
        maxDriveHours: body.maxDriveHours,
        activities: body.activities,
        kids: body.kids,
        dog: body.dog,
        accessible: body.accessible,
        weatherByDestination,
      }, destinations.length);
    }),
  );

  const candidatePlans = rankedPlanSets
    .flat()
    .sort(
      (a, b) =>
        Number(b.conditionsStatus === "live") - Number(a.conditionsStatus === "live") ||
        b.score - a.score ||
        a.driveHours - b.driveHours ||
        a.destination.name.localeCompare(b.destination.name),
    )
    .filter(
      (plan, index, all) =>
        all.findIndex((candidate) => candidate.destination.id === plan.destination.id) === index,
    );

  const destinationById = new Map(destinations.map((destination) => [destination.id, destination]));
  const routedTravel = await fetchRoutedPoints({
    originLatitude: origin.latitude,
    originLongitude: origin.longitude,
    points: candidatePlans
      .map((plan) => destinationById.get(plan.destination.id))
      .filter((destination): destination is (typeof destinations)[number] => Boolean(destination))
      .map((destination) => ({
        id: destination.id,
        latitude: destination.latitude,
        longitude: destination.longitude,
      })),
    maxPoints: 24,
    timeoutMs: 1_400,
  });

  const routedCandidatePlans = candidatePlans
    .map((plan) => {
      const routed = routedTravel.get(plan.destination.id);
      if (!routed) {
        return {
          ...plan,
          driveMinutes: Math.max(1, Math.round(plan.driveHours * 60)),
          travelSource: "estimated" as const,
        };
      }
      return {
        ...plan,
        distanceMiles: routed.distanceMiles,
        driveHours: routed.driveHours,
        driveMinutes: routed.driveMinutes,
        travelSource: "routed" as const,
      };
    })
    .filter((plan) => plan.driveHours <= body.maxDriveHours + 0.08);

  const plans = routedCandidatePlans.slice(0, 3);
  const rangeOptions = [...routedCandidatePlans]
    .sort(
      (a, b) =>
        a.driveHours - b.driveHours ||
        b.score - a.score ||
        a.destination.name.localeCompare(b.destination.name),
    )
    .map((plan) => ({
      destination: {
        id: plan.destination.id,
        name: plan.destination.name,
        area: plan.destination.area,
        summary: plan.destination.summary,
      },
      score: plan.score,
      distanceMiles: plan.distanceMiles,
      driveHours: plan.driveHours,
      driveMinutes: plan.driveMinutes,
      travelSource: plan.travelSource,
      conditionsStatus: plan.conditionsStatus,
      forecastDate: plan.weather?.date ?? null,
    }));

  const hasLiveConditions = plans.some((plan) => plan.conditionsStatus === "live");
  const response: PlannerResponse = {
    origin,
    targetDate: plans[0]?.weather?.date ?? targetDates[0],
    targetDates,
    generatedAt: new Date().toISOString(),
    conditionsStatus: hasLiveConditions ? "live" : "estimated",
    plans,
    rangeOptions,
    note: hasLiveConditions
      ? body.date === "weekend" && targetDates.length > 1
        ? "Both days of the current weekend were compared. Road-routed travel replaces rough estimates when the routing service answers inside the fast budget. Forecasts help rank options; check official closures and local conditions before leaving."
        : "Road-routed travel replaces rough estimates when the routing service answers inside the fast budget. Forecasts help rank options, but this is planning guidance, not a safety rating."
      : "Live forecast data was unavailable. Road-routed travel is still used when available; remaining values are clearly planning estimates. Check conditions and official closures before leaving.",
  };

  console.info(
    JSON.stringify({
      event: "planner_completed",
      target: body.date,
      driveHours: body.maxDriveHours,
      activityCount: body.activities.length,
      needsCount: Number(body.kids) + Number(body.dog) + Number(body.accessible),
      planCount: plans.length,
      rangeOptionCount: rangeOptions.length,
      routedPlanCount: routedCandidatePlans.filter((plan) => plan.travelSource === "routed").length,
      conditionsStatus: response.conditionsStatus,
    }),
  );

  return NextResponse.json(response, { headers: responseHeaders });
}
