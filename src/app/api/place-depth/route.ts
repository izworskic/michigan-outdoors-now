import { NextResponse } from "next/server";
import { fetchPlaceDepth } from "../../../lib/place-depth";
import { isPlausibleMichiganCoordinate } from "../../../lib/planner";

export const runtime = "nodejs";

type PlaceDepthRequest = {
  latitude: number;
  longitude: number;
  placeName?: string;
};

function validRequest(value: unknown): value is PlaceDepthRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Record<string, unknown>;
  const validPlaceName =
    request.placeName === undefined ||
    (typeof request.placeName === "string" && request.placeName.trim().length <= 120);
  return (
    typeof request.latitude === "number" &&
    typeof request.longitude === "number" &&
    Number.isFinite(request.latitude) &&
    Number.isFinite(request.longitude) &&
    isPlausibleMichiganCoordinate(request.latitude, request.longitude) &&
    validPlaceName
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 4_000) {
      return NextResponse.json({ error: "Place depth request is too large." }, { status: 400 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Send valid Michigan coordinates." }, { status: 400 });
  }

  if (!validRequest(body)) {
    return NextResponse.json({ error: "Choose a valid Michigan place." }, { status: 400 });
  }

  const result = await fetchPlaceDepth({
    latitude: body.latitude,
    longitude: body.longitude,
    ...(body.placeName ? { placeName: body.placeName.trim() } : {}),
  });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
