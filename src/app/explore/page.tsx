import type { Metadata } from "next";
import Link from "next/link";
import { DestinationExplorer } from "../../components/destination-explorer";
import { destinations } from "../../data/destinations";
import { jsonLd, personSchema, siteUrl } from "../../lib/site";

export const metadata: Metadata = {
  title: "Michigan Outdoor Map and Destination Finder",
  description:
    "Explore a filterable Michigan outdoor map. Find curated beaches, hikes, paddling, birding, dark skies, freighters, family options, dog-compatible places, and lower-barrier access.",
  alternates: { canonical: "/explore" },
  openGraph: {
    title: "Michigan Outdoor Map and Destination Finder",
    description: "Filter 28 curated Michigan outdoor places by activity, region, family fit, dogs, and lower-barrier access.",
    url: "/explore",
  },
  twitter: {
    title: "Michigan Outdoor Map and Destination Finder",
    description: "Filter 28 curated Michigan outdoor places by activity, region, family fit, dogs, and lower-barrier access.",
  },
};

export default function ExplorePage() {
  const pageUrl = `${siteUrl}/explore`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${pageUrl}#page`,
        url: pageUrl,
        name: "Michigan Outdoor Map and Destination Finder",
        description: metadata.description,
        author: { "@id": personSchema["@id"] },
        isPartOf: { "@id": `${siteUrl}/#website` },
        mainEntity: { "@id": `${pageUrl}#places` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Michigan Outdoors Now", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "Explore the map", item: pageUrl },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#places`,
        name: "Curated Michigan outdoor destinations",
        numberOfItems: destinations.length,
        itemListElement: destinations.map((destination, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: destination.name,
          url: `${siteUrl}/places/${destination.id}`,
        })),
      },
    ],
  };

  return (
    <>
      <header className="explore-hero">
        <div className="content-wrap explore-hero-grid">
          <div>
            <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span>Explore</span></nav>
            <p className="eyebrow eyebrow-light">A map that starts with your needs</p>
            <h1>Find your kind of Michigan outside.</h1>
          </div>
          <div>
            <p>Not every park is the right park today. Filter a deliberately small Michigan collection by what you want to do and who needs the plan to work.</p>
            <a className="hero-button" href="#destination-finder">Open the finder <span aria-hidden="true">↓</span></a>
          </div>
        </div>
      </header>

      <section className="explore-answer content-wrap" aria-labelledby="explore-answer-title">
        <p className="eyebrow">Quick answer</p>
        <h2 id="explore-answer-title">How do I find an outdoor place in Michigan?</h2>
        <p>
          Start with the activity and Michigan region, then filter for family fit, dog-compatible access,
          or lower-barrier possibilities. Open a destination to see today’s broad forecast signals,
          practical access context, nearby alternatives, the official source, and a live trip planner.
        </p>
        <aside>
          <strong>What makes this different</strong>
          <span>This finder connects discovery to a real decision. It does not try to replace Michigan’s complete official park, trail, campground, or accessibility directories.</span>
        </aside>
      </section>

      <div className="content-wrap" id="destination-finder">
        <DestinationExplorer />
      </div>

      <section className="explore-next">
        <div className="content-wrap explore-next-grid">
          <div><p className="eyebrow eyebrow-light">Need the tool to decide?</p><h2>Use your exact starting point and current conditions.</h2></div>
          <div>
            <Link href="/#planner">Build my Michigan plan →</Link>
            <Link href="/ideas">Choose a people-first trip guide →</Link>
          </div>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
