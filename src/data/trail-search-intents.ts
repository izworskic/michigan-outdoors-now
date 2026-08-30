export type TrailSearchIntent = {
  slug: string;
  label: string;
  title: string;
  description: string;
  h1: string;
  query: string;
  maxDriveHours: number;
  directAnswer: string;
  candidateIds: string[];
  verification: string[];
};

export const trailSearchIntents: TrailSearchIntent[] = [
  {
    slug: "long-hikes",
    label: "Long hikes",
    title: "Long Hikes in Michigan | Trail Truth Planner",
    description:
      "Find longer Michigan hiking options, then verify selected-route mileage, ascent, difficulty, current weather and access with Trail Truth.",
    h1: "Long hikes in Michigan worth investigating",
    query: "long full-day hike with a real trail route",
    maxDriveHours: 8,
    directAnswer:
      "Michigan has several large trail systems where a full-day hike is realistic, but the useful question is the exact route rather than the park name. Start with the systems below, then use Trail Truth to verify the selected mapped relation, mileage, ascent, surface, weather and current access before committing.",
    candidateIds: [
      "porcupine-mountains",
      "pictured-rocks",
      "isle-royale",
      "wilderness-state-park",
      "waterloo",
      "sleeping-bear",
    ],
    verification: [
      "Selected-route mileage rather than total trail-system mileage",
      "Ascent or terrain profile",
      "Current closure and reroute notices",
      "Recent rain, snow, daylight and near-term weather",
    ],
  },
  {
    slug: "10-mile-hikes",
    label: "About 10 miles",
    title: "10-Mile Hikes in Michigan | Verify the Route",
    description:
      "Looking for roughly a 10-mile Michigan hike? Start with large trail systems, then use Trail Truth to verify the exact mapped route and conditions.",
    h1: "Looking for about a 10-mile hike in Michigan?",
    query: "about a 10 mile hike with verified route mileage",
    maxDriveHours: 8,
    directAnswer:
      "Do not choose a 10-mile hike from a park-level mileage total. Use a large hiking system as the starting point, then require a selected mapped route whose tagged or computed relation mileage actually lands near your target. The candidates below are places to investigate, not a claim that every route shown is exactly ten miles.",
    candidateIds: [
      "porcupine-mountains",
      "pictured-rocks",
      "waterloo",
      "sleeping-bear",
      "wilderness-state-park",
      "isle-royale",
    ],
    verification: [
      "Route distance is tagged or computed from one mapped relation",
      "Loop versus point-to-point geometry",
      "Ascent and surface fit the group",
      "Enough daylight remains for the actual pace",
    ],
  },
  {
    slug: "easy-hikes",
    label: "Easier hiking",
    title: "Easy Hikes in Michigan | Lower-Commitment Trail Ideas",
    description:
      "Find lower-commitment Michigan hiking destinations, then check the specific route, surface, weather, access and remaining daylight before leaving.",
    h1: "Easier Michigan hikes without pretending every trail is easy",
    query: "easy short hike lower commitment gentle trail",
    maxDriveHours: 4,
    directAnswer:
      "An easy destination does not make every route inside it easy. These places offer stronger starting points for lower-commitment walking and hiking, but Trail Truth still checks the selected route, mapped difficulty tags, surface and current conditions where those sources are available.",
    candidateIds: [
      "hartwick-pines",
      "bay-city-state-park",
      "kensington-metropark",
      "lumbermans-monument",
      "tawas-point",
      "belle-isle",
    ],
    verification: [
      "Specific route rather than destination reputation",
      "Natural versus paved surface",
      "Mapped difficulty tags when present",
      "Current weather and access",
    ],
  },
  {
    slug: "rugged-hikes",
    label: "Rugged hiking",
    title: "Rugged Hikes in Michigan | Trail Truth",
    description:
      "Find rugged Michigan hiking areas and compare selected-route mileage, ascent, mapped difficulty, weather, access and daylight before committing.",
    h1: "Rugged Michigan hikes where route truth matters",
    query: "rugged demanding hike backcountry steep full day",
    maxDriveHours: 8,
    directAnswer:
      "For rugged hiking, destination lists are not enough. The route, ascent, surface, visibility, remoteness, weather and access all matter. These systems are useful places to investigate, while Trail Truth is designed to show what is actually known about the selected mapped route and what remains unverified.",
    candidateIds: [
      "porcupine-mountains",
      "pictured-rocks",
      "isle-royale",
      "sleeping-bear",
      "tahquamenon-falls",
      "presque-isle-marquette",
    ],
    verification: [
      "Route-specific ascent rather than nearby elevation range",
      "Mapped difficulty and visibility tags",
      "Current wind, rain, snow and AQI",
      "Official access changes and seasonal rules",
    ],
  },
  {
    slug: "waterfall-hikes",
    label: "Waterfall hikes",
    title: "Waterfall Hikes in Michigan | Route + Conditions",
    description:
      "Compare Michigan waterfall hiking destinations, then verify the actual route, mileage, terrain, weather and current access before the drive.",
    h1: "Michigan waterfall hikes that are worth the drive",
    query: "waterfall hike trail worth the drive",
    maxDriveHours: 8,
    directAnswer:
      "A waterfall can be a five-minute stop or the anchor for a serious trail day. These destinations give you useful waterfall-and-hiking starting points; use the live planner to compare the drive and conditions, then Trail Truth to resolve the selected route when mapped relation data is available.",
    candidateIds: [
      "tahquamenon-falls",
      "pictured-rocks",
      "porcupine-mountains",
      "ocqueoc-falls",
      "lumbermans-monument",
      "isle-royale",
    ],
    verification: [
      "How much hiking the selected route actually contains",
      "Route mileage and ascent",
      "Recent rain or snow affecting footing",
      "Current official access information",
    ],
  },
  {
    slug: "dog-friendly-hikes",
    label: "Dog-friendly hiking",
    title: "Dog-Friendly Hikes in Michigan | Verify the Trail",
    description:
      "Find Michigan hiking destinations that allow dogs, then verify the specific route, leash rules, mileage, weather, access and trail conditions.",
    h1: "Dog-friendly hiking in Michigan, with the route still verified",
    query: "dog friendly hike trail dogs allowed",
    maxDriveHours: 5,
    directAnswer:
      "Dog-friendly at the destination level does not guarantee that every trail, beach or unit allows dogs. These are stronger starting points from the curated inventory; always confirm the exact route and current pet rules with the land manager before leaving.",
    candidateIds: [
      "hartwick-pines",
      "rifle-river",
      "wilderness-state-park",
      "tahquamenon-falls",
      "sleeping-bear",
      "waterloo",
    ],
    verification: [
      "Exact pet rules for the route or unit",
      "Surface and route mileage",
      "Heat, rain, snow and daylight",
      "Current closure or reroute information",
    ],
  },
];

export const trailSearchIntentBySlug = new Map(
  trailSearchIntents.map((intent) => [intent.slug, intent]),
);
