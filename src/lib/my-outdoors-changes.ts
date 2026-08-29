import type { OutdoorOpportunity } from "./opportunity-engine";
import type {
  OpportunityBaseline,
  RememberedPlace,
} from "./my-outdoors";

export type MyOutdoorsChangeKind = "new-window" | "stronger-window";

export type MyOutdoorsChange = {
  placeId: string;
  placeName: string;
  area: string;
  path: string;
  kind: MyOutdoorsChangeKind;
  title: string;
  detail: string;
  previousScore: number | null;
  opportunity: OutdoorOpportunity;
};

function baselineFor(
  opportunity: OutdoorOpportunity | undefined,
  checkedAt: string,
): OpportunityBaseline {
  return {
    checkedAt,
    qualifies: Boolean(opportunity),
    score: opportunity?.score ?? null,
    signalStrength: opportunity?.signalStrength ?? null,
    activity: opportunity?.activity ?? null,
    kind: opportunity?.kind ?? null,
  };
}

export function snapshotSavedOpportunityBaselines(
  savedPlaces: RememberedPlace[],
  opportunities: OutdoorOpportunity[],
  checkedAt: string,
  checkedPlaceIds?: Iterable<string>,
) {
  const byDestination = new Map(
    opportunities.map((opportunity) => [opportunity.destination.id, opportunity]),
  );
  const output: Record<string, OpportunityBaseline> = {};
  const checked = checkedPlaceIds ? new Set(checkedPlaceIds) : null;

  for (const place of savedPlaces) {
    if (place.kind !== "curated") continue;
    if (checked && !checked.has(place.id)) continue;
    output[place.id] = baselineFor(byDestination.get(place.id), checkedAt);
  }

  return output;
}

export function detectSavedPlaceChanges(args: {
  savedPlaces: RememberedPlace[];
  previous: Record<string, OpportunityBaseline>;
  opportunities: OutdoorOpportunity[];
  checkedAt: string;
  checkedPlaceIds?: Iterable<string>;
}) {
  const current = snapshotSavedOpportunityBaselines(
    args.savedPlaces,
    args.opportunities,
    args.checkedAt,
    args.checkedPlaceIds,
  );
  const byDestination = new Map(
    args.opportunities.map((opportunity) => [opportunity.destination.id, opportunity]),
  );
  const changes: MyOutdoorsChange[] = [];

  for (const place of args.savedPlaces) {
    if (place.kind !== "curated") continue;
    const previous = args.previous[place.id];
    const now = current[place.id];
    const opportunity = byDestination.get(place.id);
    if (!previous || !now || !opportunity) continue;

    if (!previous.qualifies && now.qualifies) {
      changes.push({
        placeId: place.id,
        placeName: place.name,
        area: place.area,
        path: place.path,
        kind: "new-window",
        title: `${place.name} just moved into a standout window`,
        detail: opportunity.comparison,
        previousScore: previous.score,
        opportunity,
      });
      continue;
    }

    const scoreDelta =
      previous.score === null || now.score === null ? 0 : now.score - previous.score;
    const strengthDelta =
      previous.signalStrength === null || now.signalStrength === null
        ? 0
        : now.signalStrength - previous.signalStrength;

    if (
      previous.qualifies &&
      now.qualifies &&
      (scoreDelta >= 8 || (scoreDelta >= 4 && strengthDelta >= 10))
    ) {
      changes.push({
        placeId: place.id,
        placeName: place.name,
        area: place.area,
        path: place.path,
        kind: "stronger-window",
        title: `${place.name} is materially stronger than your last check`,
        detail:
          scoreDelta >= 8
            ? `Weather fit improved by ${Math.round(scoreDelta)} points since your saved baseline.`
            : opportunity.comparison,
        previousScore: previous.score,
        opportunity,
      });
    }
  }

  return {
    changes: changes
      .sort(
        (a, b) =>
          b.opportunity.signalStrength - a.opportunity.signalStrength ||
          b.opportunity.score - a.opportunity.score ||
          a.placeName.localeCompare(b.placeName),
      )
      .slice(0, 5),
    current,
  };
}

export function mergeOpportunityBaselines(
  existing: Record<string, OpportunityBaseline>,
  current: Record<string, OpportunityBaseline>,
) {
  return { ...existing, ...current };
}
