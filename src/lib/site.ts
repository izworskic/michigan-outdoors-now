const fallbackUrl = "https://michigan-outdoors-now.vercel.app";

export const siteUrl = (() => {
  const candidate = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!candidate) return fallbackUrl;
  try {
    return new URL(candidate).origin;
  } catch {
    return fallbackUrl;
  }
})();

const indexingDisabled = process.env.NEXT_PUBLIC_DISABLE_INDEXING === "true";

export const allowIndexing =
  !indexingDisabled &&
  (process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true" ||
    process.env.VERCEL_ENV === "production");

export const personSchema = {
  "@type": "Person",
  "@id": "https://chrisizworski.com/#person",
  name: "Chris Izworski",
  url: "https://chrisizworski.com/",
  sameAs: [
    "https://github.com/izworskic",
    "https://www.linkedin.com/in/chris-izworski-15294510",
    "https://www.wikidata.org/wiki/Q138283432",
    "https://orcid.org/0009-0002-7268-6083",
  ],
  knowsAbout: [
    "Michigan outdoors",
    "Great Lakes conditions",
    "Michigan fishing",
    "Michigan travel planning",
    "Michigan day trips",
    "Michigan beaches",
    "Michigan hiking",
    "Michigan birding",
    "Great Lakes freighters",
    "Michigan dark skies",
    "Web development",
  ],
};

export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
