import type { Metadata } from "next";
import Link from "next/link";
import { guides } from "../../data/guides";
import { jsonLd, personSchema, siteUrl } from "../../lib/site";

export const metadata: Metadata = {
  title: "Michigan Outdoor Trip Ideas and Planners",
  description:
    "Choose the kind of Michigan outdoor day you need—family, beach, hiking, birding, paddling, stargazing, freighters, dog-friendly, or lower-barrier—then build a live-condition-aware plan.",
  alternates: { canonical: "/ideas" },
  openGraph: {
    title: "Michigan Outdoor Trip Ideas and Planners",
    description: "Start with your real-life situation, then compare practical Michigan outdoor plans.",
    url: "/ideas",
  },
};

export default function IdeasPage() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${siteUrl}/ideas#page`,
        url: `${siteUrl}/ideas`,
        name: "Michigan Outdoor Trip Ideas and Planners",
        description: metadata.description,
        author: { "@id": personSchema["@id"] },
        isPartOf: { "@id": `${siteUrl}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Michigan Outdoors Now", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "Trip ideas", item: `${siteUrl}/ideas` },
        ],
      },
      {
        "@type": "ItemList",
        name: "Michigan outdoor planning guides",
        numberOfItems: guides.length,
        itemListElement: guides.map((guide, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: guide.title,
          url: `${siteUrl}/ideas/${guide.slug}`,
        })),
      },
    ],
  };

  return (
    <>
      <section className="ideas-hero">
        <div className="content-wrap ideas-hero-grid">
          <div>
            <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span>Trip ideas</span></nav>
            <p className="eyebrow eyebrow-light">Start with your real life</p>
            <h1>What kind of Michigan day are you trying to make?</h1>
          </div>
          <p>
            Skip the generic bucket list. Choose the situation that sounds like you, get the useful
            planning details, then run the live planner from your Michigan starting point.
          </p>
        </div>
      </section>

      <section className="guide-index content-wrap" aria-labelledby="guide-index-title">
        <div className="section-kicker"><span>CHOOSE YOUR START</span><i /></div>
        <div className="guide-index-heading">
          <h2 id="guide-index-title">Ten ways into one useful decision.</h2>
          <p>Each guide answers a different search and opens a planner already shaped for that need.</p>
        </div>
        <div className="guide-card-grid">
          {guides.map((guide, index) => (
            <Link className="guide-card" href={`/ideas/${guide.slug}`} key={guide.slug}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{guide.entryLabel}</h3>
              <p>{guide.entryDetail}</p>
              <strong>{guide.shortTitle} →</strong>
            </Link>
          ))}
        </div>
      </section>

      <section className="ideas-cta">
        <div className="content-wrap">
          <p className="eyebrow eyebrow-light">Already know what you want?</p>
          <h2>Go straight to the live Michigan planner.</h2>
          <Link className="hero-button" href="/#planner">Build my plan <span aria-hidden="true">→</span></Link>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
