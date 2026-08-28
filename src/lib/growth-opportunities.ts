export type SearchConsoleRow = {
  page: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  family?: string;
  origin?: string;
};

export type ProductFunnelRow = {
  pageKey: string;
  surface: string;
  origin?: string;
  intent?: string;
  landingViews: number;
  plannerStarts: number;
  plannerCompletions: number;
  resultOpens: number;
  departures: number;
  directions: number;
};

export type GrowthAction =
  | "PROTECT"
  | "PUSH_CTR"
  | "BUILD_AUTHORITY"
  | "UX_REPAIR"
  | "HOLD"
  | "EXPAND_FAMILY"
  | "DO_NOT_EXPAND";

export type SearchOpportunity = {
  row: SearchConsoleRow;
  action: GrowthAction;
  expectedCtr: number;
  ctrGap: number;
  reason: string;
};

function expectedCtr(position: number) {
  if (position <= 3) return 0.09;
  if (position <= 5) return 0.06;
  if (position <= 10) return 0.035;
  if (position <= 15) return 0.022;
  if (position <= 20) return 0.015;
  if (position <= 30) return 0.01;
  return 0.006;
}

export function scoreSearchOpportunity(
  row: SearchConsoleRow,
  funnel?: ProductFunnelRow,
): SearchOpportunity {
  const modeledCtr = expectedCtr(row.position);
  const ctrGap = Math.max(0, modeledCtr - row.ctr);
  const plannerStartRate =
    funnel && funnel.landingViews > 0 ? funnel.plannerStarts / funnel.landingViews : null;

  if (
    funnel &&
    funnel.landingViews >= 100 &&
    plannerStartRate !== null &&
    plannerStartRate < 0.03
  ) {
    return {
      row,
      action: "UX_REPAIR",
      expectedCtr: modeledCtr,
      ctrGap,
      reason:
        "The page has enough visits to judge the handoff, but fewer than 3% start the planner. Fix the landing-to-tool transition before buying more impressions.",
    };
  }

  if (row.impressions >= 100 && row.position >= 4 && row.position <= 15 && row.ctr < modeledCtr * 0.7) {
    return {
      row,
      action: "PUSH_CTR",
      expectedCtr: modeledCtr,
      ctrGap,
      reason:
        "Meaningful impressions are already near page one, but CTR trails the position-adjusted target. Test title, snippet, image, and first-answer alignment before expanding the cluster.",
    };
  }

  if (row.impressions >= 75 && row.position > 8 && row.position <= 30) {
    return {
      row,
      action: "BUILD_AUTHORITY",
      expectedCtr: modeledCtr,
      ctrGap,
      reason:
        "Google is testing the page but rank is still the limiting factor. Strengthen the canonical answer, destination depth, and contextual inbound links.",
    };
  }

  if (row.impressions >= 100 && row.position <= 5 && row.ctr >= modeledCtr * 0.8) {
    return {
      row,
      action: "PROTECT",
      expectedCtr: modeledCtr,
      ctrGap,
      reason:
        "The page is earning strong visibility and an acceptable CTR for position. Protect the treatment and measure before changing it.",
    };
  }

  return {
    row,
    action: "HOLD",
    expectedCtr: modeledCtr,
    ctrGap,
    reason:
      "There is not enough evidence yet for a search-facing change. Keep the page stable and collect a comparable window.",
  };
}

export type FamilyGrowthDecision = {
  family: string;
  action: "EXPAND_FAMILY" | "DO_NOT_EXPAND" | "HOLD";
  impressions: number;
  clicks: number;
  plannerCompletions: number;
  directions: number;
  reason: string;
};

export function scoreFamilyGrowth(
  family: string,
  searchRows: SearchConsoleRow[],
  funnelRows: ProductFunnelRow[],
): FamilyGrowthDecision {
  const familySearch = searchRows.filter((row) => row.family === family);
  const familyFunnels = funnelRows.filter((row) => row.intent === family);
  const impressions = familySearch.reduce((sum, row) => sum + row.impressions, 0);
  const clicks = familySearch.reduce((sum, row) => sum + row.clicks, 0);
  const landingViews = familyFunnels.reduce((sum, row) => sum + row.landingViews, 0);
  const plannerStarts = familyFunnels.reduce((sum, row) => sum + row.plannerStarts, 0);
  const plannerCompletions = familyFunnels.reduce((sum, row) => sum + row.plannerCompletions, 0);
  const directions = familyFunnels.reduce((sum, row) => sum + row.directions, 0);
  const startRate = landingViews > 0 ? plannerStarts / landingViews : 0;

  if (
    impressions >= 250 &&
    clicks >= 5 &&
    plannerCompletions >= 10 &&
    directions >= 3
  ) {
    return {
      family,
      action: "EXPAND_FAMILY",
      impressions,
      clicks,
      plannerCompletions,
      directions,
      reason:
        "The family has demonstrated search demand and downstream planning value. New pages still need the distinct-intent and duplicate-signature gates.",
    };
  }

  if (impressions >= 500 && landingViews >= 100 && startRate < 0.02) {
    return {
      family,
      action: "DO_NOT_EXPAND",
      impressions,
      clicks,
      plannerCompletions,
      directions,
      reason:
        "The family is getting visibility but almost nobody starts planning. Fix product/intent fit before creating more search surface.",
    };
  }

  return {
    family,
    action: "HOLD",
    impressions,
    clicks,
    plannerCompletions,
    directions,
    reason:
      "Hold the current family stable until both search demand and downstream decision behavior are strong enough to justify expansion.",
  };
}
