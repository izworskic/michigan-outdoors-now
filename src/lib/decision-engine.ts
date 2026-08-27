import type {
  ActivityDecisionSummary,
  ActivityId,
  DecisionConfidence,
  DecisionStatus,
  HourlyWeatherSignal,
  WeatherSnapshot,
} from "./types";

type DecisionSignals = {
  weather?: WeatherSnapshot | null;
  closure?: boolean;
  hazard?: boolean;
  swimHazard?: boolean;
  waveHeightFeet?: number | null;
  sourceCount?: number;
};

export type ActivityDecision = ActivityDecisionSummary & {
  reasons: string[];
  cautions: string[];
  hardStop: boolean;
};

export type CombinedDecision = {
  score: number | null;
  status: DecisionStatus;
  confidence: DecisionConfidence;
  bestWindow: string | null;
  summary: string;
  cautions: string[];
  activities: ActivityDecisionSummary[];
};

const waterActivities = new Set<ActivityId>(["paddling", "beaches"]);
const exposedActivities = new Set<ActivityId>(["hiking", "paddling", "beaches", "birding", "scenic"]);

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function statusForScore(score: number): DecisionStatus {
  if (score >= 88) return "excellent";
  if (score >= 74) return "good";
  if (score >= 58) return "fair";
  return "poor";
}

function confidenceFor(signals: DecisionSignals): DecisionConfidence {
  if (!signals.weather) return "low";
  if ((signals.sourceCount ?? 1) >= 3) return "high";
  if ((signals.sourceCount ?? 1) >= 2) return "medium";
  return "low";
}

function hourScore(activity: ActivityId, hour: HourlyWeatherSignal) {
  let score = 78;
  if (hour.precipitationProbability !== null) {
    if (hour.precipitationProbability <= 15) score += 8;
    else if (hour.precipitationProbability >= 70) score -= 22;
    else if (hour.precipitationProbability >= 45) score -= 10;
  }
  if (hour.windGust !== null) {
    if (hour.windGust <= 12) score += 5;
    else if (hour.windGust >= 30) score -= waterActivities.has(activity) ? 35 : 18;
    else if (hour.windGust >= 22) score -= waterActivities.has(activity) ? 20 : 8;
  }
  if (hour.temperature !== null) {
    if (hour.temperature >= 50 && hour.temperature <= 82) score += 5;
    if (hour.temperature < 30 || hour.temperature > 94) score -= 18;
  }
  if (activity === "dark-sky" && hour.cloudCover !== null) {
    if (hour.cloudCover <= 20) score += 15;
    else if (hour.cloudCover >= 70) score -= 35;
    else if (hour.cloudCover >= 50) score -= 18;
  }
  return clamp(score);
}

function hourNumber(time: string) {
  const match = time.match(/T(\d{2}):/);
  return match ? Number(match[1]) : null;
}

function formatHour(time: string) {
  const h = hourNumber(time);
  if (h === null) return time;
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12} ${suffix}`;
}

export function bestWindowForActivity(activity: ActivityId, weather: WeatherSnapshot | null | undefined) {
  const eligible = (weather?.hourly ?? []).filter((hour) => {
    const h = hourNumber(hour.time);
    if (h === null) return false;
    return activity === "dark-sky" ? h >= 20 || h <= 1 : h >= 7 && h <= 19;
  });
  if (eligible.length < 3) return null;

  let best: { start: string; end: string; score: number } | null = null;
  for (let index = 0; index <= eligible.length - 3; index += 1) {
    const window = eligible.slice(index, index + 3);
    const score = Math.round(window.reduce((sum, hour) => sum + hourScore(activity, hour), 0) / 3);
    if (!best || score > best.score) best = { start: window[0].time, end: window[2].time, score };
  }
  return best ? `${formatHour(best.start)}–${formatHour(best.end)}` : null;
}

export function evaluateActivity(activity: ActivityId, signals: DecisionSignals): ActivityDecision {
  const confidence = confidenceFor(signals);
  const weather = signals.weather ?? null;
  const reasons: string[] = [];
  const cautions: string[] = [];

  if (signals.closure) {
    return { activity, score: null, status: "closed", confidence: "high", bestWindow: null, reasons: ["Official access is closed."], cautions: ["Do not route a trip here until the closure is lifted."], hardStop: true };
  }
  if (signals.hazard || (activity === "beaches" && signals.swimHazard)) {
    return { activity, score: null, status: "danger", confidence: "high", bestWindow: null, reasons: ["A current hazard overrides otherwise favorable conditions."], cautions: ["Use the official hazard source before changing plans."], hardStop: true };
  }
  if (!weather) {
    return { activity, score: null, status: "insufficient", confidence: "low", bestWindow: null, reasons: ["Live weather inputs are unavailable."], cautions: ["No numeric conditions score is shown when the required live input is missing."], hardStop: false };
  }

  let score = 72;
  if (weather.precipitationProbability !== null) {
    if (weather.precipitationProbability <= 20) score += 9;
    else if (weather.precipitationProbability >= 75) score -= 22;
    else if (weather.precipitationProbability >= 50) score -= 10;
  }
  if (weather.windGust !== null) {
    if (weather.windGust <= 15) score += 6;
    else if (weather.windGust >= 35) score -= waterActivities.has(activity) ? 32 : 18;
    else if (weather.windGust >= 25) score -= waterActivities.has(activity) ? 20 : 8;
  }
  if (weather.high !== null) {
    if (weather.high >= 50 && weather.high <= 82) score += 6;
    if (weather.high < 28 || weather.high > 94) score -= 18;
  }
  if (weather.aqi !== null) {
    if (weather.aqi <= 50) score += 5;
    else if (weather.aqi > 150) score -= 40;
    else if (weather.aqi > 100) score -= 22;
    else if (weather.aqi > 75) score -= 8;
  }
  if (weather.weatherCode !== null && weather.weatherCode >= 95) {
    if (waterActivities.has(activity)) {
      return { activity, score: null, status: "danger", confidence, bestWindow: null, reasons: ["Thunderstorms are forecast for an exposed-water activity."], cautions: ["Do not use this planner as clearance to be on exposed water."], hardStop: true };
    }
    score -= 30;
    cautions.push("Thunderstorms are forecast; avoid exposed terrain and verify timing.");
  }
  if (activity === "dark-sky" && weather.cloudCover !== null) {
    if (weather.cloudCover <= 25) score += 14;
    else if (weather.cloudCover >= 70) score -= 30;
    else if (weather.cloudCover >= 50) score -= 15;
  }
  if (waterActivities.has(activity)) {
    if (signals.waveHeightFeet !== null && signals.waveHeightFeet !== undefined) {
      if (activity === "paddling" && signals.waveHeightFeet >= 3) {
        return { activity, score: null, status: "danger", confidence: "high", bestWindow: null, reasons: [`Wave height is about ${signals.waveHeightFeet.toFixed(1)} ft.`], cautions: ["Exposed-water paddling is not recommended by this decision model."], hardStop: true };
      }
      if (signals.waveHeightFeet >= 2) score -= 18;
    } else {
      cautions.push("Wave and marine-hazard data are not part of this score yet; verify the local marine or beach forecast.");
    }
  }
  if (exposedActivities.has(activity) && weather.aqi !== null && weather.aqi > 100) {
    cautions.push("Air quality reduces the recommendation for prolonged outdoor activity.");
  }

  const bestWindow = bestWindowForActivity(activity, weather);
  const finalScore = clamp(score);
  reasons.push(`Conditions fit: ${statusForScore(finalScore)} (${finalScore}/100).`);
  if (bestWindow) reasons.push(`Best three-hour window from available hourly data: ${bestWindow}.`);

  return { activity, score: finalScore, status: statusForScore(finalScore), confidence, bestWindow, reasons, cautions, hardStop: false };
}

export function evaluateActivities(activities: ActivityId[], signals: DecisionSignals): CombinedDecision {
  const results = [...new Set(activities)].map((activity) => evaluateActivity(activity, signals));
  const hardStop = results.find((result) => result.hardStop);
  const numeric = results.map((result) => result.score).filter((score): score is number => score !== null);
  const score = hardStop ? null : numeric.length ? Math.round(numeric.reduce((a, b) => a + b, 0) / numeric.length) : null;
  const status: DecisionStatus = results.some((result) => result.status === "closed") ? "closed"
    : results.some((result) => result.status === "danger") ? "danger"
    : score === null ? "insufficient" : statusForScore(score);
  const confidence: DecisionConfidence =
    results.every((result) => result.confidence === "high") ? "high" :
    results.some((result) => result.confidence === "low") ? "low" : "medium";
  const bestWindow = results.map((result) => result.bestWindow).find((value): value is string => Boolean(value)) ?? null;
  const summary = hardStop
    ? `Decision status: ${status.toUpperCase()} — a hard-stop condition overrides the fit score.`
    : score === null
      ? "Decision status: insufficient live data; no conditions score is manufactured."
      : `Decision status: ${status.toUpperCase()} at ${score}/100${bestWindow ? `; best window ${bestWindow}` : ""}.`;

  return {
    score, status, confidence, bestWindow, summary,
    cautions: [...new Set(results.flatMap((result) => result.cautions))],
    activities: results.map(({ activity, score: activityScore, status: activityStatus, confidence: activityConfidence, bestWindow: activityWindow }) => ({
      activity, score: activityScore, status: activityStatus, confidence: activityConfidence, bestWindow: activityWindow,
    })),
  };
}
