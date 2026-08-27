export const activityIds = [
  "hiking",
  "paddling",
  "fishing",
  "beaches",
  "birding",
  "freighters",
  "scenic",
  "dark-sky",
] as const;

export type ActivityId = (typeof activityIds)[number];
export type DateChoice = "today" | "tomorrow" | "weekend";

export type Origin = {
  slug: string;
  name: string;
  zip: string;
  latitude: number;
  longitude: number;
  intro: string;
};

export type Destination = {
  id: string;
  name: string;
  area: string;
  latitude: number;
  longitude: number;
  activities: ActivityId[];
  summary: string;
  setting: string;
  kidsFriendly: boolean;
  dogsAllowed: boolean;
  accessibleFriendly: boolean;
  accessNote: string;
  officialUrl: string;
};

export type HourlyWeatherSignal = {
  time: string;
  temperature: number | null;
  precipitationProbability: number | null;
  windGust: number | null;
  cloudCover: number | null;
};

export type DecisionStatus =
  | "excellent"
  | "good"
  | "fair"
  | "poor"
  | "danger"
  | "closed"
  | "insufficient";

export type DecisionConfidence = "high" | "medium" | "low";

export type ActivityDecisionSummary = {
  activity: ActivityId;
  score: number | null;
  status: DecisionStatus;
  confidence: DecisionConfidence;
  bestWindow: string | null;
};

export type WeatherSnapshot = {
  date: string;
  high: number | null;
  low: number | null;
  precipitationProbability: number | null;
  precipitationInches: number | null;
  windGust: number | null;
  sunshineHours: number | null;
  cloudCover: number | null;
  weatherCode: number | null;
  aqi: number | null;
  hourly?: HourlyWeatherSignal[];
};

export type Plan = {
  destination: Pick<
    Destination,
    | "id"
    | "name"
    | "area"
    | "summary"
    | "setting"
    | "activities"
    | "accessNote"
    | "officialUrl"
  >;
  score: number;
  decisionStatus: DecisionStatus;
  confidence: DecisionConfidence;
  bestWindow: string | null;
  activityScores: ActivityDecisionSummary[];
  distanceMiles: number;
  driveHours: number;
  reasons: string[];
  cautions: string[];
  weather: WeatherSnapshot | null;
  conditionsStatus: "live" | "estimated";
  mapUrl: string;
  relatedTool: { label: string; url: string } | null;
};

export type PlannerRequest = {
  origin: string;
  originCoordinates?: {
    latitude: number;
    longitude: number;
  };
  date: DateChoice;
  maxDriveHours: number;
  activities: ActivityId[];
  kids: boolean;
  dog: boolean;
  accessible: boolean;
};

export type PlannerResponse = {
  origin: { name: string; latitude: number; longitude: number };
  targetDate: string;
  targetDates?: string[];
  generatedAt: string;
  conditionsStatus: "live" | "estimated";
  plans: Plan[];
  note: string;
};
