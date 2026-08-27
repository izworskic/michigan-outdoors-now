import { NextResponse } from "next/server";
import {
  fetchOutdoorUniverse,
  isUniverseLayerId,
  type UniverseLayerId,
} from "../../../lib/outdoor-universe";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawLayer = url.searchParams.get("layer") ?? "hiking";
  if (!isUniverseLayerId(rawLayer)) {
    return NextResponse.json(
      { error: "Choose a supported Michigan outdoor map layer." },
      { status: 400 },
    );
  }

  const payload = await fetchOutdoorUniverse(rawLayer as UniverseLayerId);
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
