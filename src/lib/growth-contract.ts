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

export const growthEventNames = [
  "search_landing_viewed",
  "shared_setup_loaded",
  "device_location_used",
  "no_results_recovery",
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
  "day_plan_built",
  "day_plan_opened",
  "decision_argument_opened",
  "proof_ledger_opened",
  "departure_mode_opened",
  "directions_opened",
  "opportunity_opened",
  "opportunity_verify_opened",
  "my_outdoors_loaded",
  "my_outdoors_opened",
  "my_outdoors_saved",
  "my_outdoors_applied",
  "my_outdoors_place_remembered",
  "my_outdoors_place_saved",
  "my_outdoors_place_unsaved",
  "my_outdoors_visited_toggled",
  "my_outdoors_changes_detected",
  "my_outdoors_changes_seen",
  "my_outdoors_change_opened",
  "my_outdoors_change_verify_opened",
] as const;

export type GrowthEventName = (typeof growthEventNames)[number];
