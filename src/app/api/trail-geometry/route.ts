import { NextResponse } from "next/server";
import { trailProfiles } from "../../../data/trail-profiles";
import { fetchTrailGeometry } from "../../../lib/trail-geometry";
import { isPlausibleMichiganCoordinate } from "../../../lib/planner";

export const runtime = "nodejs";

type TrailGeometryRequest = {
  profileId: string;
  latitude: number;
  longitude: number;
};

function validRequest(value: unknown): value is TrailGeometryRequest {
  if (!value || typeof value !== "object") return false;
  const request = value as Record<string, unknown>;
  return (
    typeof request.profileId === "string" &&
    request.profileId.length > 0 &&
    request.profileId.length <= 120 &&
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
      return NextResponse.json({ error: "Trail request is too large." }, { status: 400 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Send a valid trail request." }, { status: 400 });
  }

  if (!validRequest(body)) {
    return NextResponse.json({ error: "Choose a valid Michigan trail." }, { status: 400 });
  }

  const profile = trailProfiles.find((candidate) => candidate.id === body.profileId);
  if (!profile) {
    return NextResponse.json({ error: "Trail Truth profile not found." }, { status: 404 });
  }

  try {
    const result = await fetchTrailGeometry(profile, body.latitude, body.longitude);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, max-age=0, s-maxage=21600, stale-while-revalidate=86400",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Trail geometry is temporarily unavailable." },
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
