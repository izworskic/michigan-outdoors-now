import { NextResponse } from "next/server";
import { destinations } from "../../../../data/destinations";
import { fetchWeatherSnapshots } from "../../../../lib/live-data";
import { getDetroitDate } from "../../../../lib/planner";

export const runtime = "nodejs";

const headers = {
  "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ place: string }> },
) {
  const { place: slug } = await params;
  const destination = destinations.find((candidate) => candidate.id === slug);
  if (!destination) {
    return NextResponse.json({ error: "Unknown Michigan destination." }, { status: 404, headers });
  }

  const targetDate = getDetroitDate();
  try {
    const snapshots = await fetchWeatherSnapshots([destination], targetDate);
    const weather = snapshots.get(destination.id) ?? null;
    return NextResponse.json(
      {
        place: { id: destination.id, name: destination.name, area: destination.area },
        targetDate,
        generatedAt: new Date().toISOString(),
        conditionsStatus: weather ? "live" : "estimated",
        weather,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        place: { id: destination.id, name: destination.name, area: destination.area },
        targetDate,
        generatedAt: new Date().toISOString(),
        conditionsStatus: "estimated",
        weather: null,
      },
      { headers },
    );
  }
}
