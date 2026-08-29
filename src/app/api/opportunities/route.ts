import { NextResponse } from "next/server";
import { destinations } from "../../../data/destinations";
import { fetchWeatherSnapshots } from "../../../lib/live-data";
import { detectOutdoorOpportunities, type OpportunityResponse } from "../../../lib/opportunity-engine";
import { targetDateFor } from "../../../lib/planner";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const scope = new URL(request.url).searchParams.get("scope");
  const limit = scope === "all" ? destinations.length : 4;
  const targetDate = targetDateFor("today");
  const comparisonDate = targetDateFor("tomorrow");

  try {
    const [todayWeather, comparisonWeather] = await Promise.all([
      fetchWeatherSnapshots(destinations, targetDate),
      fetchWeatherSnapshots(destinations, comparisonDate),
    ]);

    const opportunities = detectOutdoorOpportunities(
      destinations,
      todayWeather,
      comparisonWeather,
      limit,
    );

    const response: OpportunityResponse = {
      generatedAt: new Date().toISOString(),
      targetDate,
      comparisonDate,
      status: opportunities.length ? "live" : "unavailable",
      opportunities,
      note: opportunities.length
        ? scope === "all"
          ? "Full conservative statewide opportunity set for local return-visit comparison. No user profile or saved-place list is sent to this endpoint."
          : "Flags unusually strong short-lived weather-fit windows. It does not replace closure, access, trail, marine, ice, or local hazard checks."
        : "No unusually strong statewide weather-fit window cleared the conservative opportunity threshold right now.",
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch {
    const response: OpportunityResponse = {
      generatedAt: new Date().toISOString(),
      targetDate,
      comparisonDate,
      status: "unavailable",
      opportunities: [],
      note: "Live opportunity detection is temporarily unavailable.",
    };

    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }
}
