import { trailProfiles, type TrailProfile } from "../data/trail-profiles";

export type TrailSearchPage = {
  slug: string;
  title: string;
  h1: string;
  description: string;
  eyebrow: string;
  directAnswer: string;
  profiles: TrailProfile[];
};

const definitions: Array<Omit<TrailSearchPage, "profiles"> & { select: (profile: TrailProfile) => boolean }> = [
  {
    slug: "long-hikes-michigan",
    title: "Long Hikes in Michigan | Route Miles & Trail Truth",
    h1: "Long hikes in Michigan with route mileage you can inspect",
    description: "Compare long Michigan hikes using official route mileage, route type, terrain, current access and live trip-confidence checks before you leave.",
    eyebrow: "Long-route truth",
    directAnswer: "For a genuinely long Michigan hiking day, start with routes whose mileage is published by the land manager, then use current weather and access as a second decision layer. The routes below are nine miles or longer.",
    select: (profile) => profile.tags.includes("long"),
  },
  {
    slug: "10-mile-hikes-michigan",
    title: "10-Mile Hikes in Michigan | Verified Route Options",
    h1: "Michigan hikes around 10 miles",
    description: "Michigan hiking routes around 10 miles, backed by NPS, Michigan DNR or U.S. Forest Service mileage and linked into current trip planning.",
    eyebrow: "Around ten miles",
    directAnswer: "If you are looking for roughly a 10-mile hiking day, these routes fall between about nine and twelve miles using mileage published by the managing agency.",
    select: (profile) => profile.tags.includes("ten-mile"),
  },
  {
    slug: "easy-short-hikes-michigan",
    title: "Easy Short Hikes in Michigan | Official Trail Miles",
    h1: "Easy short hikes in Michigan",
    description: "Start with shorter Michigan hiking routes whose distance and easy terrain are documented by NPS or another official land manager.",
    eyebrow: "Lower-commitment trails",
    directAnswer: "For a lower-commitment trail day, prioritize official routes under five miles that the land manager describes as easy, flat, gently rolling or paved.",
    select: (profile) => profile.tags.includes("easy"),
  },
  {
    slug: "rugged-hikes-michigan",
    title: "Rugged Hikes in Michigan | Terrain, Miles & Access",
    h1: "Rugged Michigan hikes that deserve real planning",
    description: "Compare rugged Michigan hiking routes by official mileage, terrain character, route type, current weather and access signals.",
    eyebrow: "More demanding terrain",
    directAnswer: "Rugged should mean more than a marketing adjective. These routes have official descriptions pointing to rough tread, substantial elevation change, remote travel or unusually demanding terrain.",
    select: (profile) => profile.tags.includes("rugged"),
  },
  {
    slug: "waterfall-hikes-michigan",
    title: "Michigan Waterfall Hikes | Route Miles & Trail Access",
    h1: "Michigan waterfall hikes with the route attached",
    description: "Compare Michigan waterfall hikes with official trail mileage, route character, access links and current trip-confidence checks.",
    eyebrow: "Waterfall routes",
    directAnswer: "A useful waterfall-hike list should tell you how much hiking is attached to the falls. These routes pair waterfall features with published route mileage rather than treating every roadside cascade as the same trip.",
    select: (profile) => profile.tags.includes("waterfall"),
  },
  {
    slug: "full-day-hikes-michigan",
    title: "Full-Day Hikes in Michigan | Long Route Planner",
    h1: "Full-day hikes in Michigan",
    description: "Plan a full hiking day in Michigan using official route mileage, terrain, drive-time context, current weather, access and route-truth evidence.",
    eyebrow: "All-day trail decisions",
    directAnswer: "A full-day hike is a time-budget decision, not just a mileage threshold. These longer routes have enough distance or terrain to justify planning the drive, daylight and access before committing.",
    select: (profile) => profile.tags.includes("full-day"),
  },
];

export const trailSearchPages: TrailSearchPage[] = definitions
  .map(({ select, ...definition }) => ({
    ...definition,
    profiles: trailProfiles.filter(select),
  }))
  .filter((page) => page.profiles.length >= 3);

export const trailSearchPageBySlug = new Map(
  trailSearchPages.map((page) => [page.slug, page]),
);
