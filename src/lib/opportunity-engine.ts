import { evaluateActivity } from "./decision-engine";
import type { ActivityId, DecisionConfidence, DecisionStatus, Destination, WeatherSnapshot } from "./types";

export type OpportunityKind =
  | "standout-hike"
  | "scenic-break"
  | "clear-dark-sky"
  | "calm-paddling";

export type OutdoorOpportunity = {
  id: string;
  kind: OpportunityKind;
  destination: Pick<Destination, "id" | "name" | "area" | "setting">;
  activity: ActivityId;
  score: number;
  status: DecisionStatus;
  confidence: DecisionConfidence;
  bestWindow: string | null;
  title: string;
  whyNow: string;
  comparison: string;
  caveat: string;
  verifyLabel: string;
  verifyUrl: string;
  signalStrength: number;
};

export type OpportunityResponse = {
  generatedAt: string;
  targetDate: string;
  comparisonDate: string;
  status: "live" | "unavailable";
  checkedDestinationIds: string[];
  opportunities: OutdoorOpportunity[];
  note: string;
};

const supportedActivities: ActivityId[] = ["hiking", "scenic", "dark-sky", "paddling"];

function finite(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function passesActivityGuard(activity: ActivityId, weather: WeatherSnapshot) {
  const rain = finite(weather.precipitationProbability);
  const gust = finite(weather.windGust);
  const aqi = finite(weather.aqi);
  const clouds = finite(weather.cloudCover);

  if (aqi !== null && aqi > 75) return false;

  if (activity === "dark-sky") {
    if (clouds === null || clouds > 25) return false;
    return rain === null || rain <= 25;
  }

  if (activity === "paddling") {
    if (gust === null || gust > 14) return false;
    return rain === null || rain <= 20;
  }

  if (gust !== null && gust > 22) return false;
  return rain === null || rain <= 30;
}

function kindFor(activity: ActivityId): OpportunityKind {
  if (activity === "dark-sky") return "clear-dark-sky";
  if (activity === "paddling") return "calm-paddling";
  if (activity === "scenic") return "scenic-break";
  return "standout-hike";
}

function titleFor(activity: ActivityId) {
  if (activity === "dark-sky") return "A clear-sky window stands out";
  if (activity === "paddling") return "A calm-weather paddling lead stands out";
  if (activity === "scenic") return "A scenic weather window stands out";
  return "A hiking window stands out";
}

function verificationFor(activity: ActivityId, destination: Destination) {
  if (activity === "dark-sky") {
    return {
      label: "Check aurora alignment",
      url: "https://chrisizworski.com/northern-lights-michigan/",
    };
  }
  if (activity === "paddling") {
    return {
      label: "Verify waves and marine conditions",
      url: "https://chrisizworski.com/great-lakes-buoys/",
    };
  }
  return {
    label: "Open the full place decision",
    url: `/places/${destination.id}`,
  };
}

function caveatFor(activity: ActivityId) {
  if (activity === "paddling") {
    return "Weather-only lead. This does not include local waves, currents, marine hazards, launch status, or cold-water risk. Verify the specialist marine/buoy view before launching.";
  }
  if (activity === "dark-sky") {
    return "Clear weather is only one part of a dark-sky or aurora decision. Confirm space weather, moonlight, access, and local cloud changes before driving.";
  }
  return "Opportunity means unusually strong weather fit, not a safety clearance. Check closures, access, trail, road, and local hazard information before leaving.";
}

type Candidate = {
  destination: Destination;
  activity: ActivityId;
  score: number;
  tomorrowScore: number | null;
  status: DecisionStatus;
  confidence: DecisionConfidence;
  bestWindow: string | null;
  weather: WeatherSnapshot;
};

export function detectOutdoorOpportunities(
  destinations: Destination[],
  todayWeather: Map<string, WeatherSnapshot>,
  comparisonWeather: Map<string, WeatherSnapshot>,
  limit = 4,
): OutdoorOpportunity[] {
  const candidates: Candidate[] = [];

  for (const destination of destinations) {
    const weather = todayWeather.get(destination.id);
    if (!weather) continue;

    for (const activity of supportedActivities) {
      if (!destination.activities.includes(activity)) continue;
      if (!passesActivityGuard(activity, weather)) continue;

      const decision = evaluateActivity(activity, {
        weather,
        sourceCount: weather.aqi === null ? 1 : 2,
      });
      if (decision.hardStop || decision.score === null || decision.score < 88) continue;

      const tomorrow = comparisonWeather.get(destination.id) ?? null;
      const tomorrowDecision = tomorrow
        ? evaluateActivity(activity, {
            weather: tomorrow,
            sourceCount: tomorrow.aqi === null ? 1 : 2,
          })
        : null;

      candidates.push({
        destination,
        activity,
        score: decision.score,
        tomorrowScore: tomorrowDecision?.score ?? null,
        status: decision.status,
        confidence: decision.confidence,
        bestWindow: decision.bestWindow,
        weather,
      });
    }
  }

  const peerMedian = new Map<ActivityId, number>();
  for (const activity of supportedActivities) {
    peerMedian.set(
      activity,
      median(candidates.filter((item) => item.activity === activity).map((item) => item.score)),
    );
  }

  const opportunities = candidates.flatMap((candidate) => {
    const medianScore = peerMedian.get(candidate.activity) ?? candidate.score;
    const vsMedian = candidate.score - medianScore;
    const vsTomorrow =
      candidate.tomorrowScore === null ? 0 : candidate.score - candidate.tomorrowScore;

    if (candidate.score < 92 && vsMedian < 10 && vsTomorrow < 8) return [];

    const comparison =
      vsTomorrow >= 8
        ? `About ${Math.round(vsTomorrow)} points stronger than tomorrow's weather fit here.`
        : vsMedian >= 10
          ? `About ${Math.round(vsMedian)} points stronger than today's statewide ${candidate.activity.replace("-", " ")} median.`
          : "Conditions clear a very high absolute fit threshold today.";

    const whyBits: string[] = [];
    const rain = finite(candidate.weather.precipitationProbability);
    const gust = finite(candidate.weather.windGust);
    const clouds = finite(candidate.weather.cloudCover);
    const aqi = finite(candidate.weather.aqi);
    if (rain !== null && rain <= 20) whyBits.push(`${Math.round(rain)}% rain chance`);
    if (gust !== null && gust <= 15) whyBits.push(`gusts around ${Math.round(gust)} mph`);
    if (candidate.activity === "dark-sky" && clouds !== null) {
      whyBits.push(`${Math.round(clouds)}% cloud cover`);
    }
    if (aqi !== null && aqi <= 50) whyBits.push(`AQI ${Math.round(aqi)}`);
    if (candidate.bestWindow) whyBits.push(`best window ${candidate.bestWindow}`);

    const verification = verificationFor(candidate.activity, candidate.destination);

    return [{
      id: `${candidate.destination.id}-${candidate.activity}`,
      kind: kindFor(candidate.activity),
      destination: {
        id: candidate.destination.id,
        name: candidate.destination.name,
        area: candidate.destination.area,
        setting: candidate.destination.setting,
      },
      activity: candidate.activity,
      score: candidate.score,
      status: candidate.status,
      confidence: candidate.confidence,
      bestWindow: candidate.bestWindow,
      title: titleFor(candidate.activity),
      whyNow: whyBits.length
        ? `Strong today because of ${whyBits.slice(0, 4).join(", ")}.`
        : "Today's conditions are unusually favorable in the statewide comparison.",
      comparison,
      caveat: caveatFor(candidate.activity),
      verifyLabel: verification.label,
      verifyUrl: verification.url,
      signalStrength:
        candidate.score + Math.max(0, vsTomorrow) * 0.7 + Math.max(0, vsMedian) * 0.4,
    } satisfies OutdoorOpportunity];
  });

  const bestByDestination = new Map<string, OutdoorOpportunity>();
  for (const opportunity of opportunities.sort((a, b) => b.signalStrength - a.signalStrength)) {
    if (!bestByDestination.has(opportunity.destination.id)) {
      bestByDestination.set(opportunity.destination.id, opportunity);
    }
  }

  return [...bestByDestination.values()]
    .sort((a, b) => b.signalStrength - a.signalStrength)
    .slice(0, limit);
}
