import type { SearchConsoleRow } from "./growth-opportunities";
import { trailSearchOpportunities } from "./trail-search-opportunities";

export type TrailCandidateDemand = {
  slug: string;
  label: string;
  profileCount: number;
  destinationCount: number;
  matchedQueries: number;
  impressions: number;
  clicks: number;
  ctr: number;
  weightedPosition: number;
  state: "demand-signal-only";
};

const patterns: Record<string, RegExp> = {
  "loop-hikes-michigan": /\b(loop hike|loop hikes|loop trail|loop trails|hiking loop|hiking loops)\b/i,
  "point-to-point-hikes-michigan":
    /\b(point[- ]to[- ]point|through hike|through hiking|shuttle hike|one way hike|one-way hike)\b/i,
  "lower-barrier-hikes-michigan":
    /\b(accessible hike|accessible trail|wheelchair trail|stroller trail|paved hike|paved trail|lower barrier|easy access trail)\b/i,
  "michigan-state-park-hikes":
    /\b(michigan state park hike|michigan state park hikes|state park hiking michigan|state park trails michigan|michigan state park trails)\b/i,
  "national-park-hikes-michigan":
    /\b(michigan national park hike|michigan national park hikes|national park hiking michigan|pictured rocks hike|sleeping bear hike|isle royale hike)\b/i,
  "short-hikes-under-3-miles-michigan":
    /\b(hike under 3 miles|hikes under 3 miles|2 mile hike michigan|two mile hike michigan|3 mile hike michigan|three mile hike michigan|short michigan hike|short hikes michigan)\b/i,
};

export function trailCandidateDemand(
  rows: SearchConsoleRow[],
): TrailCandidateDemand[] {
  return trailSearchOpportunities.map((candidate) => {
    const pattern = patterns[candidate.slug];
    const matched = pattern
      ? rows.filter((row) => pattern.test(row.query))
      : [];
    const impressions = matched.reduce((sum, row) => sum + row.impressions, 0);
    const clicks = matched.reduce((sum, row) => sum + row.clicks, 0);
    const weightedPosition = impressions
      ? matched.reduce((sum, row) => sum + row.position * row.impressions, 0) /
        impressions
      : 0;

    return {
      slug: candidate.slug,
      label: candidate.label,
      profileCount: candidate.profileCount,
      destinationCount: candidate.destinationCount,
      matchedQueries: matched.length,
      impressions,
      clicks,
      ctr: impressions ? clicks / impressions : 0,
      weightedPosition,
      state: "demand-signal-only" as const,
    };
  }).sort((a, b) => b.impressions - a.impressions);
}

export const trailCandidateDemandRule =
  "Candidate demand is a Search Console leading indicator only. It cannot authorize a new canonical without the complete family expansion gate and central cannibalization review.";
