"use client";

import { track } from "@vercel/analytics";

export { growthEventNames } from "./growth-contract";
export type { GrowthContext, GrowthEventName } from "./growth-contract";
import type { GrowthContext, GrowthEventName } from "./growth-contract";

export type GrowthEventProperties = Record<string, string | number | boolean>;

const REFERRAL_SESSION_KEY = "michigan_outdoors_now_publisher_referral";
const PUBLISHER_CAMPAIGNS = new Set([
  "michigan_outdoors_now_embed",
  "michigan_outdoors_now_attribution",
]);

type PublisherReferral = {
  source: string;
  campaign: string;
};

function sanitizeReferralValue(value: string, limit = 64) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, limit);
}

function currentPublisherReferral(): PublisherReferral | undefined {
  if (typeof window === "undefined") return undefined;

  try {
    const params = new URLSearchParams(window.location.search);
    const source = sanitizeReferralValue(params.get("utm_source") ?? "");
    const campaign = sanitizeReferralValue(params.get("utm_campaign") ?? "", 80);

    if (source && PUBLISHER_CAMPAIGNS.has(campaign)) {
      const referral = { source, campaign };
      window.sessionStorage.setItem(REFERRAL_SESSION_KEY, JSON.stringify(referral));
      return referral;
    }

    const stored = window.sessionStorage.getItem(REFERRAL_SESSION_KEY);
    if (!stored) return undefined;
    const parsed = JSON.parse(stored) as Partial<PublisherReferral>;
    const storedSource = sanitizeReferralValue(String(parsed.source ?? ""));
    const storedCampaign = sanitizeReferralValue(String(parsed.campaign ?? ""), 80);
    if (!storedSource || !PUBLISHER_CAMPAIGNS.has(storedCampaign)) return undefined;
    return { source: storedSource, campaign: storedCampaign };
  } catch {
    return undefined;
  }
}

function cleanContext(context: GrowthContext | undefined): GrowthEventProperties {
  const result: GrowthEventProperties = {};
  if (context) {
    result.surface = context.surface;
    if (context.originSlug) result.origin = context.originSlug.slice(0, 48);
    if (context.intentSlug) result.intent = context.intentSlug.slice(0, 48);
    if (context.pageKey) result.page = context.pageKey.slice(0, 96);
  }

  const referral = currentPublisherReferral();
  if (referral) {
    result.referral_source = referral.source;
    result.referral_campaign = referral.campaign;
  }

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
