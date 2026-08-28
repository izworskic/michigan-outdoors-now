import { destinations } from "../data/destinations";
import { guidesBySlug, type SearchGuide } from "../data/guides";
import { origins } from "../data/origins";
import { activityLabels, haversineMiles } from "./planner";
import type { Destination, Origin } from "./types";

export type SearchLandingIntent = {
  slug: string;
  guideSlug: string;
  label: string;
  h1: (origin: Origin) => string;
  title: (origin: Origin) => string;
  description: (origin: Origin) => string;
  promise: string;
};

export type SearchLandingPlace = Destination & {
  roughMiles: number;
  roughDriveHours: number;
  matchReason: string;
  fitScore: number;
};

export type SearchLanding = {
  origin: Origin;
  guide: SearchGuide;
  intent: SearchLandingIntent;
  places: SearchLandingPlace[];
  signature: string;
};

export const searchLandingIntents: SearchLandingIntent[] = [
  {
    slug: "family-day-trips",
    guideSlug: "family-day-trips",
    label: "Family day trips",
    h1: (origin) => `Family outdoor day trips from ${origin.name}`,
    title: (origin) => `Family Day Trips from ${origin.name} | Chris Izworski`,
    description: (origin) =>
      `Family outdoor day trips from ${origin.name}, Michigan, with practical drive windows, kid-friendly places, current conditions, and access checks.`,
    promise:
      "A useful family result needs more than a playground label: the place has to fit the drive, the group, and the conditions.",
  },
  {
    slug: "hiking",
    guideSlug: "hiking-day-trips",
    label: "Hiking day trips",
    h1: (origin) => `Hiking day trips from ${origin.name}`,
    title: (origin) => `Hiking Near ${origin.name}, MI | Chris Izworski`,
    description: (origin) =>
      `Find hiking day trips from ${origin.name}, Michigan. Compare trail settings, rough distance, current weather, access, and stronger alternatives before you drive.`,
    promise:
      "The closest trail is not always the best hiking day. Compare the character of the hike against the time it costs to reach it.",
  },
  {
    slug: "paddling",
    guideSlug: "paddling-day-trips",
    label: "Paddling day trips",
    h1: (origin) => `Paddling day trips from ${origin.name}`,
    title: (origin) => `Paddling Near ${origin.name}, MI | Chris Izworski`,
    description: (origin) =>
      `Find paddling day trips from ${origin.name}, Michigan. Compare rivers, inland water and shore options by distance, wind, weather, access, and trip fit.`,
    promise:
      "A paddling destination is only useful when the water type, access, weather, and drive all fit the day you are actually planning.",
  },
  {
    slug: "birding",
    guideSlug: "birding-day-trips",
    label: "Birding day trips",
    h1: (origin) => `Birding day trips from ${origin.name}`,
    title: (origin) => `Birding Near ${origin.name}, MI | Chris Izworski`,
    description: (origin) =>
      `Find Michigan birding day trips from ${origin.name}. Compare wetlands, shoreline, refuges and forest stops by distance, weather, access, and trip fit.`,
    promise:
      "This is a habitat-and-trip decision page, not a live sightings feed. Use it to choose where the day is worth spending.",
  },
  {
    slug: "dog-friendly",
    guideSlug: "dog-friendly-day-trips",
    label: "Dog-friendly outdoors",
    h1: (origin) => `Dog-friendly outdoor day trips from ${origin.name}`,
    title: (origin) => `Dog-Friendly Trips from ${origin.name} | Chris Izworski`,
    description: (origin) =>
      `Dog-friendly outdoor day trips from ${origin.name}, Michigan, with places that allow dogs plus practical distance, weather, access, and trip-fit context.`,
    promise:
      "Dog-friendly is a constraint, not the whole recommendation. The place still has to be worth the drive and fit the outdoor day you want.",
  },
  {
    slug: "lower-barrier",
    guideSlug: "lower-barrier-outdoors",
    label: "Lower-barrier outdoors",
    h1: (origin) => `Lower-barrier outdoor trips from ${origin.name}`,
    title: (origin) => `Lower-Barrier Outdoors from ${origin.name} | Chris Izworski`,
    description: (origin) =>
      `Lower-barrier Michigan outdoor trips from ${origin.name}, using curated accessibility-friendly places with distance, conditions, and official access to verify.`,
    promise:
      "Lower-barrier does not mean universally accessible. These are stronger starting points; verify the exact route, surface, facilities, and current access.",
  },
];

function matchesRequiredConstraints(destination: Destination, guide: SearchGuide) {
  if (guide.planner.kids && !destination.kidsFriendly) return false;
  if (guide.planner.dog && !destination.dogsAllowed) return false;
  if (guide.planner.accessible && !destination.accessibleFriendly) return false;
  return true;
}

function buildMatchReason(destination: Destination, guide: SearchGuide) {
  const matchingActivities = guide.planner.activities.filter((activity) =>
    destination.activities.includes(activity),
  );
  const labels = matchingActivities.map((activity) => activityLabels[activity].toLowerCase());
  const constraintReasons = [
    guide.planner.kids && destination.kidsFriendly ? "kid-friendly" : "",
    guide.planner.dog && destination.dogsAllowed ? "dogs allowed" : "",
    guide.planner.accessible && destination.accessibleFriendly ? "lower-barrier access" : "",
  ].filter(Boolean);

  const fit = [...labels, ...constraintReasons].join(" + ");
  return fit ? `${fit}. ${destination.setting}` : destination.setting;
}

function rankPlaces(origin: Origin, guide: SearchGuide): SearchLandingPlace[] {
  const roughMilesPerDriveHour = 48;
  const maxRoughMiles = guide.planner.maxDriveHours * roughMilesPerDriveHour;

  return destinations
    .filter((destination) => matchesRequiredConstraints(destination, guide))
    .map((destination) => {
      const activityMatches = guide.planner.activities.filter((activity) =>
        destination.activities.includes(activity),
      ).length;
      const roughMiles = haversineMiles(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude,
      );
      const constraintBonus =
        (guide.planner.kids && destination.kidsFriendly ? 14 : 0) +
        (guide.planner.dog && destination.dogsAllowed ? 14 : 0) +
        (guide.planner.accessible && destination.accessibleFriendly ? 18 : 0);
      const fitScore =
        activityMatches * 28 +
        constraintBonus +
        Math.max(0, 28 - roughMiles / 5);

      return {
        ...destination,
        roughMiles: Number(roughMiles.toFixed(1)),
        roughDriveHours: Number((roughMiles / roughMilesPerDriveHour).toFixed(1)),
        fitScore,
        matchReason: buildMatchReason(destination, guide),
      };
    })
    .filter((destination) => {
      const activityMatches = guide.planner.activities.some((activity) =>
        destination.activities.includes(activity),
      );
      return activityMatches && destination.roughMiles <= maxRoughMiles;
    })
    .sort(
      (a, b) =>
        b.fitScore - a.fitScore ||
        a.roughMiles - b.roughMiles ||
        a.name.localeCompare(b.name),
    )
    .slice(0, 8);
}

function buildCandidates(): SearchLanding[] {
  return searchLandingIntents.flatMap((intent) => {
    const guide = guidesBySlug.get(intent.guideSlug);
    if (!guide) return [];

    return origins
      .map((origin) => {
        const places = rankPlaces(origin, guide);
        return {
          origin,
          guide,
          intent,
          places,
          signature: places.slice(0, 4).map((place) => place.id).join("|"),
        };
      })
      .filter((landing) => landing.places.length >= 4);
  });
}

function removeNearDoorways(candidates: SearchLanding[]) {
  const seenSignatures = new Set<string>();
  const accepted: SearchLanding[] = [];

  for (const landing of candidates) {
    const signatureKey = `${landing.intent.slug}:${landing.signature}`;
    if (seenSignatures.has(signatureKey)) continue;
    seenSignatures.add(signatureKey);
    accepted.push(landing);
  }

  return accepted;
}

export const searchLandings = removeNearDoorways(buildCandidates());

export const searchLandingByKey = new Map(
  searchLandings.map((landing) => [
    `${landing.origin.slug}/${landing.intent.slug}`,
    landing,
  ]),
);

export function searchLandingsForOrigin(originSlug: string) {
  return searchLandings.filter((landing) => landing.origin.slug === originSlug);
}

export function searchLandingsForGuide(guideSlug: string) {
  return searchLandings.filter((landing) => landing.guide.slug === guideSlug);
}

export function landingDirectAnswer(landing: SearchLanding) {
  const [first, second, third] = landing.places;
  const names = [first?.name, second?.name, third?.name].filter(Boolean).join(", ");
  return `From ${landing.origin.name}, strong curated starting points for ${landing.intent.label.toLowerCase()} include ${names}. These are ranked from the local curated inventory using activity fit, group constraints, and rough distance; use the live planner below for routed drive time, weather, access, and current trip confidence.`;
}

export function landingQualitySummary() {
  const byIntent = Object.fromEntries(
    searchLandingIntents.map((intent) => [
      intent.slug,
      searchLandings.filter((landing) => landing.intent.slug === intent.slug).length,
    ]),
  );

  return {
    total: searchLandings.length,
    byIntent,
    originsCovered: new Set(searchLandings.map((landing) => landing.origin.slug)).size,
    exactDuplicateSignatures: 0,
    minimumPlacesPerLanding: Math.min(...searchLandings.map((landing) => landing.places.length)),
  };
}
