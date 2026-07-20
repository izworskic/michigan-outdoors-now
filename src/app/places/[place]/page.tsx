import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlaceConditions } from "../../../components/place-conditions";
import { Planner } from "../../../components/planner";
import { destinations } from "../../../data/destinations";
import { guides } from "../../../data/guides";
import {
  conditionConsiderations,
  destinationActivityText,
  destinationDirectAnswer,
  destinationRegion,
  mapUrl,
  nearbyDestinations,
  regionLabels,
} from "../../../lib/destination-content";
import { activityLabels } from "../../../lib/planner";
import { jsonLd, personSchema, siteUrl } from "../../../lib/site";
import type { ActivityId } from "../../../lib/types";

export const dynamicParams = false;

export function generateStaticParams() {
  return destinations.map((destination) => ({ place: destination.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ place: string }> }): Promise<Metadata> {
  const { place: slug } = await params;
  const destination = destinations.find((candidate) => candidate.id === slug);
  if (!destination) return {};

  const title = `${destination.name} Day-Trip Planner`;
  const description = `Plan a Michigan day at ${destination.name} near ${destination.area}. Check activities, broad weather signals, practical fit, access context, maps, nearby alternatives, and the official source.`;
  return {
    title,
    description,
    alternates: { canonical: `/places/${destination.id}` },
    openGraph: { title, description, url: `/places/${destination.id}` },
    twitter: { title, description },
  };
}

export default async function PlacePage({ params }: { params: Promise<{ place: string }> }) {
  const { place: slug } = await params;
  const destination = destinations.find((candidate) => candidate.id === slug);
  if (!destination) notFound();

  const pageUrl = `${siteUrl}/places/${destination.id}`;
  const nearby = nearbyDestinations(destination);
  const considerations = conditionConsiderations(destination);
  const activities = new Set(destination.activities);
  const relatedGuides = guides
    .filter((guide) => guide.planner.activities.some((activity) => activities.has(activity)))
    .slice(0, 3);
  const plannerActivities: ActivityId[] = destination.activities
    .filter((activity) => activity !== "scenic")
    .slice(0, 2);
  if (!plannerActivities.length) plannerActivities.push("scenic");
  const practicalFit = [
    {
      label: "Family planning",
      value: destination.kidsFriendly ? "Included" : "Extra research",
      text: destination.kidsFriendly
        ? "This destination is included when the planner’s family filter is required. Confirm facilities and choose the route for your group."
        : "This is not currently treated as a family-first destination in the planner. Check the exact experience before choosing it for children.",
    },
    {
      label: "Dog-compatible",
      value: destination.dogsAllowed ? "Some access" : "Not selected",
      text: destination.dogsAllowed
        ? "The curated record supports a dog-compatible plan somewhere at the destination. Verify leash rules, designated areas, and seasonal restrictions."
        : "The planner excludes this place when dog access is required. Verify the official rules rather than assuming pets are allowed.",
    },
    {
      label: "Lower-barrier options",
      value: destination.accessibleFriendly ? "Possible" : "Verify first",
      text: destination.accessNote,
    },
  ];
  const destinationMapUrl = mapUrl(destination);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#page`,
        url: pageUrl,
        name: `${destination.name} Day-Trip Planner`,
        description: destinationDirectAnswer(destination),
        dateModified: "2026-07-20",
        inLanguage: "en-US",
        author: { "@id": personSchema["@id"] },
        isPartOf: { "@id": `${siteUrl}/#website` },
        mainEntity: { "@id": `${pageUrl}#place` },
      },
      {
        "@type": "Place",
        "@id": `${pageUrl}#place`,
        name: destination.name,
        description: destination.summary,
        url: pageUrl,
        sameAs: destination.officialUrl,
        hasMap: destinationMapUrl,
        geo: {
          "@type": "GeoCoordinates",
          latitude: destination.latitude,
          longitude: destination.longitude,
        },
        address: {
          "@type": "PostalAddress",
          addressLocality: destination.area,
          addressRegion: "MI",
          addressCountry: "US",
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Michigan Outdoors Now", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "Explore", item: `${siteUrl}/explore` },
          { "@type": "ListItem", position: 3, name: destination.name, item: pageUrl },
        ],
      },
    ],
  };

  return (
    <>
      <article>
        <header className="place-hero">
          <div className="content-wrap place-hero-grid">
            <div>
              <nav className="breadcrumb" aria-label="Breadcrumb">
                <Link href="/">Home</Link><span>/</span><Link href="/explore">Explore</Link><span>/</span><span>{destination.name}</span>
              </nav>
              <p className="eyebrow eyebrow-light">{regionLabels[destinationRegion(destination)]} · {destination.area}</p>
              <h1>Plan a day at <span>{destination.name}</span></h1>
              <p className="place-deck">{destination.summary}</p>
              <p className="guide-review">By <a href="https://chrisizworski.com/">Chris Izworski</a> · Reviewed July 20, 2026</p>
            </div>
            <aside className="place-glance" aria-label={`${destination.name} at a glance`}>
              <span>DAY-TRIP SNAPSHOT</span>
              <strong>{destination.setting}</strong>
              <p>Best matched with {destinationActivityText(destination)}.</p>
              <div>
                <a href={destinationMapUrl} target="_blank" rel="noreferrer">Open map ↗</a>
                <a href={destination.officialUrl} target="_blank" rel="noreferrer">Official details ↗</a>
              </div>
            </aside>
          </div>
        </header>

        <section className="place-answer content-wrap" aria-labelledby="place-answer-title">
          <p className="eyebrow">Quick answer</p>
          <h2 id="place-answer-title">Is {destination.name} a useful day-trip choice?</h2>
          <p>{destinationDirectAnswer(destination)}</p>
          <div className="place-activity-list" aria-label="Activities supported by the destination">
            {destination.activities.map((activity) => <span key={activity}>{activityLabels[activity]}</span>)}
          </div>
        </section>

        <div className="content-wrap">
          <PlaceConditions
            placeId={destination.id}
            placeName={destination.name}
            waterSensitive={activities.has("beaches") || activities.has("paddling")}
            darkSky={activities.has("dark-sky")}
          />
        </div>

        <section className="place-fit content-wrap" aria-labelledby="place-fit-title">
          <div className="section-kicker"><span>WHO NEEDS IT TO WORK</span><i /></div>
          <div className="place-section-heading">
            <h2 id="place-fit-title">Practical fit before the drive.</h2>
            <p>These flags narrow the planner; they do not promise that every route, beach, building, or season has the same access.</p>
          </div>
          <div className="place-fit-grid">
            {practicalFit.map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.value}</strong><p>{item.text}</p></article>)}
          </div>
        </section>

        <section className="place-conditions-guide">
          <div className="content-wrap">
            <div className="section-kicker"><span>WHAT CAN CHANGE THE DAY</span><i /></div>
            <h2>Read the setting, not just the temperature.</h2>
            <div className="condition-guide-grid">
              {considerations.map((item, index) => <article key={item.title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}
            </div>
          </div>
        </section>

        <div className="content-wrap place-planner-wrap">
          <div className="guide-planner-intro">
            <div><p className="eyebrow">Compare before you commit</p><h2>See how this area fits from your starting point.</h2></div>
            <p>Use your location or type a Michigan city. The planner compares this kind of trip with other curated choices and provides a weather backup.</p>
          </div>
          <Planner compactIntro initialActivities={plannerActivities} />
        </div>

        <section className="place-nearby content-wrap" aria-labelledby="place-nearby-title">
          <div className="section-kicker"><span>NEARBY ALTERNATIVES</span><i /></div>
          <div className="place-section-heading">
            <h2 id="place-nearby-title">Keep a second direction ready.</h2>
            <p>Straight-line distance is only a discovery aid. Roads, water crossings, traffic, and seasonal access can make the actual drive different.</p>
          </div>
          <div className="place-nearby-grid">
            {nearby.map(({ destination: nearbyPlace, distanceMiles }) => (
              <Link href={`/places/${nearbyPlace.id}`} key={nearbyPlace.id}>
                <span>About {Math.round(distanceMiles)} rough miles</span>
                <h3>{nearbyPlace.name}</h3>
                <p>{nearbyPlace.summary}</p>
                <strong>Plan this alternative →</strong>
              </Link>
            ))}
          </div>
        </section>

        <nav className="related-guides content-wrap" aria-label={`Trip guides related to ${destination.name}`}>
          <p className="eyebrow">Choose the kind of day</p>
          <div>{relatedGuides.map((guide) => <Link href={`/ideas/${guide.slug}`} key={guide.slug}>{guide.shortTitle}<span>→</span></Link>)}</div>
        </nav>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
