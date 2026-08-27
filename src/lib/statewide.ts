import { destinations } from "../data/destinations";
import { evaluateActivity } from "./decision-engine";
import type { ActivityId, DecisionConfidence, DecisionStatus, Destination, WeatherSnapshot } from "./types";

export const statewideModeIds = ["best", "hiking", "scenic", "dark-sky"] as const;
export type StatewideMode = (typeof statewideModeIds)[number];

export type StatewidePick = {
  rank: number;
  destination: Pick<Destination, "id" | "name" | "area" | "summary" | "setting">;
  activity: ActivityId;
  activityLabel: string;
  score: number;
  status: DecisionStatus;
  confidence: DecisionConfidence;
  bestWindow: string | null;
  why: string;
  watch: string;
  weather: WeatherSnapshot;
};

export type StatewideResponse = {
  targetDate: string;
  generatedAt: string;
  mode: StatewideMode;
  conditionsStatus: "live" | "unavailable";
  picks: StatewidePick[];
  note: string;
};

const dayActivities: ActivityId[] = ["hiking", "scenic", "birding"];

export const statewideModeLabels: Record<StatewideMode, string> = {
  best: "Best overall",
  hiking: "Hiking",
  scenic: "Scenic",
  "dark-sky": "Dark sky",
};

const activityLabels: Partial<Record<ActivityId, string>> = {
  hiking: "Hiking",
  scenic: "Scenic outing",
  birding: "Birding",
  "dark-sky": "Dark sky",
};

function activitiesFor(destination: Destination, mode: StatewideMode) {
  if (mode === "best") return destination.activities.filter((activity) => dayActivities.includes(activity));
  const activity = mode as ActivityId;
  return destination.activities.includes(activity) ? [activity] : [];
}

function positiveReason(weather: WeatherSnapshot, activity: ActivityId) {
  const reasons: string[] = [];
  if (weather.precipitationProbability !== null && weather.precipitationProbability <= 20) reasons.push("low rain chance");
  if (weather.windGust !== null && weather.windGust <= 18) reasons.push("manageable wind");
  if (weather.high !== null && weather.high >= 50 && weather.high <= 82) reasons.push("comfortable temperature");
  if (weather.aqi !== null && weather.aqi <= 50) reasons.push("good air quality");
  if (activity === "dark-sky" && weather.cloudCover !== null && weather.cloudCover <= 25) reasons.push("low cloud cover");
  if (!reasons.length) return "It has the strongest activity-specific weather fit in the current statewide comparison.";
  return `Strong because of ${reasons.slice(0, 3).join(", ")}.`;
}

function watchReason(weather: WeatherSnapshot, activity: ActivityId) {
  if (weather.aqi !== null && weather.aqi > 100) return `AQI reaches ${Math.round(weather.aqi)}. Limit prolonged outdoor exertion and verify local air-quality guidance.`;
  if (weather.precipitationProbability !== null && weather.precipitationProbability >= 50) return `Rain chance reaches ${Math.round(weather.precipitationProbability)}%. Timing matters.`;
  if (weather.windGust !== null && weather.windGust >= 25) return `Peak gusts reach about ${Math.round(weather.windGust)} mph.`;
  if (activity === "dark-sky" && weather.cloudCover !== null && weather.cloudCover >= 50) return `Cloud cover averages about ${Math.round(weather.cloudCover)}%.`;
  return "Weather fit is only one layer. Check closures, access, trail, road, and local hazard information before leaving.";
}

export function rankStatewideDestinations(
  weatherByDestination: Map<string, WeatherSnapshot>,
  mode: StatewideMode,
  limit = 4,
): StatewidePick[] {
  const candidates = destinations.flatMap((destination) => {
    const weather = weatherByDestination.get(destination.id);
    if (!weather) return [];

    const activities = activitiesFor(destination, mode);
    if (!activities.length) return [];

    const evaluated = activities
      .map((activity) => ({ activity, decision: evaluateActivity(activity, { weather, sourceCount: weather.aqi === null ? 1 : 2 }) }))
      .filter((item) => item.decision.score !== null && !item.decision.hardStop)
      .sort((a, b) => (b.decision.score ?? 0) - (a.decision.score ?? 0));

    const best = evaluated[0];
    if (!best || best.decision.score === null) return [];

    return [{
      rank: 0,
      destination: {
        id: destination.id,
        name: destination.name,
        area: destination.area,
        summary: destination.summary,
        setting: destination.setting,
      },
      activity: best.activity,
      activityLabel: activityLabels[best.activity] ?? best.activity,
      score: best.decision.score,
      status: best.decision.status,
      confidence: best.decision.confidence,
      bestWindow: best.decision.bestWindow,
      why: positiveReason(weather, best.activity),
      watch: watchReason(weather, best.activity),
      weather,
    }];
  });

  return candidates
    .sort((a, b) => b.score - a.score || a.destination.name.localeCompare(b.destination.name))
    .slice(0, limit)
    .map((pick, index) => ({ ...pick, rank: index + 1 }));
}
