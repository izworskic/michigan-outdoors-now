"use client";

import { track } from "@vercel/analytics";

export { growthEventNames } from "./growth-contract";
export type { GrowthContext, GrowthEventName } from "./growth-contract";
import type { GrowthContext, GrowthEventName } from "./growth-contract";

export type GrowthEventProperties = Record<string, string | number | boolean>;

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
