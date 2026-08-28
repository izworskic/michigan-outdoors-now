"use client";

import { track } from "@vercel/analytics";

export type GrowthSurface =
  | "homepage_planner"
  | "location_intent"
  | "flagship_semantic"
  | "place_detail"
  | "guide";

export type GrowthContext = {
  surface: GrowthSurface;
  originSlug?: string;
  intentSlug?: string;
  pageKey?: string;
};

export type GrowthEventProperties = Record<string, string | number | boolean>;

export const growthEventNames = [
  "search_landing_viewed",
  "planner_started",
  "planner_completed",
  "planner_failed",
  "planner_preset_selected",
  "trip_primary_changed",
  "trip_backup_changed",
  "trip_plan_shared",
  "place_detail_opened",
  "outbound_map_opened",
  "outbound_official_opened",
  "related_tool_opened",
  "semantic_search_started",
  "semantic_search_completed",
  "semantic_search_failed",
  "semantic_result_opened",
  "surprise_me_used",
  "surprise_rejected",
  "place_kept",
  "place_unkept",
  "comparison_opened",
  "decision_argument_opened",
  "proof_ledger_opened",
  "departure_mode_opened",
  "directions_opened",
] as const;

export type GrowthEventName = (typeof growthEventNames)[number];

function cleanContext(context: GrowthContext | undefined): GrowthEventProperties {
  if (!context) return {};
  const result: GrowthEventProperties = { surface: context.surface };
  if (context.originSlug) result.origin = context.originSlug.slice(0, 48);
  if (context.intentSlug) result.intent = context.intentSlug.slice(0, 48);
  if (context.pageKey) result.page = context.pageKey.slice(0, 96);
  return result;
}

export function trackGrowthEvent(
  name: GrowthEventName,
  context?: GrowthContext,
  properties: GrowthEventProperties = {},
) {
  try {
    track(name, {
      ...cleanContext(context),
      ...properties,
    });
  } catch {
    // Growth measurement must never interfere with trip planning.
  }
}
