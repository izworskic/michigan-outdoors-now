import type { Metadata } from "next";
import Link from "next/link";
import { trailSearchIntents } from "../../data/trail-search-intents";
import { jsonLd, personSchema, siteUrl } from "../../lib/site";

export const metadata: Metadata = {
  title: "Michigan Hiking Trail Planner | Trail Truth",
  description:
    "Use Trail Truth to investigate Michigan hikes by route length, effort, terrain and current conditions without pretending park-level mileage is one hike.",
  alternates: { canonical: "/trails" },
};

export default function TrailsHubPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${siteUrl}/trails#page`,
        url: `${siteUrl}/trails`,
        name: "Michigan hiking Trail Truth",
        description: metadata.description,
        author: { "@id": personSchema["@id"] },
        isPartOf: { "@id": `${siteUrl}/#website` },
      },
      {
        "@type": "ItemList",
        itemListElement: trailSearchIntents.map((intent, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: intent.label,
          url: `${siteUrl}/trails/${intent.slug}`,
        })),
      },
    ],
  };

  return (
    <>
      <article className="trail-intent-hub">
        <header className="content-wrap trail-intent-hero">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link><span>/</span><span>Trail Truth</span>
          </nav>
          <p className="eyebrow">Route-specific hiking decisions</p>
          <h1>Michigan Trail Truth</h1>
          <p>
            Park names and trail-system mileage are not enough. Start with the hiking question you actually have, then verify the selected route, mileage, ascent, weather and access before you leave.
          </p>
        </header>

        <section className="content-wrap trail-intent-grid" aria-label="Michigan hiking questions">
          {trailSearchIntents.map((intent) => (
            <Link href={`/trails/${intent.slug}`} key={intent.slug}>
              <span>{intent.label}</span>
              <strong>{intent.h1}</strong>
              <p>{intent.description}</p>
              <b>Open Trail Truth →</b>
            </Link>
          ))}
        </section>

        <section className="content-wrap trail-intent-method">
          <div>
            <p className="eyebrow">What Trail Truth means</p>
            <h2>One selected route, with the unknowns left visible.</h2>
          </div>
          <p>
            Michigan Outdoors Now prefers a named mapped hiking relation when one is available. Tagged mileage is strongest; relation geometry is the fallback. Ascent may be tagged or estimated from sampled terrain. Michigan DNR remains the source for nearby official trail and access-change data.
          </p>
        </section>
      </article>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />
    </>
  );
}
