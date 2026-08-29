export type TrailPlanningDifficulty =
  | "easy"
  | "moderate"
  | "challenging"
  | "rugged"
  | "strolling"
  | "hiking"
  | "mountain_hiking"
  | "demanding_mountain_hiking"
  | "alpine_hiking"
  | "demanding_alpine_hiking"
  | "difficult_alpine_hiking";

export type HikeTimeRange = {
  lowMinutes: number;
  highMinutes: number;
};

function difficultySpeeds(difficulty: string | null | undefined) {
  switch (difficulty) {
    case "easy":
    case "strolling":
      return { fastMph: 3.1, slowMph: 2.2 };
    case "moderate":
    case "hiking":
      return { fastMph: 2.8, slowMph: 1.9 };
    case "challenging":
    case "mountain_hiking":
      return { fastMph: 2.35, slowMph: 1.55 };
    case "rugged":
    case "demanding_mountain_hiking":
    case "alpine_hiking":
    case "demanding_alpine_hiking":
    case "difficult_alpine_hiking":
      return { fastMph: 2.0, slowMph: 1.25 };
    default:
      return { fastMph: 2.6, slowMph: 1.7 };
  }
}

function roundToQuarterHour(minutes: number) {
  return Math.max(15, Math.round(minutes / 15) * 15);
}

export function estimateHikeTimeRange(
  distanceMiles: number | null | undefined,
  difficulty?: string | null,
): HikeTimeRange | null {
  if (
    typeof distanceMiles !== "number" ||
    !Number.isFinite(distanceMiles) ||
    distanceMiles <= 0
  ) {
    return null;
  }

  const { fastMph, slowMph } = difficultySpeeds(difficulty);
  const lowMinutes = roundToQuarterHour((distanceMiles / fastMph) * 60);
  const highMinutes = roundToQuarterHour((distanceMiles / slowMph) * 60);

  return {
    lowMinutes: Math.min(lowMinutes, highMinutes),
    highMinutes: Math.max(lowMinutes, highMinutes),
  };
}

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  if (!remainder) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}

export function formatHikeTimeRange(range: HikeTimeRange | null) {
  if (!range) return null;
  if (range.lowMinutes === range.highMinutes) {
    return durationLabel(range.lowMinutes);
  }
  return `${durationLabel(range.lowMinutes)}–${durationLabel(range.highMinutes)}`;
}

export function trailRouteKindLabel(routeKind: string) {
  return routeKind.replaceAll("-", " ");
}
