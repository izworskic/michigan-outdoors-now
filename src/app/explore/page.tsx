import type { Metadata } from "next";
import Link from "next/link";
import { DestinationExplorer } from "../../components/destination-explorer";
import { destinations } from "../../data/destinations";
import { jsonLd, personSchema, siteUrl } from "../../lib/site";

export const metadata: Metadata = {
  title: "Michigan Outdoor Map: Trails, Parks and Decision-Ready Places",
  description:
    "Explore Michigan with official DNR trail geometry, temporary closures and reroutes, plus decision-ready outdoor destinations.",
  alternates: { canonical: "/explore" },
  openGraph: {
    title: "Michigan Outdoor Map: Official Trails + Decision Intelligence",
    description:
      "A statewide Michigan outdoor map using official DNR trails, live access changes, and separate decision-ready places.",
    url: "/explore",
  },
  twitter: {
    title: "Michigan Outdoor Map: Official Trails + Decision Intelligence",
    description:
      "Explore Michigan DNR trails, access changes and decision-ready outdoor places.",
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
        name: "Michigan Outdoor Universe Map",
        description: metadata.description,
        author: { "@id": personSchema["@id"] },
        isPartOf: { "@id": `${siteUrl}/#website` },
        mainEntity: { "@id": `${pageUrl}#decision-ready` },
      },
      {
        "@type": "Dataset",
        name: "Michigan DNR Trails Open Data",
        description:
          "Official statewide trail geometry plus temporary closure and reroute layers used for outdoor discovery and access context.",
        creator: { "@type": "GovernmentOrganization", name: "Michigan Department of Natural Resources" },
        url: "https://gisagoegle.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/FeatureServer/layers",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Michigan Outdoors Now", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "Explore Michigan outdoors", item: pageUrl },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#decision-ready`,
        name: "Decision-ready Michigan outdoor destinations",
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
      <header className="explore-command-head">
        <div className="content-wrap">
          <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span>Explore</span></nav>
          <div>
            <h1>Explore Michigan outdoors. <span>Not a shortlist.</span></h1>
            <p>Official DNR trails and access changes. Decision-ready places where the platform can go deeper.</p>
          </div>
        </div>
      </header>

      <div className="content-wrap explore-map-wrap" id="destination-finder">
        <DestinationExplorer />
      </div>

      <section className="explore-after-map content-wrap" aria-labelledby="explore-method-title">
        <div>
          <p className="eyebrow">Broad discovery. Narrow confidence.</p>
          <h2 id="explore-method-title">The map can be comprehensive without pretending every line has a live score.</h2>
        </div>
        <div>
          <p>
            DNR trail geometry, temporary closures and reroutes drive discovery. Bright decision dots are the smaller
            set where Michigan Outdoors Now has enough structured context for deeper conditions and trip planning.
          </p>
          <div className="explore-after-links">
            <Link href="/ideas/outdoors-today">Outdoor ideas for today →</Link>
            <Link href="/ideas">Browse trip ideas →</Link>
            <Link href="/how-it-works">How the decision model works →</Link>
          </div>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
