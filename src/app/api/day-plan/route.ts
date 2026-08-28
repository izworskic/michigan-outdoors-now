import { NextResponse } from "next/server";
import { buildDayPlan, type DayPlanPlace } from "../../../lib/day-plan";
import { isPlausibleMichiganCoordinate } from "../../../lib/planner";

export const runtime = "nodejs";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

function validPlace(value: unknown): value is DayPlanPlace {
  if (!value || typeof value !== "object") return false;
  const place = value as Record<string, unknown>;
  return (
    typeof place.id === "string" &&
    place.id.length > 0 &&
    place.id.length <= 140 &&
    typeof place.name === "string" &&
    place.name.length > 0 &&
    place.name.length <= 160 &&
    typeof place.area === "string" &&
    place.area.length <= 160 &&
    typeof place.category === "string" &&
    place.category.length <= 80 &&
    typeof place.latitude === "number" &&
    typeof place.longitude === "number" &&
    isPlausibleMichiganCoordinate(place.latitude, place.longitude)
  );
}

function validRequest(value: unknown) {
  if (!value || typeof value !== "object") return false;
  const request = value as Record<string, unknown>;
  const origin = request.origin as Record<string, unknown> | undefined;
  return (
    origin !== undefined &&
    typeof origin.name === "string" &&
    origin.name.length > 0 &&
    origin.name.length <= 100 &&
    typeof origin.latitude === "number" &&
    typeof origin.longitude === "number" &&
    isPlausibleMichiganCoordinate(origin.latitude, origin.longitude) &&
    Array.isArray(request.places) &&
    request.places.length >= 2 &&
    request.places.length <= 3 &&
    request.places.every(validPlace)
  );
}

export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 12_000) {
      return NextResponse.json({ error: "Day-plan request is too large." }, { status: 400, headers });
    }
    const body = JSON.parse(raw) as unknown;
    if (!validRequest(body)) {
      return NextResponse.json(
        { error: "Keep two or three valid Michigan places before building the day." },
        { status: 400, headers },
      );
    }

    const requestBody = body as {
      origin: { name: string; latitude: number; longitude: number };
      places: DayPlanPlace[];
    };
    const result = await buildDayPlan(requestBody);

    console.info(
      JSON.stringify({
        event: "day_plan_built",
        stopCount: result.stops.length,
        routeSource: result.source,
        totalDriveMinutes: result.totalDriveMinutes,
      }),
    );

    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json(
      { error: "Could not build the day from those places." },
      { status: 500, headers },
    );
  }
}
