import { activityIds, type ActivityId, type DateChoice, type PlannerRequest } from "./types";

const validDates = new Set<DateChoice>(["today", "tomorrow", "weekend"]);
const validDriveHours = new Set([1, 2, 3, 5]);

export function serializePlannerFragment(request: PlannerRequest) {
  const params = new URLSearchParams({
    origin: request.origin.trim(),
    when: request.date,
    drive: String(request.maxDriveHours),
    do: request.activities.join(","),
    kids: request.kids ? "1" : "0",
    dog: request.dog ? "1" : "0",
    access: request.accessible ? "1" : "0",
  });

  return `#plan=${encodeURIComponent(params.toString())}`;
}

export function parsePlannerFragment(fragment: string): PlannerRequest | null {
  if (!fragment.startsWith("#plan=")) return null;

  try {
    const params = new URLSearchParams(decodeURIComponent(fragment.slice(6)));
    const origin = params.get("origin")?.trim() ?? "";
    const date = params.get("when") as DateChoice;
    const maxDriveHours = Number(params.get("drive"));
    const activities = (params.get("do") ?? "")
      .split(",")
      .filter((activity): activity is ActivityId => activityIds.includes(activity as ActivityId));

    if (
      origin.length < 2 ||
      origin.length > 80 ||
      !validDates.has(date) ||
      !validDriveHours.has(maxDriveHours) ||
      activities.length === 0 ||
      new Set(activities).size !== activities.length
    ) {
      return null;
    }

    return {
      origin,
      date,
      maxDriveHours,
      activities,
      kids: params.get("kids") === "1",
      dog: params.get("dog") === "1",
      accessible: params.get("access") === "1",
    };
  } catch {
    return null;
  }
}
