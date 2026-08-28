import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Planner } from "../../../../components/planner";
import {
  landingDirectAnswer,
  searchLandingByKey,
  searchLandings,
  searchLandingsForGuide,
  searchLandingsForOrigin,
} from "../../../../lib/search-landings";
import { jsonLd, personSchema, siteUrl } from "../../../../lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return searchLandings.map((landing) => ({
    origin: landing.origin.slug,
    intent: landing.intent.slug,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ origin: string; intent: string }>;
}): Promise<Metadata> {
  const { origin, intent } = await params;
  const landing = searchLandingByKey.get(`${origin}/${intent}`);
  if (!landing) return {};

  const title = landing.intent.title(landing.origin);
  const description = landing.intent.description(landing.origin);
  const canonical = `/from/${landing.origin.slug}/${landing.intent.slug}`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    authors: [{ name: "Chris Izworski", url: "https://chrisizworski.com/chris-izworski/" }],
    creator: "Chris Izworski",
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
      siteName: "Michigan Outdoors Now",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function LocationIntentPage({
  params,
}: {
  params: Promise<{ origin: string; intent: string }>;
}) {
  const { origin, intent } = await params;
  const landing = searchLandingByKey.get(`${origin}/${intent}`);
  if (!landing) notFound();

  const pageUrl = `${siteUrl}/from/${landing.origin.slug}/${landing.intent.slug}`;
  const siblingIntents = searchLandingsForOrigin(landing.origin.slug)
    .filter((candidate) => candidate.intent.slug !== landing.intent.slug)
    .slice(0, 5);
  const siblingOrigins = searchLandingsForGuide(landing.guide.slug)
    .filter((candidate) => candidate.origin.slug !== landing.origin.slug)
    .slice(0, 5);

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#page`,
        url: pageUrl,
        name: landing.intent.title(landing.origin),
        description: landing.intent.description(landing.origin),
        dateModified: "2026-08-28",
        inLanguage: "en-US",
        author: { "@id": personSchema["@id"] },
        creator: { "@id": personSchema["@id"] },
        isPartOf: { "@id": `${siteUrl}/#website` },
        mainEntity: { "@id": `${pageUrl}#places` },
        about: [
          { "@type": "Place", name: `${landing.origin.name}, Michigan` },
          { "@type": "Thing", name: landing.intent.label },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Michigan Outdoors Now", item: siteUrl },
          {
            "@type": "ListItem",
            position: 2,
            name: `From ${landing.origin.name}`,
            item: `${siteUrl}/from/${landing.origin.slug}`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: landing.intent.label,
            item: pageUrl,
          },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#places`,
        name: `${landing.intent.label} from ${landing.origin.name}`,
        numberOfItems: landing.places.length,
        itemListElement: landing.places.map((place, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: place.name,
          url: `${siteUrl}/places/${place.id}`,
        })),
      },
    ],
  };

  return (
    <>
      <article>
        <header className="search-landing-hero">
          <div className="content-wrap search-landing-hero-grid">
            <div>
              <nav className="breadcrumb" aria-label="Breadcrumb">
                <Link href="/">Home</Link>
                <span>/</span>
                <Link href={`/from/${landing.origin.slug}`}>From {landing.origin.name}</Link>
                <span>/</span>
                <span>{landing.intent.label}</span>
              </nav>
              <p className="eyebrow eyebrow-light">A real starting-city decision page</p>
              <h1>{landing.intent.h1(landing.origin)}</h1>
              <p className="search-landing-deck">{landing.intent.promise}</p>
              <p className="guide-review">
                By <a href="https://chrisizworski.com/chris-izworski/">Chris Izworski</a> · Updated August 28, 2026
              </p>
            </div>
            <aside className="search-landing-glance" aria-label="Planning scope">
              <p>PLANNING SCOPE</p>
              <dl>
                <div><dt>Start</dt><dd>{landing.origin.name}</dd></div>
                <div><dt>Initial drive window</dt><dd>Up to {landing.guide.planner.maxDriveHours} hours</dd></div>
                <div><dt>Curated matches</dt><dd>{landing.places.length}</dd></div>
              </dl>
            </aside>
          </div>
        </header>

        <section className="guide-answer content-wrap" aria-labelledby="location-intent-answer">
          <p className="eyebrow">Quick answer</p>
          <h2 id="location-intent-answer">Start with places that actually fit this trip.</h2>
          <p>{landingDirectAnswer(landing)}</p>
          <p className="search-landing-method">
            The crawlable list below is a stable starting answer, not a live safety claim. Distances are straight-line planning distances. The interactive planner adds routed travel and current confidence data where available.
          </p>
        </section>

        <section className="search-landing-results content-wrap" aria-labelledby="search-landing-results-title">
          <div className="section-kicker"><span>STRONG STARTING POINTS</span><i /></div>
          <div className="guide-section-heading">
            <h2 id="search-landing-results-title">{landing.intent.label} worth comparing from {landing.origin.name}</h2>
            <p>These places earn the page by having a real match in the curated inventory. They are not duplicated merely to create another city URL.</p>
          </div>
          <div className="search-landing-grid">
            {landing.places.slice(0, 6).map((place, index) => (
              <article key={place.id}>
                <span>{String(index + 1).padStart(2, "0")} · {place.area}</span>
                <h3>{place.name}</h3>
                <strong>~{Math.round(place.roughMiles)} straight-line mi</strong>
                <p>{place.summary}</p>
                <small>{place.matchReason}</small>
                <div className="guide-example-links">
                  <Link href={`/places/${place.id}`}>Plan this place →</Link>
                  <a href={place.officialUrl} target="_blank" rel="noreferrer">Official source ↗</a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <div className="content-wrap guide-planner-wrap">
          <div className="guide-planner-intro">
            <div>
              <p className="eyebrow">Make the answer current</p>
              <h2>Now rerank it for the day you are actually taking.</h2>
            </div>
            <p>
              The planner starts from {landing.origin.name} with {landing.intent.label.toLowerCase()} settings. It can add routed drive time, weather, access, comparison, and trip confidence.
            </p>
          </div>
          <Planner
            compactIntro
            defaultOrigin={landing.origin.name}
            initialDate={landing.guide.planner.date}
            initialMaxDriveHours={landing.guide.planner.maxDriveHours}
            initialActivities={landing.guide.planner.activities}
            initialKids={landing.guide.planner.kids}
            initialDog={landing.guide.planner.dog}
            initialAccessible={landing.guide.planner.accessible}
          />
        </div>

        <section className="search-landing-network content-wrap">
          <div>
            <p className="eyebrow">From {landing.origin.name}</p>
            <h2>Change the kind of day, not just the keyword.</h2>
            <div className="search-landing-link-list">
              {siblingIntents.map((candidate) => (
                <Link
                  href={`/from/${candidate.origin.slug}/${candidate.intent.slug}`}
                  key={candidate.intent.slug}
                >
                  {candidate.intent.label}<span>→</span>
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="eyebrow">Same decision, another start</p>
            <h2>{landing.intent.label} from other Michigan cities</h2>
            <div className="search-landing-link-list">
              {siblingOrigins.map((candidate) => (
                <Link
                  href={`/from/${candidate.origin.slug}/${candidate.intent.slug}`}
                  key={candidate.origin.slug}
                >
                  From {candidate.origin.name}<span>→</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="search-landing-author">
          <div className="content-wrap">
            <p className="eyebrow eyebrow-light">Who built this</p>
            <h2>Michigan Outdoors Now is a Chris Izworski project.</h2>
            <p>
              Chris builds Michigan and Great Lakes decision tools around public data, current conditions, and practical trip planning. The canonical profile and project record live on ChrisIzworski.com.
            </p>
            <div className="guide-example-links">
              <a href="https://chrisizworski.com/chris-izworski/">Chris Izworski profile →</a>
              <a href="https://chrisizworski.com/projects/">More projects →</a>
            </div>
          </div>
        </section>
      </article>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />
    </>
  );
}
