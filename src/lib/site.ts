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

export const allowIndexing = process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";

export const personSchema = {
  "@type": "Person",
  "@id": "https://chrisizworski.com/#chris-izworski",
  name: "Chris Izworski",
  url: "https://chrisizworski.com/",
  sameAs: ["https://github.com/izworskic"],
  knowsAbout: [
    "Michigan outdoors",
    "Great Lakes conditions",
    "Michigan fishing",
    "Michigan travel planning",
    "Web development",
  ],
};

export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
