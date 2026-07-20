import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Planner } from "../../../components/planner";
import { destinations } from "../../../data/destinations";
import { guidesBySlug } from "../../../data/guides";
import { origins, originsBySlug } from "../../../data/origins";
import { haversineMiles } from "../../../lib/planner";
import { jsonLd, siteUrl } from "../../../lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return origins.map((origin) => ({ origin: origin.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ origin: string }>;
}): Promise<Metadata> {
  const { origin: slug } = await params;
  const origin = originsBySlug.get(slug);
  if (!origin) return {};

  const title = `Michigan Day Trips from ${origin.name}`;
  const description = `Plan Michigan outdoor day trips from ${origin.name}. Compare hiking, fishing, paddling, beaches, birds, scenery, and current conditions inside your drive window.`;
  return {
    title,
    description,
    alternates: { canonical: `/from/${origin.slug}` },
    openGraph: { title, description, url: `/from/${origin.slug}` },
  };
}

export default async function OriginPage({ params }: { params: Promise<{ origin: string }> }) {
  const { origin: slug } = await params;
  const origin = originsBySlug.get(slug);
  if (!origin) notFound();

  const closeOptions = destinations
    .map((destination) => ({
      ...destination,
      distance: haversineMiles(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude,
      ),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4);
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Michigan Outdoors Now", item: siteUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: `From ${origin.name}`,
        item: `${siteUrl}/from/${origin.slug}`,
      },
    ],
  };
  const localGuides = ["outdoors-today", "family-day-trips", "hiking-day-trips"]
    .map((guideSlug) => guidesBySlug.get(guideSlug))
    .filter((guide) => guide !== undefined);

  return (
    <>
      <section className="local-hero">
        <div className="content-wrap local-hero-grid">
          <div>
            <p className="eyebrow eyebrow-light">Michigan day-trip planner</p>
            <h1>Outdoor plans from <span>{origin.name}</span></h1>
            <p>{origin.intro}</p>
            <p className="byline">A local planning page by <a href="https://chrisizworski.com/">Chris Izworski</a></p>
          </div>
          <div className="local-coordinates" aria-label={`${origin.name} coordinates`}>
            <small>START POINT</small>
            <strong>{origin.zip}</strong>
            <span>{origin.latitude.toFixed(3)}° N<br />{Math.abs(origin.longitude).toFixed(3)}° W</span>
          </div>
        </div>
      </section>

      <div className="content-wrap local-planner-wrap">
        <Planner defaultOrigin={origin.name} compactIntro />
      </div>

      <section className="nearby-section content-wrap">
        <div className="section-kicker"><span>CLOSEST STARTS</span><i /></div>
        <div className="origin-heading">
          <h2>Four places near {origin.name}</h2>
          <p>These are starting ideas by straight-line distance. Use the planner for drive-fit and conditions.</p>
        </div>
        <div className="nearby-grid">
          {closeOptions.map((destination) => (
            <article key={destination.id}>
              <p>{destination.area}</p>
              <h3>{destination.name}</h3>
              <span>About {Math.round(destination.distance)} rough miles</span>
              <p>{destination.summary}</p>
              <Link href={`/places/${destination.id}`}>Plan this place →</Link>
              <a href={destination.officialUrl} target="_blank" rel="noreferrer">Official details ↗</a>
            </article>
          ))}
        </div>
        <Link className="text-link" href="/ideas">Explore Michigan trip guides →</Link>
      </section>

      <nav className="related-guides content-wrap local-guide-links" aria-label={`Popular outdoor guides from ${origin.name}`}>
        <p className="eyebrow">Choose the kind of day</p>
        <div>
          {localGuides.map((guide) => (
            <Link href={`/ideas/${guide.slug}`} key={guide.slug}>{guide.shortTitle}<span>→</span></Link>
          ))}
        </div>
      </nav>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumb) }} />
    </>
  );
}
