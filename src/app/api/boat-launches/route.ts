import { NextResponse } from "next/server";
import { fetchBoatLaunches } from "../../../lib/boat-launches";

export const runtime = "nodejs";

export async function GET() {
  const payload = await fetchBoatLaunches();
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
