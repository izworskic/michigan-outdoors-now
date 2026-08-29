import { activityIds, type ActivityId } from "./types";

export const MY_OUTDOORS_STORAGE_KEY = "michigan-outdoors-now:my-outdoors:v1";
export const MY_OUTDOORS_EVENT = "michigan-outdoors-now:my-outdoors-updated";

export const tripShapes = ["quick", "half-day", "full-day", "weekend"] as const;
export type TripShape = (typeof tripShapes)[number];

export type RememberedPlace = {
  id: string;
  name: string;
  area: string;
  path: string;
  kind: "curated" | "discovery";
  savedAt: string;
};

export type RecentPlace = {
  id: string;
  name: string;
  area: string;
  path: string;
  viewedAt: string;
};

export type OpportunityBaseline = {
  checkedAt: string;
  qualifies: boolean;
  score: number | null;
  signalStrength: number | null;
  activity: ActivityId | null;
  kind: string | null;
};

export type MyOutdoorsProfile = {
  version: 1;
  homeOrigin: string;
  maxDriveHours: number;
  favoriteActivities: ActivityId[];
  kids: boolean;
  dog: boolean;
  accessible: boolean;
  tripShape: TripShape;
  favoriteRegions: string[];
  savedPlaces: RememberedPlace[];
  visitedPlaceIds: string[];
  recentPlaces: RecentPlace[];
  opportunityBaselines: Record<string, OpportunityBaseline>;
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

export function emptyMyOutdoorsProfile(): MyOutdoorsProfile {
  return {
    version: 1,
    homeOrigin: "",
    maxDriveHours: 2,
    favoriteActivities: ["hiking", "scenic"],
    kids: false,
    dog: false,
    accessible: false,
    tripShape: "half-day",
    favoriteRegions: [],
    savedPlaces: [],
    visitedPlaceIds: [],
    recentPlaces: [],
    opportunityBaselines: {},
    updatedAt: nowIso(),
  };
}

function cleanText(value: unknown, max = 80) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanDriveHours(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 2;
  return Math.max(1, Math.min(8, Math.round(numeric)));
}

function cleanActivities(value: unknown): ActivityId[] {
  if (!Array.isArray(value)) return ["hiking", "scenic"];
  const unique = [...new Set(
    value.filter((candidate): candidate is ActivityId =>
      activityIds.includes(candidate as ActivityId),
    ),
  )];
  return unique.length ? unique.slice(0, 8) : ["hiking", "scenic"];
}

function cleanTripShape(value: unknown): TripShape {
  return tripShapes.includes(value as TripShape) ? (value as TripShape) : "half-day";
}

function cleanRegions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, 60)).filter(Boolean))].slice(0, 12);
}

function cleanRememberedPlaces(value: unknown): RememberedPlace[] {
  if (!Array.isArray(value)) return [];
  const result: RememberedPlace[] = [];
  const seen = new Set<string>();

  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<RememberedPlace>;
    const id = cleanText(item.id, 120);
    const name = cleanText(item.name, 100);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    result.push({
      id,
      name,
      area: cleanText(item.area, 100),
      path: cleanText(item.path, 220) || `/places/${encodeURIComponent(id)}`,
      kind: item.kind === "discovery" ? "discovery" : "curated",
      savedAt: cleanText(item.savedAt, 40) || nowIso(),
    });
  }

  return result.slice(0, 24);
}


function cleanOpportunityBaselines(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, OpportunityBaseline>;
  }

  const output: Record<string, OpportunityBaseline> = {};
  for (const [rawId, rawValue] of Object.entries(value).slice(0, 40)) {
    const id = cleanText(rawId, 120);
    if (!id || !rawValue || typeof rawValue !== "object") continue;
    const item = rawValue as Partial<OpportunityBaseline>;
    const score =
      typeof item.score === "number" && Number.isFinite(item.score)
        ? Math.max(0, Math.min(100, Math.round(item.score)))
        : null;
    const signalStrength =
      typeof item.signalStrength === "number" && Number.isFinite(item.signalStrength)
        ? Math.max(0, Math.min(200, Number(item.signalStrength.toFixed(1))))
        : null;
    const activity =
      item.activity && activityIds.includes(item.activity as ActivityId)
        ? (item.activity as ActivityId)
        : null;

    output[id] = {
      checkedAt: cleanText(item.checkedAt, 40) || nowIso(),
      qualifies: Boolean(item.qualifies),
      score,
      signalStrength,
      activity,
      kind: cleanText(item.kind, 60) || null,
    };
  }

  return output;
}

function cleanRecentPlaces(value: unknown): RecentPlace[] {
  if (!Array.isArray(value)) return [];
  const result: RecentPlace[] = [];
  const seen = new Set<string>();

  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Partial<RecentPlace>;
    const id = cleanText(item.id, 120);
    const name = cleanText(item.name, 100);
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    result.push({
      id,
      name,
      area: cleanText(item.area, 100),
      path: cleanText(item.path, 220) || `/places/${encodeURIComponent(id)}`,
      viewedAt: cleanText(item.viewedAt, 40) || nowIso(),
    });
  }

  return result.slice(0, 24);
}

export function normalizeMyOutdoorsProfile(value: unknown): MyOutdoorsProfile {
  const fallback = emptyMyOutdoorsProfile();
  if (!value || typeof value !== "object") return fallback;
  const raw = value as Partial<MyOutdoorsProfile>;

  return {
    version: 1,
    homeOrigin: cleanText(raw.homeOrigin, 80),
    maxDriveHours: cleanDriveHours(raw.maxDriveHours),
    favoriteActivities: cleanActivities(raw.favoriteActivities),
    kids: Boolean(raw.kids),
    dog: Boolean(raw.dog),
    accessible: Boolean(raw.accessible),
    tripShape: cleanTripShape(raw.tripShape),
    favoriteRegions: cleanRegions(raw.favoriteRegions),
    savedPlaces: cleanRememberedPlaces(raw.savedPlaces),
    visitedPlaceIds: Array.isArray(raw.visitedPlaceIds)
      ? [...new Set(raw.visitedPlaceIds.map((item) => cleanText(item, 120)).filter(Boolean))].slice(0, 100)
      : [],
    recentPlaces: cleanRecentPlaces(raw.recentPlaces),
    opportunityBaselines: cleanOpportunityBaselines(raw.opportunityBaselines),
    updatedAt: cleanText(raw.updatedAt, 40) || fallback.updatedAt,
  };
}

export function readMyOutdoorsProfile(): MyOutdoorsProfile {
  if (typeof window === "undefined") return emptyMyOutdoorsProfile();
  try {
    const raw = window.localStorage.getItem(MY_OUTDOORS_STORAGE_KEY);
    return raw ? normalizeMyOutdoorsProfile(JSON.parse(raw)) : emptyMyOutdoorsProfile();
  } catch {
    return emptyMyOutdoorsProfile();
  }
}

export function writeMyOutdoorsProfile(profile: MyOutdoorsProfile) {
  const normalized = normalizeMyOutdoorsProfile({
    ...profile,
    updatedAt: nowIso(),
  });
  if (typeof window === "undefined") return normalized;

  try {
    window.localStorage.setItem(MY_OUTDOORS_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(MY_OUTDOORS_EVENT, { detail: normalized }));
  } catch {
    // Personalization is optional and must never block trip planning.
  }

  return normalized;
}

export function updateMyOutdoorsProfile(
  updater: (profile: MyOutdoorsProfile) => MyOutdoorsProfile,
) {
  return writeMyOutdoorsProfile(updater(readMyOutdoorsProfile()));
}

export function saveRememberedPlace(
  profile: MyOutdoorsProfile,
  place: Omit<RememberedPlace, "savedAt">,
) {
  const without = profile.savedPlaces.filter((item) => item.id !== place.id);
  return normalizeMyOutdoorsProfile({
    ...profile,
    savedPlaces: [{ ...place, savedAt: nowIso() }, ...without].slice(0, 24),
  });
}

export function removeRememberedPlace(profile: MyOutdoorsProfile, placeId: string) {
  return normalizeMyOutdoorsProfile({
    ...profile,
    savedPlaces: profile.savedPlaces.filter((item) => item.id !== placeId),
  });
}

export function toggleVisitedPlace(profile: MyOutdoorsProfile, placeId: string) {
  const visited = new Set(profile.visitedPlaceIds);
  if (visited.has(placeId)) visited.delete(placeId);
  else visited.add(placeId);
  return normalizeMyOutdoorsProfile({
    ...profile,
    visitedPlaceIds: [...visited],
  });
}

export function recordRecentPlace(
  profile: MyOutdoorsProfile,
  place: Omit<RecentPlace, "viewedAt">,
) {
  const without = profile.recentPlaces.filter((item) => item.id !== place.id);
  return normalizeMyOutdoorsProfile({
    ...profile,
    recentPlaces: [{ ...place, viewedAt: nowIso() }, ...without].slice(0, 24),
  });
}

export function tripShapeDriveHours(shape: TripShape) {
  if (shape === "quick") return 1;
  if (shape === "half-day") return 2;
  if (shape === "full-day") return 4;
  return 8;
}
