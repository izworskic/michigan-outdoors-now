import type { MetadataRoute } from "next";
import { origins } from "../data/origins";
import { guides } from "../data/guides";
import { siteUrl } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl },
    { url: `${siteUrl}/how-it-works` },
    { url: `${siteUrl}/ideas` },
    ...guides.map((guide) => ({ url: `${siteUrl}/ideas/${guide.slug}` })),
    ...origins.map((origin) => ({ url: `${siteUrl}/from/${origin.slug}` })),
  ];
}
