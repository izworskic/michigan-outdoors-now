import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OutdoorIntentHub } from "../../../components/outdoor-intent-hub";
import { destinations } from "../../../data/destinations";
import {
  trailSearchIntentBySlug,
  trailSearchIntents,
} from "../../../data/trail-search-intents";
import { jsonLd, personSchema, siteUrl } from "../../../lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return trailSearchIntents.map((intent) => ({ intent: intent.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ intent: string }>;
}): Promise<Metadata> {
  const { intent: slug } = await params;
  const intent = trailSearchIntentBySlug.get(slug);
  if (!intent) return {};

  return {
    title: { absolute: intent.title },
    description: intent.description,
    alternates: { canonical: `/trails/${intent.slug}` },
    authors: [{ name: "Chris Izworski", url: "https://chrisizworski.com/chris-izworski/" }],
    creator: "Chris Izworski",
    openGraph: {
      type: "article",
      title: intent.title,
      description: intent.description,
      url: `/trails/${intent.slug}`,
      siteName: "Michigan Outdoors Now",
    },
  };
}

export default async function TrailIntentPage({
  params,
}: {
  params: Promise<{ intent: string }>;
}) {
  const { intent: slug } = await params;
  const intent = trailSearchIntentBySlug.get(slug);
  if (!intent) notFound();

  const candidateMap = new Map(destinations.map((destination) => [destination.id, destination]));
  const candidates = intent.candidateIds
    .map((id) => candidateMap.get(id))
    .filter((destination): destination is (typeof destinations)[number] => Boolean(destination));
  const pageUrl = `${siteUrl}/trails/${intent.slug}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#page`,
        url: pageUrl,
        name: intent.title,
        description: intent.description,
        author: { "@id": personSchema["@id"] },
        creator: { "@id": personSchema["@id"] },
        isPartOf: { "@id": `${siteUrl}/#website` },
        about: [
          { "@type": "Thing", name: intent.label },
          { "@type": "Place", name: "Michigan" },
        ],
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Michigan Outdoors Now", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "Trail Truth", item: `${siteUrl}/trails` },
          { "@type": "ListItem", position: 3, name: intent.label, item: pageUrl },
        ],
      },
      {
        "@type": "ItemList",
        name: `${intent.label} starting points in Michigan`,
        numberOfItems: candidates.length,
        itemListElement: candidates.map((destination, index) => ({
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
      <article>
        <header className="content-wrap trail-intent-hero">
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link><span>/</span><Link href="/trails">Trail Truth</Link><span>/</span><span>{intent.label}</span>
          </nav>
          <p className="eyebrow">Michigan Trail Truth</p>
          <h1>{intent.h1}</h1>
          <p>{intent.directAnswer}</p>
          <p className="guide-review">
            By <a href="https://chrisizworski.com/chris-izworski/">Chris Izworski</a> · Route evidence is verified on demand
          </p>
        </header>

        <section className="content-wrap trail-intent-candidates" aria-labelledby="trail-candidates">
          <div className="guide-section-heading">
            <p className="eyebrow">Where to investigate</p>
            <h2 id="trail-candidates">Strong trail systems to start with</h2>
            <p>
              These are destination-level starting points, not claims about a specific route. The live tool below resolves route-level evidence where mapped data supports it.
            </p>
          </div>
          <div className="trail-intent-grid">
            {candidates.map((destination) => (
              <Link href={`/places/${destination.id}`} key={destination.id}>
                <span>{destination.area}</span>
                <strong>{destination.name}</strong>
                <p>{destination.summary}</p>
                <b>Open place guide →</b>
              </Link>
            ))}
          </div>
        </section>

        <section className="content-wrap trail-intent-method">
          <div>
            <p className="eyebrow">Verify before choosing</p>
            <h2>The route has to earn the claim.</h2>
          </div>
          <ul>
            {intent.verification.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="content-wrap trail-intent-live">
          <p className="eyebrow">Make it current</p>
          <h2>Use this exact hiking intent in the live planner.</h2>
          <p>
            Set your starting point. The search is preloaded with “{intent.query}” so routed travel, Trail Truth, recent weather, access and the go/skip signal can do the final work.
          </p>
        </section>
      </article>

      <OutdoorIntentHub
        initialWish={intent.query}
        initialDriveHours={intent.maxDriveHours}
      />

      <nav className="content-wrap trail-intent-related" aria-label="Related Michigan trail questions">
        {trailSearchIntents
          .filter((candidate) => candidate.slug !== intent.slug)
          .map((candidate) => (
            <Link href={`/trails/${candidate.slug}`} key={candidate.slug}>
              {candidate.label}<span>→</span>
            </Link>
          ))}
      </nav>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />
    </>
  );
}
