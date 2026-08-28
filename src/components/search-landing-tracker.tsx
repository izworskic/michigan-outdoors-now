"use client";

import { useEffect } from "react";
import { trackGrowthEvent, type GrowthContext } from "../lib/growth-analytics";

export function SearchLandingTracker({ context }: { context: GrowthContext }) {
  useEffect(() => {
    trackGrowthEvent("search_landing_viewed", context);
  }, [context]);

  return null;
}
