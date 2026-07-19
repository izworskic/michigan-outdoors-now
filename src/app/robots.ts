import type { MetadataRoute } from "next";
import { allowIndexing, siteUrl } from "../lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: allowIndexing
      ? { userAgent: "*", allow: "/" }
      : { userAgent: "*", disallow: "/" },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
