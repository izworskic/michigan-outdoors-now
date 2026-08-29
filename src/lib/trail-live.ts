import type { TrailProfile } from "../data/trail-profiles";
import type { PlaceIntelligence } from "./place-intelligence";
import { estimateHikeTimeRange } from "./trail-planning";

export type DaylightFit = {
  status: "comfortable" | "tight" | "insufficient" | "unknown";
  headline: string;
  marginMinutes: number | null;
};

export type TrailLiveSignal = {
  status: "good" | "mixed" | "poor" | "unknown";
  headline: string;
  reasons: string[];
  cautions: string[];
  daylight: DaylightFit;
};

export function assessDaylightFit(
  profile: TrailProfile,
  daylightHoursRemaining: number | null | undefined,
): DaylightFit {
  const range = estimateHikeTimeRange(profile.distanceMiles, profile.difficulty);
  if (!range || typeof daylightHoursRemaining !== "number" || !Number.isFinite(daylightHoursRemaining)) {
    return {
      status: "unknown",
      headline: "Daylight margin is not available.",
      marginMinutes: null,
    };
  }

  const remainingMinutes = Math.max(0, Math.round(daylightHoursRemaining * 60));
  const comfortableNeed = range.highMinutes + 45;
  const minimumNeed = range.lowMinutes + 30;
  const marginMinutes = remainingMinutes - comfortableNeed;

  if (remainingMinutes >= comfortableNeed) {
    return {
      status: "comfortable",
      headline: `About ${Math.floor(Math.max(0, marginMinutes) / 60)}h ${Math.max(0, marginMinutes) % 60}m beyond the conservative hike estimate.`,
      marginMinutes,
    };
  }
  if (remainingMinutes >= minimumNeed) {
    return {
      status: "tight",
      headline: "Possible, but the daylight margin is tighter than the conservative hiking estimate.",
      marginMinutes,
    };
  }
  return {
    status: "insufficient",
    headline: "The current daylight window is too short for a comfortable day-hike plan.",
    marginMinutes,
  };
}

export function deriveTrailLiveSignal(
  profile: TrailProfile,
  intelligence: PlaceIntelligence | null,
): TrailLiveSignal {
  if (!intelligence) {
    return {
      status: "unknown",
      headline: "Live trail fit is still being checked.",
      reasons: [],
      cautions: [],
      daylight: {
        status: "unknown",
        headline: "Daylight margin is not available.",
        marginMinutes: null,
      },
    };
  }

  const reasons: string[] = [];
  const cautions: string[] = [];
  const weather = intelligence.weather;
  const daylight = assessDaylightFit(profile, weather?.daylightHoursRemaining);

  if (intelligence.access.closureCount > 0) {
    cautions.push(
      `${intelligence.access.closureCount} nearby DNR closure item${intelligence.access.closureCount === 1 ? "" : "s"} returned.`,
    );
  }
  if (intelligence.access.rerouteCount > 0) {
    cautions.push(
      `${intelligence.access.rerouteCount} nearby DNR reroute item${intelligence.access.rerouteCount === 1 ? "" : "s"} returned.`,
    );
  }

  if (weather) {
    if (weather.recentRainInches !== null && weather.recentRainInches >= 0.5) {
      cautions.push(
        `${weather.recentRainInches.toFixed(2)} in of recent rain raises mud/soft-trail likelihood.`,
      );
    } else if (weather.recentRainInches !== null && weather.recentRainInches <= 0.15) {
      reasons.push("Recent rainfall is low.");
    }

    if (weather.windGust !== null && weather.windGust >= 35) {
      cautions.push(`Current gusts near ${Math.round(weather.windGust)} mph can make exposed sections unpleasant.`);
    } else if (weather.windGust !== null && weather.windGust < 22) {
      reasons.push(`Current gusts are around ${Math.round(weather.windGust)} mph or less.`);
    }

    if (weather.aqi !== null && weather.aqi >= 100) {
      cautions.push(`AQI is around ${Math.round(weather.aqi)}.`);
    } else if (weather.aqi !== null && weather.aqi < 75) {
      reasons.push(`AQI is around ${Math.round(weather.aqi)}.`);
    }

    const maxPrecip = weather.outingWindow?.maxPrecipitationProbability;
    if (maxPrecip !== null && maxPrecip !== undefined) {
      if (maxPrecip >= 60) cautions.push(`Near-term precipitation chance reaches ${Math.round(maxPrecip)}%.`);
      else if (maxPrecip <= 30) reasons.push(`Near-term precipitation chance stays near ${Math.round(maxPrecip)}% or less.`);
    }
  }

  if (daylight.status === "comfortable") reasons.push(daylight.headline);
  if (daylight.status === "tight" || daylight.status === "insufficient") cautions.push(daylight.headline);

  let status: TrailLiveSignal["status"] = "good";
  if (!weather && !intelligence.access.closureCount && !intelligence.access.rerouteCount) {
    status = "unknown";
  } else if (
    intelligence.access.closureCount > 0 ||
    daylight.status === "insufficient" ||
    (weather?.windGust ?? 0) >= 42 ||
    (weather?.aqi ?? 0) >= 150
  ) {
    status = "poor";
  } else if (cautions.length > 0 || intelligence.goSignal.status === "mixed") {
    status = "mixed";
  }

  const headline =
    status === "good"
      ? "Good planning fit right now."
      : status === "mixed"
        ? "Usable, with conditions worth checking."
        : status === "poor"
          ? "Choose carefully before committing to this route."
          : "Live trail fit is incomplete.";

  return { status, headline, reasons, cautions, daylight };
}

export function trailheadDirectionsUrl(profile: TrailProfile) {
  const label = profile.access?.trailhead;
  if (!label) return null;
  const query = encodeURIComponent(`${label}, ${profile.area}`);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}
