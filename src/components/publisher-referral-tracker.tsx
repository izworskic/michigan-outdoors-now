"use client";

import { useEffect } from "react";
import { trackGrowthEvent } from "../lib/growth-analytics";

const campaigns = new Set([
  "michigan_outdoors_now_embed",
  "michigan_outdoors_now_attribution",
]);

export function PublisherReferralTracker() {
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const source = (params.get("utm_source") ?? "").trim();
      const campaign = (params.get("utm_campaign") ?? "").trim().toLowerCase();
      if (!source || !campaigns.has(campaign)) return;

      const eventKey = "michigan_outdoors_now_publisher_landing_recorded";
      const signature = `${source.slice(0, 64)}|${campaign}|${window.location.pathname.slice(0, 96)}`;
      if (window.sessionStorage.getItem(eventKey) === signature) return;
      window.sessionStorage.setItem(eventKey, signature);

      trackGrowthEvent("publisher_referral_landed", undefined, {
        landing_path: window.location.pathname.slice(0, 96),
      });
    } catch {
      // Referral measurement must never interfere with trip planning.
    }
  }, []);

  return null;
}
