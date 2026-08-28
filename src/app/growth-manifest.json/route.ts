import { NextResponse } from "next/server";
import { growthEventNames } from "../../lib/growth-contract";
import { landingQualitySummary, searchLandingIntents } from "../../lib/search-landings";
import { siteUrl } from "../../lib/site";
import { trailSearchPages } from "../../lib/trail-search-pages";

export const runtime = "nodejs";

export async function GET() {
  const quality = landingQualitySummary();

  return NextResponse.json(
    {
      version: "1.0.0",
      generatedFrom: "repository-contract",
      canonical: siteUrl,
      owner: "https://chrisizworski.com/#person",
      launch: {
        locationIntentPages: quality.total,
        originsCovered: quality.originsCovered,
        families: searchLandingIntents.map((intent) => intent.slug),
        trailIntentPages: trailSearchPages.length,
        trailFamilies: trailSearchPages.map((page) => page.slug),
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
