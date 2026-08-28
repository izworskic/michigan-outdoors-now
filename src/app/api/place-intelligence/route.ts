import { NextResponse } from "next/server";
import { fetchPlaceIntelligence } from "../../../lib/place-intelligence";
import { isPlausibleMichiganCoordinate } from "../../../lib/planner";

export const runtime = "nodejs";

type IntelligenceRequest = {
  latitude: number;
  longitude: number;
};

function validRequest(value: unknown): value is IntelligenceRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Record<string, unknown>;
  return (
    typeof request.latitude === "number" &&
    typeof request.longitude === "number" &&
    Number.isFinite(request.latitude) &&
    Number.isFinite(request.longitude) &&
    isPlausibleMichiganCoordinate(request.latitude, request.longitude)
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > 4_000) {
      return NextResponse.json({ error: "Place request is too large." }, { status: 400 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Send valid Michigan coordinates." }, { status: 400 });
  }

  if (!validRequest(body)) {
    return NextResponse.json({ error: "Choose a valid Michigan place." }, { status: 400 });
  }

  try {
    const intelligence = await fetchPlaceIntelligence(body);
    return NextResponse.json(intelligence, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error: "Live place intelligence is temporarily unavailable.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "X-Robots-Tag": "noindex, nofollow",
        },
      },
    );
  }
}
