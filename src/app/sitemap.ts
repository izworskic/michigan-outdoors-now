import type { MetadataRoute } from "next";
import { origins } from "../data/origins";
import { guides } from "../data/guides";
import { destinations } from "../data/destinations";
import { trailSearchIntents } from "../data/trail-search-intents";
import { searchLandings } from "../lib/search-landings";
import { trailSearchPages } from "../lib/trail-search-pages";
import { siteUrl } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl },
    { url: `${siteUrl}/how-it-works` },
    { url: `${siteUrl}/ideas` },
    { url: `${siteUrl}/explore` },
    ...guides.map((guide) => ({ url: `${siteUrl}/ideas/${guide.slug}` })),
    ...origins.map((origin) => ({ url: `${siteUrl}/from/${origin.slug}` })),
    ...searchLandings.map((landing) => ({
      url: `${siteUrl}/from/${landing.origin.slug}/${landing.intent.slug}`,
    })),
    { url: `${siteUrl}/trails` },
    ...trailSearchIntents.map((intent) => ({
      url: `${siteUrl}/trails/${intent.slug}`,
    })),
    ...trailSearchPages.map((page) => ({
      url: `${siteUrl}/hiking/${page.slug}`,
    })),
    ...destinations.map((destination) => ({ url: `${siteUrl}/places/${destination.id}` })),
  ];
}
