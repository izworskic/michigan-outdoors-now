import { NextResponse } from "next/server";
import { growthEventNames } from "../../lib/growth-contract";
import { landingQualitySummary, searchLandingIntents } from "../../lib/search-landings";
import { siteUrl } from "../../lib/site";
import { trailSearchPages } from "../../lib/trail-search-pages";
import {
  trailSearchExpansionGate,
  trailSearchOpportunities,
} from "../../lib/trail-search-opportunities";

export const runtime = "nodejs";

export async function GET() {
  const quality = landingQualitySummary();

  return NextResponse.json(
    {
      version: "1.1.0",
      generatedFrom: "repository-contract",
      canonical: siteUrl,
      owner: "https://chrisizworski.com/#person",
      launch: {
        locationIntentPages: quality.total,
        originsCovered: quality.originsCovered,
        families: searchLandingIntents.map((intent) => intent.slug),
        trailIntentPages: trailSearchPages.length,
        trailFamilies: trailSearchPages.map((page) => page.slug),
        trailSearchOpportunities,
        trailSearchExpansionGate,
        trailSearchExpansionState: "blocked-during-location-intent-measurement-window",
        excludedCanonicalOwners: {
          beaches: "https://chrisizworski.com/great-lakes-beaches/",
          freighters: "https://chrisizworski.com/great-lakes-freighter-tracking/",
          birding: "https://michiganbirdingreport.com/",
        },
      },
      measurement: {
        eventTaxonomy: growthEventNames,
        privacy: {
          allowedContext: [
            "surface",
            "origin slug",
            "intent slug",
            "page key",
            "fixed categories",
            "counts",
          ],
          forbidden: [
            "exact coordinates",
            "device location",
            "free-text search query",
            "remembered home city or ZIP",
            "favorite-region text",
            "saved-place names",
            "saved-place identifiers in My Outdoors change events",
            "local opportunity baselines",
          ],
        },
        evaluation: {
          weekly: "leading indicators only",
          completeWindowDays: 28,
          expansionRule:
            "Do not expand a search family until it demonstrates both qualified Search Console demand and downstream planning value.",
        },
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=3600",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
