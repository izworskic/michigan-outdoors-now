import type { Metadata } from "next";
import Link from "next/link";
import { DestinationExplorer } from "../../components/destination-explorer";
import { destinationCount, destinations } from "../../data/destinations";
import { jsonLd, personSchema, siteUrl } from "../../lib/site";

export const metadata: Metadata = {
  title: "Michigan Outdoor Map: Trails, Parks and Decision-Ready Places",
  description:
    "Explore Michigan with official DNR trail geometry plus decision-ready outdoor destinations. Browse hiking, biking, water, ski, snowshoe, ORV, snowmobile and rail-trail layers.",
  alternates: { canonical: "/explore" },
  openGraph: {
    title: "Michigan Outdoor Map: Official Trails + Decision Intelligence",
    description:
      "A statewide discovery map using Michigan DNR trail data, with separate decision-ready places for current-condition planning.",
    url: "/explore",
  },
  twitter: {
    title: "Michigan Outdoor Map: Official Trails + Decision Intelligence",
    description:
      "Explore the statewide DNR trail network and decision-ready Michigan outdoor places.",
  },
};

const coverage = [
  {
    value: "103",
    label: "state parks & recreation areas",
    href: "https://www.michigan.gov/dnr/places/state-parks",
  },
  {
    value: "140+",
    label: "state forest campgrounds",
    href: "https://www.michigan.gov/dnr/things-to-do/camping-and-lodging/state-forest-campgrounds",
  },
  {
    value: "1,300+",
    label: "boating access sites",
    href: "https://www.michigan.gov/dnr/managing-resources/prd/waterways",
  },
  {
    value: "13,700+",
    label: "state-designated trail miles",
    href: "https://www.michigan.gov/dnr/managing-resources/prd/trails",
  },
];

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
        name: "Michigan DNR Trails Open Data — simplified statewide trail layer",
        description:
          "Official statewide trail geometry used for broad outdoor discovery. Decision-ready destination scoring is a separate dataset with stricter requirements.",
        creator: { "@type": "GovernmentOrganization", name: "Michigan Department of Natural Resources" },
        url: "https://gisagoegle.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/FeatureServer/21",
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
      <header className="explore-hero universe-hero">
        <div className="content-wrap universe-hero-grid">
          <div>
            <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><span>Explore</span></nav>
            <p className="eyebrow eyebrow-light">Official statewide discovery · strict decision intelligence</p>
            <h1>Explore Michigan outdoors. <span>Not a shortlist.</span></h1>
          </div>
          <div className="universe-hero-copy">
            <p>
              Michigan Outdoors Now now separates two jobs that should never have been conflated:
              discovering the enormous outdoor universe, and making a trustworthy live decision.
            </p>
            <p>
              Official Michigan DNR trail geometry fills the discovery map. The {destinationCount} brighter
              decision dots are places where we currently have enough structured information to provide
              deeper conditions and planning.
            </p>
            <a className="hero-button" href="#destination-finder">Explore the state <span aria-hidden="true">↓</span></a>
          </div>
        </div>
      </header>

      <section className="universe-coverage" aria-label="Michigan outdoor system scale">
        <div className="content-wrap universe-coverage-grid">
          {coverage.map((item) => (
            <a href={item.href} key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
              <small>Michigan DNR →</small>
            </a>
          ))}
        </div>
      </section>

      <div className="content-wrap" id="destination-finder">
        <DestinationExplorer />
      </div>

      <section className="universe-explainer content-wrap" aria-labelledby="universe-explainer-title">
        <div className="universe-explainer-head">
          <p className="eyebrow">The platform model</p>
          <h2 id="universe-explainer-title">Broad discovery. Narrow confidence.</h2>
          <p>
            Comprehensiveness should not force fake precision. The map can expose far more of Michigan
            while the decision engine stays conservative about what it can actually score.
          </p>
        </div>
        <div className="universe-explainer-grid">
          <article>
            <span>DISCOVERY UNIVERSE</span>
            <h3>Show people what exists.</h3>
            <p>
              Official DNR trail geometry expands discovery far beyond a hand-curated set. Layer hiking,
              biking, water trails, skiing, snowshoeing, ORV, snowmobile and rail trails across the state.
            </p>
          </article>
          <article>
            <span>DECISION-READY</span>
            <h3>Only score what we can defend.</h3>
            <p>
              A decision dot means the platform has a structured destination record and can combine it with
              the decision engine. Missing marine, trail, closure or seasonal inputs are still disclosed rather
              than invented.
            </p>
          </article>
          <article>
            <span>PROMOTION PATH</span>
            <h3>Grow intelligence into the universe.</h3>
            <p>
              Search demand, usage and data availability should determine which discovered places get promoted
              next into destination pages, live scoring, specialist data and alerting.
            </p>
          </article>
        </div>
      </section>

      <section className="explore-next">
        <div className="content-wrap explore-next-grid">
          <div><p className="eyebrow eyebrow-light">Need the engine to decide?</p><h2>Turn discovery into where, what and when.</h2></div>
          <div>
            <Link href="/#statewide">See the statewide live answer →</Link>
            <Link href="/#planner">Build a drive-time plan →</Link>
            <Link href="/ideas">Browse trip ideas →</Link>
          </div>
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
