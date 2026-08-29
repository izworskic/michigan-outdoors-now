import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { destinations } from "../../../data/destinations";
import { jsonLd, personSchema, siteUrl } from "../../../lib/site";
import {
  trailSearchPageBySlug,
  trailSearchPages,
  trailSearchPageStats,
} from "../../../lib/trail-search-pages";

export const dynamicParams = false;

export function generateStaticParams() {
  return trailSearchPages.map((page) => ({ intent: page.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ intent: string }>;
}): Promise<Metadata> {
  const { intent } = await params;
  const page = trailSearchPageBySlug.get(intent);
  if (!page) return {};

  const canonical = `/hiking/${page.slug}`;
  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical },
    authors: [
      {
        name: "Chris Izworski",
        url: "https://chrisizworski.com/chris-izworski/",
      },
    ],
    creator: "Chris Izworski",
    openGraph: {
      type: "article",
      title: page.title,
      description: page.description,
      url: canonical,
      siteName: "Michigan Outdoors Now",
    },
  };
}

export default async function TrailIntentPage({
  params,
}: {
  params: Promise<{ intent: string }>;
}) {
  const { intent } = await params;
  const page = trailSearchPageBySlug.get(intent);
  if (!page) notFound();

  const pageUrl = `${siteUrl}/hiking/${page.slug}`;
  const stats = trailSearchPageStats(page);
  const destinationById = new Map(
    destinations.map((destination) => [destination.id, destination]),
  );
  const representedDestinations = [
    ...new Set(
      page.profiles
        .map((profile) => profile.destinationId)
        .filter((value): value is string => Boolean(value)),
    ),
  ]
    .map((id) => destinationById.get(id))
    .filter((destination): destination is NonNullable<typeof destination> => Boolean(destination));

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#page`,
        url: pageUrl,
        name: page.title,
        description: page.description,
        dateModified: "2026-08-28",
        inLanguage: "en-US",
        author: { "@id": personSchema["@id"] },
        creator: { "@id": personSchema["@id"] },
        isPartOf: { "@id": `${siteUrl}/#website` },
        mainEntity: { "@id": `${pageUrl}#routes` },
        about: [
          { "@type": "Thing", name: "Michigan hiking" },
          { "@type": "Thing", name: "official trail mileage" },
          { "@type": "Thing", name: page.eyebrow },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Michigan Outdoors Now",
            item: siteUrl,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Michigan hiking",
            item: `${siteUrl}/ideas/hiking-day-trips`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: page.h1,
            item: pageUrl,
          },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#routes`,
        name: page.h1,
        numberOfItems: page.profiles.length,
        itemListElement: page.profiles.map((profile, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: profile.name,
          url: profile.sourceUrl,
        })),
      },
    ],
  };

  return (
    <article className="trail-search-page">
      <header className="trail-search-hero">
        <div className="content-wrap">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <Link href="/ideas/hiking-day-trips">Hiking</Link>
            <span>/</span>
            <span>{page.eyebrow}</span>
          </nav>
          <p className="eyebrow eyebrow-light">{page.eyebrow}</p>
          <h1>{page.h1}</h1>
          <p className="trail-search-deck">{page.directAnswer}</p>
          <p className="guide-review">
            By <a href="https://chrisizworski.com/chris-izworski/">Chris Izworski</a> · Official route sources checked August 28, 2026
          </p>
        </div>
      </header>

      <section className="content-wrap trail-search-method">
        <div>
          <p className="eyebrow">Trail Truth standard</p>
          <h2>Route facts first. Current conditions second.</h2>
        </div>
        <p>
          Every mileage number on this page comes from the National Park Service,
          Michigan DNR or U.S. Forest Service source linked on that route. The live
          planner can then add road routing, current weather, DNR access changes and
          mapped route metadata when you open a place. A published route length is
          not a statement that the trail is open or suitable today.
        </p>
      </section>
      <section className="content-wrap trail-search-evidence" aria-label="Trail Truth catalog coverage">
        <div className="trail-search-evidence-grid">
          <article>
            <strong>{stats.routeCount}</strong>
            <span>verified route choices</span>
          </article>
          <article>
            <strong>{stats.destinationCount}</strong>
            <span>Michigan destinations</span>
          </article>
          <article>
            <strong>{stats.minMiles}–{stats.maxMiles} mi</strong>
            <span>published mileage range</span>
          </article>
          <article>
            <strong>{stats.sourceLabels.length}</strong>
            <span>official source systems</span>
          </article>
        </div>
        <p>
          Route shapes in this set: {stats.loopCount} loops, {stats.outAndBackCount} out-and-backs,
          {" "}{stats.pointToPointCount} point-to-point routes and {stats.networkCount} trail networks.
          These counts describe the verified catalog on this page; they are not estimates of every trail in Michigan.
        </p>
        {representedDestinations.length > 0 && (
          <div className="trail-search-area-links">
            <span>Hiking areas represented</span>
            <div>
              {representedDestinations.slice(0, 14).map((destination) => (
                <Link href={`/places/${destination.id}`} key={destination.id}>
                  {destination.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="content-wrap trail-search-grid" aria-label={page.h1}>
        {page.profiles.map((profile, index) => {
          const destination = profile.destinationId
            ? destinationById.get(profile.destinationId)
            : undefined;
          return (
            <article key={profile.id}>
              <div className="trail-search-rank">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{profile.distanceMiles} mi</strong>
              </div>
              <p className="trail-search-area">{profile.area}</p>
              <h2>{profile.name}</h2>
              <div className="trail-search-facts">
                <span>{profile.routeKind}</span>
                <span>{profile.difficulty}</span>
              </div>
              <p>{profile.terrain}</p>
              <ul>
                {profile.features.slice(0, 4).map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <small>{profile.sourceNote}</small>
              <div className="trail-search-actions">
                {destination && (
                  <Link href={`/places/${destination.id}`}>
                    Check this area now →
                  </Link>
                )}
                <a href={profile.sourceUrl} target="_blank" rel="noreferrer">
                  {profile.sourceLabel} route source ↗
                </a>
              </div>
            </article>
          );
        })}
      </section>

      <section className="content-wrap trail-search-next">
        <div>
          <p className="eyebrow">Make it a real decision</p>
          <h2>Now compare the drive, weather, access and route evidence.</h2>
          <p>
            Use semantic search for the exact day you want: “10 mile hike,” “rugged
            full-day hike,” “waterfall hike,” or “easy walk.” Open a result to load
            Trail Truth and the current go-or-skip planning signal.
          </p>
          <Link href="/">Open Michigan Outdoors Now →</Link>
        </div>
        <div>
          <p className="eyebrow">Related hiking questions</p>
          <div className="search-landing-link-list">
            {trailSearchPages
              .filter((candidate) => candidate.slug !== page.slug)
              .slice(0, 5)
              .map((candidate) => (
                <Link href={`/hiking/${candidate.slug}`} key={candidate.slug}>
                  {candidate.h1}<span>→</span>
                </Link>
              ))}
          </div>
        </div>
      </section>

      <section className="search-landing-author">
        <div className="content-wrap">
          <p className="eyebrow eyebrow-light">Creator and method</p>
          <h2>This is part of Chris Izworski’s Michigan outdoor decision-tool network.</h2>
          <p>
            The search page keeps official route facts separate from live planning
            signals so mileage, weather, access and uncertainty are not blended into
            one opaque recommendation.
          </p>
          <div className="guide-example-links">
            <a href="https://chrisizworski.com/chris-izworski/">Chris Izworski profile →</a>
            <a href="https://chrisizworski.com/projects/">More projects →</a>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />
    </article>
  );
}
