import { NextResponse } from "next/server";
import { destinations } from "../../../data/destinations";
import { fetchWeatherSnapshots, resolveMichiganOrigin } from "../../../lib/live-data";
import { rankDestinations, targetDateFor } from "../../../lib/planner";
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
  const allowedDriveHours = [1, 2, 3, 5];

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
    typeof request.accessible === "boolean"
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
  try {
    origin = await resolveMichiganOrigin(body.origin);
  } catch {
    return NextResponse.json(
      { error: "The location service is temporarily unavailable. Try a listed Michigan city." },
      { status: 503, headers: responseHeaders },
    );
  }

  if (!origin) return invalid("Enter a Michigan city or ZIP code.");

  const targetDate = targetDateFor(body.date);
  let weatherByDestination = new Map();
  try {
    weatherByDestination = await fetchWeatherSnapshots(destinations, targetDate);
  } catch {
    // A distance-and-fit result remains useful when a live provider is unavailable.
  }

  const plans = rankDestinations({
    latitude: origin.latitude,
    longitude: origin.longitude,
    originName: origin.name,
    maxDriveHours: body.maxDriveHours,
    activities: body.activities,
    kids: body.kids,
    dog: body.dog,
    accessible: body.accessible,
    weatherByDestination,
  });
  const hasLiveConditions = plans.some((plan) => plan.conditionsStatus === "live");
  const response: PlannerResponse = {
    origin,
    targetDate,
    generatedAt: new Date().toISOString(),
    conditionsStatus: hasLiveConditions ? "live" : "estimated",
    plans,
    note: hasLiveConditions
      ? "Forecasts help rank options, but this is planning guidance—not a safety rating. Check official closures and local conditions before leaving."
      : "Live forecast data was unavailable, so these are distance-and-fit suggestions. Check conditions and official closures before leaving.",
  };

  console.info(
    JSON.stringify({
      event: "planner_completed",
      target: body.date,
      driveHours: body.maxDriveHours,
      activityCount: body.activities.length,
      needsCount: Number(body.kids) + Number(body.dog) + Number(body.accessible),
      planCount: plans.length,
      conditionsStatus: response.conditionsStatus,
    }),
  );

  return NextResponse.json(response, { headers: responseHeaders });
}
