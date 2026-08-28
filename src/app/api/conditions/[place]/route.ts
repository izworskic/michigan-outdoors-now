import { NextResponse } from "next/server";
import { destinations } from "../../../../data/destinations";
import { fetchWeatherSnapshots } from "../../../../lib/live-data";
import { getDetroitDate } from "../../../../lib/planner";
import {
  fetchSpecialistSignals,
  specialistSignalsNeedWeather,
} from "../../../../lib/specialist-intelligence";

export const runtime = "nodejs";

const headers = {
  "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
  "X-Robots-Tag": "noindex, nofollow",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ place: string }> },
) {
  const { place: slug } = await params;
  const destination = destinations.find((candidate) => candidate.id === slug);
  if (!destination) {
    return NextResponse.json({ error: "Unknown Michigan destination." }, { status: 404, headers });
  }

  const today = getDetroitDate();
  const requestUrl = new URL(request.url);
  const signalsOnly = requestUrl.searchParams.get("signals") === "1";
  const requestedDate = requestUrl.searchParams.get("date");
  const maxDate = new Date(`${today}T12:00:00Z`);
  maxDate.setUTCDate(maxDate.getUTCDate() + 10);
  const maxDateString = maxDate.toISOString().slice(0, 10);
  const targetDate =
    requestedDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) &&
    requestedDate >= today &&
    requestedDate <= maxDateString
      ? requestedDate
      : today;
  try {
    const needsWeather = !signalsOnly || specialistSignalsNeedWeather(destination);
    const snapshots = needsWeather
      ? await fetchWeatherSnapshots([destination], targetDate)
      : new Map();
    const weather = snapshots.get(destination.id) ?? null;
    const specialistSignals = await fetchSpecialistSignals(destination, weather);

    if (signalsOnly) {
      return NextResponse.json(
        {
          place: { id: destination.id, name: destination.name, area: destination.area },
          generatedAt: new Date().toISOString(),
          specialistSignals,
        },
        { headers },
      );
    }

    return NextResponse.json(
      {
        place: { id: destination.id, name: destination.name, area: destination.area },
        targetDate,
        generatedAt: new Date().toISOString(),
        conditionsStatus: weather || specialistSignals.some((signal) => signal.kind === "live") ? "live" : "estimated",
        weather,
        specialistSignals,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      signalsOnly
        ? {
            place: { id: destination.id, name: destination.name, area: destination.area },
            generatedAt: new Date().toISOString(),
            specialistSignals: [],
          }
        : {
            place: { id: destination.id, name: destination.name, area: destination.area },
            targetDate,
            generatedAt: new Date().toISOString(),
            conditionsStatus: "estimated",
            weather: null,
            specialistSignals: [],
          },
      { headers },
    );
  }
}
