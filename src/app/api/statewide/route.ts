import { NextResponse } from "next/server";
import { destinations } from "../../../data/destinations";
import { fetchWeatherSnapshots } from "../../../lib/live-data";
import { targetDateFor } from "../../../lib/planner";
import { rankStatewideDestinations, statewideModeIds, type StatewideMode, type StatewideResponse } from "../../../lib/statewide";
import type { DateChoice } from "../../../lib/types";

export const runtime = "nodejs";

const dates: DateChoice[] = ["today", "tomorrow", "weekend"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = (url.searchParams.get("date") ?? "today") as DateChoice;
  const mode = (url.searchParams.get("mode") ?? "best") as StatewideMode;

  if (!dates.includes(date) || !statewideModeIds.includes(mode)) {
    return NextResponse.json({ error: "Choose a valid date and activity view." }, { status: 400 });
  }

  const targetDate = targetDateFor(date);
  let weatherByDestination = new Map();

  try {
    weatherByDestination = await fetchWeatherSnapshots(destinations, targetDate);
  } catch {
    // The response below keeps the truth boundary explicit.
  }

  const picks = rankStatewideDestinations(weatherByDestination, mode);
  const response: StatewideResponse = {
    targetDate,
    generatedAt: new Date().toISOString(),
    mode,
    conditionsStatus: picks.length ? "live" : "unavailable",
    picks,
    note: picks.length
      ? "Ranks weather and air-quality fit across curated destinations. It does not replace closure, trail, road, marine, or local hazard checks."
      : "Live statewide conditions are temporarily unavailable. Use the verified specialist tools or personalize a trip below.",
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
