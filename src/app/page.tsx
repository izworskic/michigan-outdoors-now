import type { Metadata } from "next";
import Link from "next/link";
import { DestinationExplorer } from "../components/destination-explorer";
import { destinations } from "../data/destinations";
import { jsonLd, personSchema, siteUrl } from "../lib/site";

export const metadata: Metadata = {
  title: "Michigan Outdoor Map: Trails, Closures and Decision-Ready Places",
  description:
    "Explore Michigan with official DNR trail geometry, temporary closures and reroutes, plus decision-ready outdoor destinations.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Michigan Outdoors Now: Official Trails + Decision Intelligence",
    description:
      "A statewide Michigan outdoor map using official DNR trails, live access changes, and separate decision-ready places.",
    url: "/",
  },
  twitter: {
    title: "Michigan Outdoors Now: Official Trails + Decision Intelligence",
    description:
      "Explore Michigan DNR trails, access changes and decision-ready outdoor places.",
  },
};

export default function Home() {
  const pageUrl = siteUrl;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${pageUrl}/#outdoor-map`,
        name: "Michigan Outdoors Now",
        url: pageUrl,
        applicationCategory: "TravelApplication",
        operatingSystem: "Any",
        description: metadata.description,
        author: { "@id": personSchema["@id"] },
        mainEntity: { "@id": `${pageUrl}/#decision-ready` },
        featureList: [
          "Official Michigan DNR statewide trail geometry",
          "Temporary DNR trail closures and reroutes",
          "Decision-ready Michigan outdoor places",
          "Search, near-me, filters, and contextual browse drawer",
        ],
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
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
        "@type": "ItemList",
        "@id": `${pageUrl}/#decision-ready`,
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
          <div>
            <h1>Explore Michigan outdoors.</h1>
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
