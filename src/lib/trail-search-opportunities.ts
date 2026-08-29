import { trailProfiles, type TrailProfile } from "../data/trail-profiles";

export type TrailSearchOpportunity = {
  slug: string;
  label: string;
  intent: string;
  profileCount: number;
  destinationCount: number;
  state: "blocked-until-expansion-gate";
  indexable: false;
};

type OpportunityDefinition = {
  slug: string;
  label: string;
  intent: string;
  select: (profile: TrailProfile) => boolean;
};

const definitions: OpportunityDefinition[] = [
  {
    slug: "loop-hikes-michigan",
    label: "Michigan loop hikes",
    intent: "Find Michigan hiking loops with published route mileage and route shape.",
    select: (profile) => profile.routeKind === "loop",
  },
  {
    slug: "point-to-point-hikes-michigan",
    label: "Michigan point-to-point hikes",
    intent: "Find Michigan point-to-point hikes where return transportation matters.",
    select: (profile) => profile.routeKind === "point-to-point",
  },
  {
    slug: "lower-barrier-hikes-michigan",
    label: "Lower-barrier Michigan hikes",
    intent: "Find Michigan hikes with an official lower-barrier or hard-surface signal to verify.",
    select: (profile) => profile.tags.includes("lower-barrier"),
  },
  {
    slug: "michigan-state-park-hikes",
    label: "Michigan state park hikes",
    intent: "Compare route-specific hiking options published by Michigan DNR.",
    select: (profile) => profile.sourceLabel.includes("Michigan DNR"),
  },
  {
    slug: "national-park-hikes-michigan",
    label: "Michigan national park hikes",
    intent: "Compare route-specific Michigan hikes published by the National Park Service.",
    select: (profile) => profile.sourceLabel === "National Park Service",
  },
  {
    slug: "short-hikes-under-3-miles-michigan",
    label: "Michigan hikes under 3 miles",
    intent: "Find shorter Michigan routes with published mileage under three miles.",
    select: (profile) => profile.distanceMiles <= 3,
  },
];

export const trailSearchExpansionGate = {
  impressions: 250,
  clicks: 5,
  plannerCompletions: 10,
  directionsOpens: 3,
  completeWindowDays: 28,
  rule:
    "A new trail-search canonical requires both Search Console demand and downstream planning value, plus the central new-canonical gate.",
} as const;

export const trailSearchOpportunities: TrailSearchOpportunity[] = definitions
  .map((definition) => {
    const profiles = trailProfiles.filter(definition.select);
    return {
      slug: definition.slug,
      label: definition.label,
      intent: definition.intent,
      profileCount: profiles.length,
      destinationCount: new Set(
        profiles.map((profile) => profile.destinationId).filter(Boolean),
      ).size,
      state: "blocked-until-expansion-gate" as const,
      indexable: false as const,
    };
  })
  .filter(
    (candidate) =>
      candidate.profileCount >= 6 && candidate.destinationCount >= 3,
  );
