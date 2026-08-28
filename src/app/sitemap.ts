import type { MetadataRoute } from "next";
import { origins } from "../data/origins";
import { guides } from "../data/guides";
import { destinations } from "../data/destinations";
import { searchLandings } from "../lib/search-landings";
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
    ...destinations.map((destination) => ({ url: `${siteUrl}/places/${destination.id}` })),
  ];
}
