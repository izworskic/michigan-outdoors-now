import { destinations } from "../data/destinations";
import type { ActivityId, Destination } from "./types";
import { activityLabels, haversineMiles } from "./planner";

export const regionIds = [
  "upper-peninsula",
  "northern-lower",
  "west-michigan",
  "central-east",
  "southeast-michigan",
] as const;

export type RegionId = (typeof regionIds)[number];

export const regionLabels: Record<RegionId, string> = {
  "upper-peninsula": "Upper Peninsula",
  "northern-lower": "Northern Lower Peninsula",
  "west-michigan": "West Michigan",
  "central-east": "Central & East Michigan",
  "southeast-michigan": "Southeast Michigan",
};

export type DestinationFilters = {
  query: string;
  activity: ActivityId | "all";
  region: RegionId | "all";
  kids: boolean;
  dog: boolean;
  accessible: boolean;
};

export function destinationRegion(destination: Destination): RegionId {
  if (destination.latitude >= 45.85) return "upper-peninsula";
  if (destination.latitude >= 44.45) return "northern-lower";
  if (destination.longitude <= -85.15) return "west-michigan";
  if (destination.latitude <= 43.15 && destination.longitude >= -84.85) {
    return "southeast-michigan";
  }
  return "central-east";
}

export function filterDestinations(
  candidates: Destination[],
  filters: DestinationFilters,
) {
  const normalized = filters.query.trim().toLowerCase();
  return candidates.filter((destination) => {
    const text = `${destination.name} ${destination.area} ${destination.setting} ${destination.summary}`.toLowerCase();
    return (
      (!normalized || text.includes(normalized)) &&
      (filters.activity === "all" || destination.activities.includes(filters.activity)) &&
      (filters.region === "all" || destinationRegion(destination) === filters.region) &&
      (!filters.kids || destination.kidsFriendly) &&
      (!filters.dog || destination.dogsAllowed) &&
      (!filters.accessible || destination.accessibleFriendly)
    );
  });
}

function joinNatural(values: string[]) {
  if (values.length <= 1) return values[0] ?? "outdoor time";
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

export function destinationActivityText(destination: Destination) {
  return joinNatural(destination.activities.map((activity) => activityLabels[activity].toLowerCase()));
}

export function destinationDirectAnswer(destination: Destination) {
  const practical = [
    destination.kidsFriendly ? "works for family planning" : "is not currently flagged as a family-first choice",
    destination.dogsAllowed ? "has dog-compatible access somewhere on site" : "is not marked dog-compatible",
    destination.accessibleFriendly ? "includes lower-barrier possibilities" : "needs extra access research",
  ];
  return `${destination.summary} For this planner, ${destination.name} is most useful for ${destinationActivityText(destination)}. The curated record ${joinNatural(practical)}; verify the exact route, facility, season, and rules with the official source before leaving.`;
}

export function conditionConsiderations(destination: Destination) {
  const selected = new Set<ActivityId>(destination.activities);
  const considerations: Array<{ title: string; text: string }> = [];

  if (selected.has("beaches") || selected.has("paddling")) {
    considerations.push({
      title: "Wind and water",
      text: "Check the local marine forecast, waves, currents, water temperature, thunder risk, and any official beach or launch notices. A pleasant air forecast is not a water-safety decision.",
    });
  }
  if (selected.has("dark-sky")) {
    considerations.push({
      title: "Clouds and darkness",
      text: "Cloud cover, moonlight, smoke, and late-night access can change a sky-watching plan. Confirm operating rules and bring layers, a dim red light, and a safe return plan.",
    });
  }
  if (selected.has("hiking")) {
    considerations.push({
      title: "Trail surface",
      text: "Rain, snow, ice, flooding, heat, and daylight affect natural-surface routes differently. Use the official map to choose distance, grade, and surface for your group.",
    });
  }
  if (selected.has("freighters")) {
    considerations.push({
      title: "Ship timing",
      text: "Freighter movement is variable and can change after an estimate. Treat ship watching as part of a broader riverfront or shoreline plan rather than a guaranteed arrival time.",
    });
  }
  if (selected.has("birding")) {
    considerations.push({
      title: "Wildlife changes",
      text: "Habitat, migration timing, wind, time of day, and seasonal closures matter. The setting can be promising, but sightings are never guaranteed.",
    });
  }
  if (selected.has("fishing")) {
    considerations.push({
      title: "Water and regulations",
      text: "Verify licenses, seasons, species rules, water levels, access, and local conditions. This page identifies the setting; it does not replace current fishing regulations.",
    });
  }

  considerations.push({
    title: "Official status",
    text: "Confirm current hours, parking, fees or passes, closures, facility availability, and site-specific rules with the managing agency before the drive.",
  });
  return considerations.slice(0, 4);
}

export function mapUrl(destination: Destination) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${destination.name}, ${destination.area}, Michigan`)}`;
}

export function nearbyDestinations(destination: Destination, count = 3) {
  return destinations
    .filter((candidate) => candidate.id !== destination.id)
    .map((candidate) => ({
      destination: candidate,
      distanceMiles: haversineMiles(
        destination.latitude,
        destination.longitude,
        candidate.latitude,
        candidate.longitude,
      ),
    }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, count);
}
