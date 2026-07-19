import type { MetadataRoute } from "next";
import { origins } from "../data/origins";
import { siteUrl } from "../lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl },
    { url: `${siteUrl}/how-it-works` },
    ...origins.map((origin) => ({ url: `${siteUrl}/from/${origin.slug}` })),
  ];
}
