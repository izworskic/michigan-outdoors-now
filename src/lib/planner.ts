import { destinations } from "../data/destinations";
import type {
  ActivityId,
  DateChoice,
  Destination,
  Plan,
  WeatherSnapshot,
} from "./types";

export const activityLabels: Record<ActivityId, string> = {
  hiking: "Hiking",
  paddling: "Paddling",
  fishing: "Fishing",
  beaches: "Beaches",
  birding: "Birding",
  freighters: "Freighters",
  scenic: "Scenic views",
  "dark-sky": "Dark skies",
};

type RankInput = {
  latitude: number;
  longitude: number;
  originName: string;
  maxDriveHours: number;
  activities: ActivityId[];
  kids: boolean;
  dog: boolean;
  accessible: boolean;
  weatherByDestination?: Map<string, WeatherSnapshot>;
};

export function haversineMiles(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const earthRadiusMiles = 3958.8;
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(latitudeB - latitudeA);
  const longitudeDelta = radians(longitudeB - longitudeA);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

export function estimateDriveHours(distanceMiles: number) {
  return Math.max(0.2, distanceMiles / 50 + 0.18);
}

export function isPlausibleMichiganCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= 41.6 &&
    latitude <= 48.5 &&
    longitude >= -90.5 &&
    longitude <= -82.1
  );
}

function weatherAdjustment(weather: WeatherSnapshot | undefined, selected: Set<ActivityId>) {
  if (!weather) return 0;

  let adjustment = 0;

  if (weather.precipitationProbability !== null) {
    if (weather.precipitationProbability <= 20) adjustment += 8;
    else if (weather.precipitationProbability <= 45) adjustment += 3;
    else if (weather.precipitationProbability >= 75) adjustment -= 10;
    else adjustment -= 3;
  }

  if (weather.windGust !== null) {
    if (weather.windGust <= 20) adjustment += 4;
    else if (weather.windGust >= 35) adjustment -= 8;
    else if (weather.windGust >= 28) adjustment -= 3;
  }

  if (weather.high !== null) {
    if (weather.high >= 48 && weather.high <= 82) adjustment += 5;
    if (weather.high < 28 || weather.high > 92) adjustment -= 6;
  }

  if (weather.aqi !== null) {
    if (weather.aqi <= 50) adjustment += 4;
    else if (weather.aqi > 100) adjustment -= 8;
    else if (weather.aqi > 75) adjustment -= 3;
  }

  if (weather.weatherCode !== null && weather.weatherCode >= 95) {
    adjustment -= 12;
  }

  const waterDay = selected.has("paddling") || selected.has("beaches");
  if (waterDay && weather.windGust !== null) {
    if (weather.windGust >= 35) adjustment -= 12;
    else if (weather.windGust >= 25) adjustment -= 7;
  }

  if (selected.has("dark-sky") && weather.cloudCover !== null) {
    if (weather.cloudCover <= 25) adjustment += 8;
    else if (weather.cloudCover >= 70) adjustment -= 12;
    else if (weather.cloudCover >= 50) adjustment -= 5;
  }

  if ((selected.has("hiking") || selected.has("birding")) && weather.precipitationProbability !== null) {
    if (weather.precipitationProbability >= 70) adjustment -= 5;
  }

  return adjustment;
}

function weatherReason(weather: WeatherSnapshot, selected: Set<ActivityId>) {
  const parts: string[] = [];

  if (weather.high !== null) parts.push(`high near ${Math.round(weather.high)}°F`);
  if (weather.precipitationProbability !== null) {
    parts.push(`${Math.round(weather.precipitationProbability)}% rain chance`);
  }
  if (weather.windGust !== null) parts.push(`gusts near ${Math.round(weather.windGust)} mph`);
  if (selected.has("dark-sky") && weather.cloudCover !== null) {
    parts.push(`${Math.round(weather.cloudCover)}% average cloud cover`);
  }
  if (weather.aqi !== null) parts.push(`AQI near ${Math.round(weather.aqi)}`);

  return parts.length ? `Forecast: ${parts.join(", ")}.` : "Current forecast data is limited.";
}

function weatherCautions(weather: WeatherSnapshot | undefined, selected: Set<ActivityId>) {
  if (!weather) return ["Live conditions were unavailable; verify weather before leaving."];

  const cautions: string[] = [];
  if ((weather.precipitationProbability ?? 0) >= 60) {
    cautions.push("Rain is possible; bring a backup plan and check trail or beach conditions.");
  }
  if ((weather.windGust ?? 0) >= 28) {
    cautions.push("Gusty conditions may make exposed shoreline and paddling unsuitable.");
  }
  if ((weather.aqi ?? 0) > 100) {
    cautions.push("Air quality may be unhealthy for sensitive groups.");
  }
  if ((weather.weatherCode ?? 0) >= 95) {
    cautions.push("Thunderstorms are in the forecast; avoid exposed water and overlooks.");
  }
  if (
    (selected.has("paddling") || selected.has("beaches")) &&
    (weather.windGust ?? 0) >= 25
  ) {
    cautions.push("The selected water activities are wind-sensitive; check the local marine forecast and waves.");
  }
  if (selected.has("dark-sky") && (weather.cloudCover ?? 0) >= 60) {
    cautions.push("Cloud cover may limit stargazing or aurora visibility.");
  }
  return cautions;
}

function relatedToolFor(destination: Destination, selected: ActivityId[]) {
  if (destination.id === "pictured-rocks") {
    return { label: "Pictured Rocks trip planner", url: "https://picturedrocks.chrisizworski.com/" };
  }
  if (destination.id === "au-sable-mio" || destination.id === "rifle-river") {
    return { label: "Michigan trout report", url: "https://trout.chrisizworski.com/" };
  }
  if (destination.id === "soo-locks") {
    return { label: "Soo Locks live guide", url: "https://chrisizworski.com/soo-locks/" };
  }
  if (selected.includes("birding") || destination.activities.includes("birding")) {
    return { label: "Michigan birding report", url: "https://birding.chrisizworski.com/" };
  }
  if (selected.includes("dark-sky")) {
    return { label: "Northern lights in Michigan", url: "https://chrisizworski.com/northern-lights-michigan/" };
  }
  if (
    selected.includes("paddling") ||
    selected.includes("beaches") ||
    destination.activities.includes("freighters")
  ) {
    return { label: "Great Lakes buoy dashboard", url: "https://chrisizworski.com/great-lakes-buoys/" };
  }
  return { label: "More tools by Chris Izworski", url: "https://chrisizworski.com/tools" };
}

export function rankDestinations(input: RankInput): Plan[] {
  const selected = new Set(input.activities);

  const plans = destinations
    .map((destination): Plan | null => {
      const distanceMiles = haversineMiles(
        input.latitude,
        input.longitude,
        destination.latitude,
        destination.longitude,
      );
      const driveHours = estimateDriveHours(distanceMiles);
      const matchingActivities = destination.activities.filter((activity) => selected.has(activity));
      const weather = input.weatherByDestination?.get(destination.id);

      if (driveHours > input.maxDriveHours + 0.05) return null;
      if (selected.size > 0 && matchingActivities.length === 0) return null;
      if (input.kids && !destination.kidsFriendly) return null;
      if (input.dog && !destination.dogsAllowed) return null;
      if (input.accessible && !destination.accessibleFriendly) return null;

      const distanceFit = Math.max(0, 1 - driveHours / input.maxDriveHours);
      const activityFit = selected.size
        ? matchingActivities.length / selected.size
        : 0.5;
      const rawScore =
        42 + distanceFit * 28 + activityFit * 20 + weatherAdjustment(weather, selected) +
        (input.accessible && destination.accessibleFriendly ? 3 : 0);

      const reasons = [
        matchingActivities.length
          ? `Matches ${matchingActivities.map((activity) => activityLabels[activity].toLowerCase()).join(", ")}.`
          : `A flexible outdoor option near ${input.originName}.`,
        `About ${formatDriveTime(driveHours)} away (${Math.round(distanceMiles)} rough miles).`,
      ];

      if (weather) reasons.push(weatherReason(weather, selected));
      if (input.kids) reasons.push("Included because it works well for a family outing.");
      if (input.accessible) reasons.push("Included for its lower-barrier access options.");

      return {
        destination: {
          id: destination.id,
          name: destination.name,
          area: destination.area,
          summary: destination.summary,
          setting: destination.setting,
          activities: destination.activities,
          accessNote: destination.accessNote,
          officialUrl: destination.officialUrl,
        },
        score: Math.round(Math.min(99, Math.max(1, rawScore))),
        distanceMiles: Math.round(distanceMiles),
        driveHours: Number(driveHours.toFixed(1)),
        reasons,
        cautions: weatherCautions(weather, selected),
        weather: weather ?? null,
        conditionsStatus: weather ? ("live" as const) : ("estimated" as const),
        mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${destination.name}, ${destination.area}, Michigan`)}`,
        relatedTool: relatedToolFor(destination, input.activities),
      } satisfies Plan;
    })
    .filter((plan): plan is Plan => plan !== null);

  return plans
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.driveHours - b.driveHours ||
        a.destination.name.localeCompare(b.destination.name),
    )
    .slice(0, 3);
}

export function formatDriveTime(hours: number) {
  const minutes = Math.max(10, Math.round((hours * 60) / 5) * 5);
  if (minutes < 60) return `${minutes} min`;
  const wholeHours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${wholeHours} hr ${remaining} min` : `${wholeHours} hr`;
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return formatDate(date);
}

export function getDetroitDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function targetDateFor(choice: DateChoice, now = new Date()) {
  const today = getDetroitDate(now);
  if (choice === "today") return today;
  if (choice === "tomorrow") return addDays(today, 1);

  const [year, month, day] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysUntilSaturday = (6 - weekday + 7) % 7;
  return addDays(today, daysUntilSaturday);
}
