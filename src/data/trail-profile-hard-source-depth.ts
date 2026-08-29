import type { TrailProfile } from "./trail-profiles";

export const hardSourceTrailDepthBatch: TrailProfile[] = [
  {
    id: "jordan-warner-creek-pathway",
    name: "Warner Creek Pathway",
    destinationId: "jordan-river",
    area: "Jordan River Valley / Mackinaw State Forest",
    distanceMiles: 3.8,
    routeKind: "loop",
    difficulty: "moderate",
    terrain: "Rugged hardwood hills with wet sections near O'Brien's Pond",
    features: ["Hardwood Hills", "O'Brien's Pond", "Mackinaw State Forest"],
    tags: [],
    sourceLabel: "Michigan DNR",
    sourceUrl: "https://www.michigan.gov/recsearch/trails/warner-creek-pathway",
    sourceNote: "Michigan DNR lists Warner Creek Pathway as a 3.8-mile one-loop trail with moderate overall difficulty.",
    access: {
      trailhead: "Warner Creek Pathway trailhead",
      parking: "Michigan DNR publishes the trailhead at 45.085418, -84.939076.",
      notes: [
        "DNR says sections can be wet because of the trail's proximity to O'Brien's Pond.",
        "The trail is open year-round for hiking but is primarily used as a winter pathway.",
      ],
      sourceUrl: "https://www.michigan.gov/recsearch/trails/warner-creek-pathway",
      entryPoints: [
        {
          name: "Warner Creek Pathway trailhead",
          query: "45.085418,-84.939076",
          note: "Official DNR trailhead coordinates.",
        },
      ],
    },
  },
  {
    id: "presque-isle-bog-walk",
    name: "Bog Walk Trails",
    destinationId: "presque-isle-marquette",
    area: "Presque Isle Park, Marquette",
    distanceMiles: 0.5,
    routeKind: "network",
    difficulty: "moderate",
    terrain: "Narrow asphalt approach and boardwalk through an urban Lake Superior bog",
    features: ["bog ecosystem", "boardwalk", "viewing platforms", "interpretive setting"],
    tags: ["short"],
    sourceLabel: "City of Marquette",
    sourceUrl: "https://www.marquettemi.gov/wp-content/uploads/2017/07/Trails-Master-Plan-Final.pdf",
    sourceNote: "The City of Marquette Trails Master Plan inventory lists Bog Walk Trails at 0.5 miles within city limits.",
    access: {
      trailhead: "Bog Walk Nature Area",
      parking: "The 2025 city recreation plan identifies a gravel parking area near the Lakeshore Drive entrance to Presque Isle Park.",
      notes: [
        "The 2025 city recreation plan says the boardwalk and asphalt path are in need of repair.",
        "The city reports no fully accessible route from parking to the boardwalk.",
      ],
      sourceUrl: "https://www.marquettemi.gov/public_html/wp-content/uploads/2025/02/2025%20Marquette%20Five-Year%20Recreation%20Master%20Plan%20Intro%20Needs%20Assessment.pdf",
      entryPoints: [
        {
          name: "Bog Walk Nature Area parking",
          note: "Gravel parking area near the Lakeshore Drive entrance to Presque Isle Park.",
        },
      ],
    },
  },
];
