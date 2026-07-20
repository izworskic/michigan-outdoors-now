import type { Metadata } from "next";
import Link from "next/link";
import { DestinationExplorer } from "../../components/destination-explorer";
import { destinations } from "../../data/destinations";
import { jsonLd, personSchema, siteUrl } from "../../lib/site";

export const metadata: Metadata = {
  title: "Interactive Michigan Outdoor Map and Destination Finder",
  description:
    "Use a real interactive Michigan map to find outdoor places near you. Filter beaches, hikes, paddling, birding, dark skies, freighters, family options, dogs, and access.",
  alternates: { canonical: "/explore" },
  openGraph: {
    title: "Interactive Michigan Outdoor Map and Destination Finder",
    description: "See 28 Michigan outdoor places on a real map, filter them, or rank them from your location.",
    url: "/explore",
  },
  twitter: {
    title: "Interactive Michigan Outdoor Map and Destination Finder",
    description: "See 28 Michigan outdoor places on a real map, filter them, or rank them from your location.",
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
      <header className="explore-hero explore-hero-compact">
        <div className="content-wrap explore-hero-grid">
          <div>
            <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span>Explore</span></nav>
            <p className="eyebrow eyebrow-light">Real map · useful filters · no account</p>
            <h1>Find a Michigan outdoor place. <span>Fast.</span></h1>
          </div>
          <div>
            <p>See all 28 places at once, tap a numbered pin, or use your location to put the closest matches first.</p>
            <a className="hero-button" href="#destination-finder">Open the map <span aria-hidden="true">↓</span></a>
          </div>
        </div>
      </header>

      <div className="content-wrap" id="destination-finder">
        <DestinationExplorer />
      </div>

      <section className="explore-answer content-wrap" aria-labelledby="explore-answer-title">
        <p className="eyebrow">From browsing to a decision</p>
        <h2 id="explore-answer-title">What can this Michigan outdoor map help me decide?</h2>
        <p>
          Use the map to understand where every place is, narrow the collection by activity or region,
          and rank matches from your location. Each destination page adds current broad conditions,
          practical access context, nearby alternatives, official details, and the trip planner.
        </p>
        <aside>
          <strong>A focused collection</strong>
          <span>These 28 places are decision-ready starting points—not a claim to be Michigan’s complete park, trail, campground, or accessibility directory.</span>
        </aside>
      </section>

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
