import { destinations } from "./destinations";
import { trailProfiles } from "./trail-profiles";

export type TrailTruthCoverageGap = {
  destinationId: string;
  reason: string;
  status: "no-designated-trails" | "route-mileage-unresolved";
  sourceLabel: string;
  sourceUrl: string;
};

export const trailTruthCoverageGaps: TrailTruthCoverageGap[] = [
  {
    destinationId: "bay-city-state-park",
    status: "route-mileage-unresolved",
    reason:
      "Michigan DNR currently confirms miles of trails and maps the Tobico Marsh system, but the current park page does not publish an exact route mileage suitable for Trail Truth.",
    sourceLabel: "Michigan DNR",
    sourceUrl: "https://www.michigan.gov/recsearch/parks/baycity",
  },
  {
    destinationId: "headlands",
    status: "route-mileage-unresolved",
    reason:
      "The county park publishes trail access, but an authoritative current route-mileage statement has not yet been resolved for the planner catalog.",
    sourceLabel: "Emmet County",
    sourceUrl: "https://www.emmetcounty.org/parks-recreation/headlands-international-dark-sky-park/",
  },
  {
    destinationId: "silver-lake-state-park",
    status: "no-designated-trails",
    reason:
      "Michigan DNR states that Silver Lake State Park has no designated trails; pedestrian use of the dunes is not converted into a fabricated named route.",
    sourceLabel: "Michigan DNR",
    sourceUrl: "https://www.michigan.gov/recsearch/parks/SilverLake",
  },
  {
    destinationId: "mclain-state-park",
    status: "route-mileage-unresolved",
    reason:
      "Michigan DNR maps hiking trail at F.J. McLain State Park, including Bear Lake access, but the current park map does not publish route mileage.",
    sourceLabel: "Michigan DNR",
    sourceUrl:
      "https://www.michigan.gov/recsearch/-/media/Project/Websites/recsearch/documents/MapsI-N/mclain_map.pdf",
  },
  {
    destinationId: "fort-wilkins",
    status: "route-mileage-unresolved",
    reason:
      "Michigan DNR confirms trails at Fort Wilkins, but exact mileage for an in-park hiking route is not published clearly enough to avoid conflating the park with the much larger Copper Harbor trail network.",
    sourceLabel: "Michigan DNR",
    sourceUrl: "https://www.michigan.gov/recsearch/parks/FortWilkins",
  },
];

const hikingDestinations = destinations.filter((destination) =>
  destination.activities.includes("hiking"),
);
const coveredDestinationIds = new Set(
  trailProfiles
    .map((profile) => profile.destinationId)
    .filter((value): value is string => Boolean(value)),
);
const documentedGapIds = new Set(
  trailTruthCoverageGaps.map((gap) => gap.destinationId),
);

export const trailTruthCoverageSummary = {
  profileCount: trailProfiles.length,
  hikingDestinationCount: hikingDestinations.length,
  coveredDestinationCount: hikingDestinations.filter((destination) =>
    coveredDestinationIds.has(destination.id),
  ).length,
  documentedGapCount: hikingDestinations.filter((destination) =>
    documentedGapIds.has(destination.id),
  ).length,
  uncoveredUndocumentedDestinationIds: hikingDestinations
    .filter(
      (destination) =>
        !coveredDestinationIds.has(destination.id) &&
        !documentedGapIds.has(destination.id),
    )
    .map((destination) => destination.id),
  coveragePercent: Math.round(
    (hikingDestinations.filter((destination) =>
      coveredDestinationIds.has(destination.id),
    ).length /
      Math.max(1, hikingDestinations.length)) *
      100,
  ),
};

export function trailTruthDestinationIsCovered(destinationId: string) {
  return coveredDestinationIds.has(destinationId);
}
