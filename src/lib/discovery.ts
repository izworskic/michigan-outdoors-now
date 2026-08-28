import type { ActivityId, Destination } from "./types";
import { estimateDriveHours, haversineMiles, isPlausibleMichiganCoordinate } from "./planner";

export const discoveryCategoryIds = [
  "waterfall",
  "viewpoint",
  "beach",
  "campground",
  "park",
  "trailhead",
  "lighthouse",
  "fishing",
  "paddling",
  "wildlife",
  "picnic",
  "cave",
] as const;

export type DiscoveryCategory = (typeof discoveryCategoryIds)[number];
export type DiscoveryTrait =
  | "quiet"
  | "wild"
  | "water"
  | "short"
  | "long"
  | "family"
  | "dog"
  | "accessible"
  | "night"
  | "uncrowded";

export type DiscoveryIntent = {
  query: string;
  activities: ActivityId[];
  categories: DiscoveryCategory[];
  traits: DiscoveryTrait[];
  summary: string;
};

export type DiscoveryPlace = {
  id: string;
  name: string;
  area: string;
  latitude: number;
  longitude: number;
  category: DiscoveryCategory;
  categoryLabel: string;
  distanceMiles: number;
  driveHours: number;
  score: number;
  why: string;
  source: "OpenStreetMap" | "Michigan Outdoors Now";
  sourceUrl: string;
  directionsUrl: string;
  website?: string;
  curatedPlaceId?: string;
};

export type DiscoveryResponse = {
  origin: {
    name: string;
    latitude: number;
    longitude: number;
  };
  query: string;
  intent: DiscoveryIntent;
  places: DiscoveryPlace[];
  generatedAt: string;
  status: "live" | "fallback";
  sourceNote: string;
};

type CategoryDefinition = {
  id: DiscoveryCategory;
  label: string;
  selectors: string[];
  keywords: string[];
  activities: ActivityId[];
};

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: "waterfall",
    label: "Waterfall",
    selectors: ['nwr["natural"="waterfall"]'],
    keywords: ["waterfall", "falls", "cascade"],
    activities: ["hiking", "scenic"],
  },
  {
    id: "viewpoint",
    label: "Viewpoint",
    selectors: ['nwr["tourism"="viewpoint"]'],
    keywords: ["view", "viewpoint", "overlook", "scenic", "vista", "bluff", "cliff"],
    activities: ["hiking", "scenic", "birding"],
  },
  {
    id: "beach",
    label: "Beach",
    selectors: ['nwr["natural"="beach"]'],
    keywords: ["beach", "shore", "shoreline", "sand", "swim", "lake michigan", "lake huron", "lake superior"],
    activities: ["beaches", "paddling", "scenic"],
  },
  {
    id: "campground",
    label: "Campground",
    selectors: ['nwr["tourism"="camp_site"]', 'nwr["tourism"="caravan_site"]'],
    keywords: ["camp", "camping", "campground", "tent", "overnight", "stay out"],
    activities: ["hiking", "scenic"],
  },
  {
    id: "park",
    label: "Natural area",
    selectors: ['nwr["leisure"="nature_reserve"]', 'nwr["boundary"="protected_area"]'],
    keywords: ["park", "forest", "woods", "nature", "preserve", "reserve", "wild", "remote", "backcountry"],
    activities: ["hiking", "birding", "scenic"],
  },
  {
    id: "trailhead",
    label: "Trailhead",
    selectors: ['nwr["highway"="trailhead"]'],
    keywords: ["trail", "trailhead", "hike", "hiking", "walk", "footpath"],
    activities: ["hiking"],
  },
  {
    id: "lighthouse",
    label: "Lighthouse",
    selectors: ['nwr["man_made"="lighthouse"]'],
    keywords: ["lighthouse", "light house", "light station"],
    activities: ["scenic", "birding"],
  },
  {
    id: "fishing",
    label: "Fishing access",
    selectors: ['nwr["leisure"="fishing"]'],
    keywords: ["fish", "fishing", "trout", "brook trout", "river", "stream", "creek"],
    activities: ["fishing"],
  },
  {
    id: "paddling",
    label: "Paddling access",
    selectors: ['nwr["canoe"="put_in"]', 'nwr["waterway"="access_point"]'],
    keywords: ["paddle", "paddling", "canoe", "kayak", "put in", "put-in"],
    activities: ["paddling"],
  },
  {
    id: "wildlife",
    label: "Wildlife area",
    selectors: ['nwr["leisure"="nature_reserve"]'],
    keywords: ["wildlife", "bird", "birding", "birds", "waterfowl", "migration", "refuge"],
    activities: ["birding", "hiking", "scenic"],
  },
  {
    id: "picnic",
    label: "Picnic site",
    selectors: ['nwr["tourism"="picnic_site"]', 'nwr["leisure"="picnic_table"]'],
    keywords: ["picnic", "lunch outside", "easy stop"],
    activities: ["scenic"],
  },
  {
    id: "cave",
    label: "Cave",
    selectors: ['nwr["natural"="cave_entrance"]'],
    keywords: ["cave", "cavern"],
    activities: ["hiking", "scenic"],
  },
];

const ACTIVITY_RULES: Array<[ActivityId, string[]]> = [
  ["hiking", ["hike", "hiking", "trail", "walk", "woods", "forest", "waterfall", "overlook"]],
  ["paddling", ["paddle", "paddling", "canoe", "kayak", "put in", "put-in"]],
  ["fishing", ["fish", "fishing", "trout", "brookie", "brook trout", "river", "stream", "creek"]],
  ["beaches", ["beach", "swim", "sand", "shore", "shoreline"]],
  ["birding", ["bird", "birding", "birds", "waterfowl", "migration", "wildlife", "refuge"]],
  ["freighters", ["freighter", "freighters", "ship", "ships", "shipping"]],
  ["scenic", ["scenic", "view", "viewpoint", "overlook", "vista", "waterfall", "lighthouse", "sunset"]],
  ["dark-sky", ["dark sky", "stars", "stargazing", "aurora", "northern lights", "night sky"]],
];

const TRAIT_RULES: Array<[DiscoveryTrait, string[]]> = [
  ["quiet", ["quiet", "peaceful", "low key", "low-key", "solitude"]],
  ["wild", ["wild", "remote", "backcountry", "rugged", "undeveloped"]],
  ["water", ["water", "river", "lake", "shore", "waterfall", "beach", "paddle", "trout"]],
  ["short", ["short", "quick", "easy hike", "short hike", "half day", "half-day"]],
  ["long", ["long", "long hike", "full day", "full-day", "all day", "all-day", "big hike", "big day", "high mileage", "lots of miles", "backcountry"]],
  ["family", ["family", "kids", "kid friendly", "children"]],
  ["dog", ["dog", "dogs", "pet"]],
  ["accessible", ["accessible", "wheelchair", "mobility", "step free", "step-free"]],
  ["night", ["night", "after dark", "dark sky", "stars", "aurora", "sunset"]],
  ["uncrowded", ["not crowded", "uncrowded", "no crowds", "avoid crowds", "not touristy", "less touristy"]],
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function containsAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function categoryDefinition(id: DiscoveryCategory) {
  return CATEGORY_DEFINITIONS.find((definition) => definition.id === id)!;
}

function defaultCategories(activities: ActivityId[], traits: DiscoveryTrait[]) {
  const result: DiscoveryCategory[] = [];
  if (activities.includes("fishing")) result.push("fishing", "park");
  if (activities.includes("paddling")) result.push("paddling", "beach", "park");
  if (activities.includes("beaches")) result.push("beach");
  if (activities.includes("birding")) result.push("wildlife", "park", "viewpoint");
  if (activities.includes("hiking")) result.push("trailhead", "park", "viewpoint", "waterfall");
  if (activities.includes("dark-sky")) result.push("viewpoint", "park", "campground");
  if (traits.includes("water")) result.push("waterfall", "beach", "paddling");
  if (!result.length) result.push("viewpoint", "waterfall", "park", "trailhead", "beach", "campground");
  return unique(result).slice(0, 6);
}

export function interpretOutdoorQuery(query: string): DiscoveryIntent {
  const cleanQuery = query.trim().slice(0, 180);
  const text = normalize(cleanQuery);

  const explicitCategories = CATEGORY_DEFINITIONS
    .filter((definition) => containsAny(text, definition.keywords))
    .map((definition) => definition.id);

  const activities = unique(
    ACTIVITY_RULES.filter(([, terms]) => containsAny(text, terms)).map(([activity]) => activity),
  );

  const traits = unique(
    TRAIT_RULES.filter(([, terms]) => containsAny(text, terms)).map(([trait]) => trait),
  );

  const categories = unique([
    ...explicitCategories,
    ...defaultCategories(activities, traits),
  ]).slice(0, 6);

  const inferredActivities = unique([
    ...activities,
    ...categories.flatMap((category) => categoryDefinition(category).activities),
  ]).slice(0, 5);

  const categoryNames = categories.slice(0, 3).map((category) => categoryDefinition(category).label.toLowerCase());
  const traitNames = traits.slice(0, 2).map((trait) => trait.replace("-", " "));

  return {
    query: cleanQuery,
    activities: inferredActivities,
    categories,
    traits,
    summary: [
      categoryNames.length ? `Looking for ${categoryNames.join(", ")}` : "Looking broadly across Michigan",
      traitNames.length ? `with a ${traitNames.join(" / ")} feel` : "",
    ].filter(Boolean).join(" "),
  };
}

export function overpassSelectorsFor(intent: DiscoveryIntent) {
  return unique(
    intent.categories.flatMap((category) => categoryDefinition(category).selectors),
  ).slice(0, 10);
}

export function discoveryRadiusMeters(maxDriveHours: number) {
  const roughMiles = Math.max(1, Math.min(8, maxDriveHours)) * 50 * 1.18;
  return Math.min(650_000, Math.round(roughMiles * 1609.344));
}

export function categoryLabel(category: DiscoveryCategory) {
  return categoryDefinition(category).label;
}

export function categoryFromTags(tags: Record<string, string | undefined>): DiscoveryCategory {
  if (tags.natural === "waterfall") return "waterfall";
  if (tags.tourism === "viewpoint") return "viewpoint";
  if (tags.natural === "beach") return "beach";
  if (tags.tourism === "camp_site" || tags.tourism === "caravan_site") return "campground";
  if (tags.highway === "trailhead") return "trailhead";
  if (tags.man_made === "lighthouse") return "lighthouse";
  if (tags.leisure === "fishing") return "fishing";
  if (tags.canoe === "put_in" || tags.waterway === "access_point") return "paddling";
  if (tags.tourism === "picnic_site" || tags.leisure === "picnic_table") return "picnic";
  if (tags.natural === "cave_entrance") return "cave";
  if (tags.leisure === "nature_reserve") return "wildlife";
  return "park";
}

export function scoreDiscoveryCandidate(args: {
  latitude: number;
  longitude: number;
  originLatitude: number;
  originLongitude: number;
  maxDriveHours: number;
  category: DiscoveryCategory;
  intent: DiscoveryIntent;
  name?: string;
  website?: string;
}) {
  const distanceMiles = haversineMiles(
    args.originLatitude,
    args.originLongitude,
    args.latitude,
    args.longitude,
  );
  const driveHours = estimateDriveHours(distanceMiles);
  const categoryIndex = args.intent.categories.indexOf(args.category);
  const categoryFit = categoryIndex < 0 ? 0 : Math.max(5, 28 - categoryIndex * 4);
  const distanceFit = Math.max(0, 1 - driveHours / Math.max(1, args.maxDriveHours));
  const text = normalize(`${args.name ?? ""} ${categoryLabel(args.category)}`);
  const queryTokens = normalize(args.intent.query).split(" ").filter((token) => token.length >= 4);
  const tokenMatches = queryTokens.filter((token) => text.includes(token)).length;
  const raw = 44 + categoryFit + distanceFit * 20 + Math.min(8, tokenMatches * 2) + (args.website ? 2 : 0);

  return {
    distanceMiles: Math.round(distanceMiles),
    driveHours: Number(driveHours.toFixed(1)),
    score: Math.round(Math.min(99, Math.max(1, raw))),
  };
}

export function isDiscoveryCandidateInRange(args: {
  latitude: number;
  longitude: number;
  originLatitude: number;
  originLongitude: number;
  maxDriveHours: number;
}) {
  if (!isPlausibleMichiganCoordinate(args.latitude, args.longitude)) return false;
  const miles = haversineMiles(
    args.originLatitude,
    args.originLongitude,
    args.latitude,
    args.longitude,
  );
  return estimateDriveHours(miles) <= args.maxDriveHours + 0.05;
}

function destinationEffortFit(destination: Destination, intent: DiscoveryIntent) {
  const haystack = normalize(
    `${destination.name} ${destination.area} ${destination.setting} ${destination.summary} ${destination.accessNote}`,
  );

  let adjustment = 0;
  let note = "";

  if (intent.traits.includes("long")) {
    const longSignals = [
      "long",
      "full day",
      "backcountry",
      "rugged",
      "remote",
      "steep",
      "wilderness",
      "long trails",
      "long natural surface trails",
    ];
    const longMatches = longSignals.filter((signal) => haystack.includes(signal)).length;
    adjustment += longMatches ? Math.min(14, 7 + longMatches * 2) : -4;
    note = longMatches
      ? " It has stronger full-day / backcountry signals than a generic trailhead."
      : " Exact route length still needs to be chosen inside the destination.";
  }

  if (intent.traits.includes("short")) {
    const shortSignals = ["short", "compact", "focused stop", "easy stop", "overlook", "roadside"];
    const shortMatches = shortSignals.filter((signal) => haystack.includes(signal)).length;
    adjustment += shortMatches ? Math.min(10, 4 + shortMatches * 2) : 0;
  }

  return { adjustment, note };
}

function inferredCategoryForDestination(destination: Destination, intent: DiscoveryIntent): DiscoveryCategory {
  const haystack = normalize(
    `${destination.name} ${destination.area} ${destination.setting} ${destination.summary}`,
  );
  const explicit = intent.categories.find((category) =>
    containsAny(haystack, categoryDefinition(category).keywords),
  );
  if (explicit) return explicit;
  if (destination.activities.includes("beaches")) return "beach";
  if (destination.activities.includes("fishing")) return "fishing";
  if (destination.activities.includes("paddling")) return "paddling";
  if (destination.activities.includes("birding")) return "wildlife";
  return destination.activities.includes("hiking") ? "trailhead" : "viewpoint";
}

export function curatedDiscoveryPlaces(args: {
  destinations: Destination[];
  intent: DiscoveryIntent;
  originLatitude: number;
  originLongitude: number;
  maxDriveHours: number;
}) {
  const selectedActivities = new Set(args.intent.activities);

  return args.destinations
    .filter((destination) =>
      isDiscoveryCandidateInRange({
        latitude: destination.latitude,
        longitude: destination.longitude,
        originLatitude: args.originLatitude,
        originLongitude: args.originLongitude,
        maxDriveHours: args.maxDriveHours,
      }),
    )
    .map((destination): DiscoveryPlace | null => {
      const activityMatches = destination.activities.filter((activity) => selectedActivities.has(activity)).length;
      const category = inferredCategoryForDestination(destination, args.intent);
      const categoryMatch = args.intent.categories.includes(category);
      if (selectedActivities.size && activityMatches === 0 && !categoryMatch) return null;

      const metrics = scoreDiscoveryCandidate({
        latitude: destination.latitude,
        longitude: destination.longitude,
        originLatitude: args.originLatitude,
        originLongitude: args.originLongitude,
        maxDriveHours: args.maxDriveHours,
        category,
        intent: args.intent,
        name: destination.name,
        website: destination.officialUrl,
      });

      const effortFit = destinationEffortFit(destination, args.intent);
      const score = Math.min(
        99,
        Math.max(1, metrics.score + Math.min(8, activityMatches * 2) + 4 + effortFit.adjustment),
      );
      return {
        id: `curated:${destination.id}`,
        name: destination.name,
        area: destination.area,
        latitude: destination.latitude,
        longitude: destination.longitude,
        category,
        categoryLabel: categoryLabel(category),
        distanceMiles: metrics.distanceMiles,
        driveHours: metrics.driveHours,
        score,
        why: `${destination.summary}${effortFit.note}`,
        source: "Michigan Outdoors Now",
        sourceUrl: destination.officialUrl,
        directionsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${destination.name}, ${destination.area}, Michigan`)}`,
        website: destination.officialUrl,
        curatedPlaceId: destination.id,
      };
    })
    .filter((place): place is DiscoveryPlace => place !== null);
}
