export type TrailProfile = {
  id: string;
  name: string;
  destinationId: string;
  area: string;
  distanceMiles: number;
  routeKind: "loop" | "out-and-back" | "point-to-point" | "network";
  difficulty: "easy" | "moderate" | "challenging" | "rugged";
  terrain: string;
  features: string[];
  tags: Array<
    | "long"
    | "ten-mile"
    | "short"
    | "easy"
    | "rugged"
    | "waterfall"
    | "full-day"
    | "lower-barrier"
  >;
  sourceLabel: string;
  sourceUrl: string;
  sourceNote: string;
};

export const trailProfiles: TrailProfile[] = [
  {
    id: "chapel-loop",
    name: "Chapel Loop",
    destinationId: "pictured-rocks",
    area: "Pictured Rocks National Lakeshore",
    distanceMiles: 10.5,
    routeKind: "loop",
    difficulty: "challenging",
    terrain: "Forest, Lake Superior cliff-top trail and beach approaches",
    features: ["Chapel Falls", "Chapel Rock", "Lake Superior cliffs", "Mosquito Falls"],
    tags: ["long", "ten-mile", "waterfall", "full-day"],
    sourceLabel: "National Park Service",
    sourceUrl: "https://www.nps.gov/thingstodo/hikes-over-mile-piro.htm",
    sourceNote: "NPS lists the full Chapel Loop, including Mosquito Falls, at 10.5 miles.",
  },
  {
    id: "mosquito-beach-loop",
    name: "Mosquito Beach via Mosquito Falls",
    destinationId: "pictured-rocks",
    area: "Pictured Rocks National Lakeshore",
    distanceMiles: 4.5,
    routeKind: "loop",
    difficulty: "rugged",
    terrain: "Lowland forest, rough/muddy tread and Lake Superior shoreline",
    features: ["Mosquito Beach", "Mosquito Falls", "sandstone shoreline"],
    tags: ["rugged", "waterfall"],
    sourceLabel: "National Park Service",
    sourceUrl: "https://www.nps.gov/thingstodo/hikes-over-mile-piro.htm",
    sourceNote: "NPS lists the loop at 4.5 miles and describes the trail as usually muddy and rough.",
  },
  {
    id: "miners-falls",
    name: "Miners Falls Trail",
    destinationId: "pictured-rocks",
    area: "Pictured Rocks National Lakeshore",
    distanceMiles: 1.2,
    routeKind: "out-and-back",
    difficulty: "easy",
    terrain: "Gently rolling gravel and dirt path with stairs to the lower platform",
    features: ["Miners Falls", "northwoods forest", "viewing platforms"],
    tags: ["short", "easy", "waterfall"],
    sourceLabel: "National Park Service",
    sourceUrl: "https://home.nps.gov/places/miners-falls.htm",
    sourceNote: "NPS lists the walk at 0.6 mile each way, or 1.2 miles roundtrip.",
  },
  {
    id: "empire-bluff",
    name: "Empire Bluff Trail",
    destinationId: "sleeping-bear",
    area: "Sleeping Bear Dunes National Lakeshore",
    distanceMiles: 1.5,
    routeKind: "out-and-back",
    difficulty: "moderate",
    terrain: "Hilly beech-maple forest to a Lake Michigan bluff",
    features: ["Lake Michigan overlook", "beech-maple forest", "dune plants"],
    tags: ["short"],
    sourceLabel: "National Park Service",
    sourceUrl: "https://www.nps.gov/places/000/empire-bluff-trail.htm",
    sourceNote: "NPS lists the roundtrip at 1.5 miles and the terrain as hilly.",
  },
  {
    id: "good-harbor-bay",
    name: "Good Harbor Bay Trail",
    destinationId: "sleeping-bear",
    area: "Sleeping Bear Dunes National Lakeshore",
    distanceMiles: 2.8,
    routeKind: "loop",
    difficulty: "easy",
    terrain: "Flat woods and wetlands",
    features: ["woods", "wetlands", "flat loop"],
    tags: ["short", "easy"],
    sourceLabel: "National Park Service",
    sourceUrl: "https://www.nps.gov/slbe/planyourvisit/trails.htm",
    sourceNote: "NPS lists this as a 2.8-mile easy, flat loop through woods and wetlands.",
  },
  {
    id: "sleeping-bear-heritage",
    name: "Sleeping Bear Heritage Trail segment",
    destinationId: "sleeping-bear",
    area: "Sleeping Bear Dunes National Lakeshore",
    distanceMiles: 4.25,
    routeKind: "point-to-point",
    difficulty: "easy",
    terrain: "Mostly forested paved multi-use trail",
    features: ["paved route", "Dune Climb", "Glen Haven"],
    tags: ["easy", "lower-barrier"],
    sourceLabel: "National Park Service",
    sourceUrl: "https://www.nps.gov/slbe/planyourvisit/trails.htm",
    sourceNote: "NPS lists a 4.25-mile paved section and notes it works for strollers and wheelchairs.",
  },
  {
    id: "escarpment-trail",
    name: "Escarpment Trail",
    destinationId: "porcupine-mountains",
    area: "Porcupine Mountains Wilderness State Park",
    distanceMiles: 4.3,
    routeKind: "point-to-point",
    difficulty: "challenging",
    terrain: "Escarpment ridge with large elevation changes and cliff-side vistas",
    features: ["Lake of the Clouds", "escarpment views", "old-growth forest"],
    tags: ["rugged"],
    sourceLabel: "Michigan DNR",
    sourceUrl: "https://www.michigan.gov/recsearch/-/media/Project/Websites/recsearch/documents/MapsO-S/PMWSP-trail-descriptions.pdf",
    sourceNote: "Michigan DNR lists 4.3 miles and calls the large elevation changes a challenge.",
  },
  {
    id: "lake-superior-trail",
    name: "Lake Superior Trail",
    destinationId: "porcupine-mountains",
    area: "Porcupine Mountains Wilderness State Park",
    distanceMiles: 17.1,
    routeKind: "point-to-point",
    difficulty: "rugged",
    terrain: "Remote Lake Superior shoreline and wilderness forest",
    features: ["Lake Superior shoreline", "remote forest", "backcountry travel"],
    tags: ["long", "rugged", "full-day"],
    sourceLabel: "Michigan DNR",
    sourceUrl: "https://www.michigan.gov/recsearch/-/media/Project/Websites/recsearch/documents/MapsO-S/PMWSP-trail-descriptions.pdf",
    sourceNote: "Michigan DNR lists 17.1 miles and describes it as the park's longest and most challenging trail.",
  },
  {
    id: "big-carp-river",
    name: "Big Carp River Trail",
    destinationId: "porcupine-mountains",
    area: "Porcupine Mountains Wilderness State Park",
    distanceMiles: 9.6,
    routeKind: "point-to-point",
    difficulty: "challenging",
    terrain: "Escarpment descent, river valley and old-growth forest",
    features: ["waterfalls", "old-growth forest", "Lake Superior"],
    tags: ["long", "ten-mile", "waterfall", "full-day"],
    sourceLabel: "Michigan DNR",
    sourceUrl: "https://www.michigan.gov/recsearch/-/media/Project/Websites/recsearch/documents/MapsO-S/PMWSP-trail-descriptions.pdf",
    sourceNote: "Michigan DNR lists the full Big Carp River Trail at 9.6 miles.",
  },
  {
    id: "summit-peak",
    name: "Summit Peak Tower Trail",
    destinationId: "porcupine-mountains",
    area: "Porcupine Mountains Wilderness State Park",
    distanceMiles: 0.5,
    routeKind: "point-to-point",
    difficulty: "moderate",
    terrain: "Short climb to the park's high point and observation tower",
    features: ["observation tower", "300-foot climb", "wide views"],
    tags: ["short"],
    sourceLabel: "Michigan DNR",
    sourceUrl: "https://www.michigan.gov/recsearch/-/media/Project/Websites/recsearch/documents/MapsO-S/PMWSP-trail-descriptions.pdf",
    sourceNote: "Michigan DNR lists 0.5 mile from parking to the tower and a 300-foot climb.",
  },
  {
    id: "manistee-river-trail",
    name: "Manistee River Trail",
    destinationId: "manistee-river",
    area: "Huron-Manistee National Forests",
    distanceMiles: 10.5,
    routeKind: "point-to-point",
    difficulty: "challenging",
    terrain: "Narrow river-bank trail with forest, seeps, tributaries and suspension-bridge access",
    features: ["Manistee River views", "spring-fed waterfalls", "tributary creeks"],
    tags: ["long", "ten-mile", "waterfall", "full-day"],
    sourceLabel: "U.S. Forest Service",
    sourceUrl: "https://www.fs.usda.gov/Internet/FSE_DOCUMENTS/stelprdb5373964.pdf",
    sourceNote: "USFS lists the Manistee River Trail at 10.5 miles and the combined NCT/MRT loop at 22 miles.",
  },
  {
    id: "jordan-valley-pathway",
    name: "Jordan Valley Pathway",
    destinationId: "jordan-river",
    area: "Jordan River Valley",
    distanceMiles: 18,
    routeKind: "loop",
    difficulty: "challenging",
    terrain: "Hilly northern Michigan river-valley pathway",
    features: ["Jordan River valley", "Deadman's Hill area", "backcountry campground"],
    tags: ["long", "rugged", "full-day"],
    sourceLabel: "Michigan DNR",
    sourceUrl: "https://www.michigan.gov/recsearch/sfcampgroundsn-z/PinneyBridge",
    sourceNote: "Michigan DNR describes the nearby Jordan Valley Pathway as 18 miles of hilly terrain.",
  },
];

export const trailProfileById = new Map(trailProfiles.map((profile) => [profile.id, profile]));
