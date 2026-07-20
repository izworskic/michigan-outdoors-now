import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Planner } from "../../../components/planner";
import { destinations } from "../../../data/destinations";
import { guides, guidesBySlug } from "../../../data/guides";
import { activityLabels } from "../../../lib/planner";
import { jsonLd, personSchema, siteUrl } from "../../../lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  return guides.map((guide) => ({ guide: guide.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ guide: string }> }): Promise<Metadata> {
  const { guide: slug } = await params;
  const guide = guidesBySlug.get(slug);
  if (!guide) return {};

  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/ideas/${guide.slug}` },
    openGraph: { title: guide.title, description: guide.description, url: `/ideas/${guide.slug}` },
    twitter: { title: guide.title, description: guide.description },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ guide: string }> }) {
  const { guide: slug } = await params;
  const guide = guidesBySlug.get(slug);
  if (!guide) notFound();

  const destinationById = new Map(destinations.map((destination) => [destination.id, destination]));
  const examples = guide.destinationIds.map((id) => destinationById.get(id)).filter((item) => item !== undefined);
  const selectedActivities = new Set(guide.planner.activities);
  const relatedGuides = guides
    .filter(
      (candidate) =>
        candidate.slug !== guide.slug &&
        candidate.planner.activities.some((activity) => selectedActivities.has(activity)),
    )
    .slice(0, 3);
  const pageUrl = `${siteUrl}/ideas/${guide.slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#page`,
        url: pageUrl,
        name: guide.title,
        description: guide.description,
        dateModified: "2026-07-20",
        inLanguage: "en-US",
        author: { "@id": personSchema["@id"] },
        isPartOf: { "@id": `${siteUrl}/#website` },
        mainEntity: { "@id": `${pageUrl}#destinations` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Michigan Outdoors Now", item: siteUrl },
          { "@type": "ListItem", position: 2, name: "Trip ideas", item: `${siteUrl}/ideas` },
          { "@type": "ListItem", position: 3, name: guide.shortTitle, item: pageUrl },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${pageUrl}#destinations`,
        name: `Starting ideas for ${guide.shortTitle}`,
        numberOfItems: examples.length,
        itemListElement: examples.map((destination, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: destination.name,
          url: `${siteUrl}/places/${destination.id}`,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: guide.faqs.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };

  return (
    <>
      <article>
        <header className="guide-hero">
          <div className="content-wrap guide-hero-grid">
            <div>
              <nav className="breadcrumb" aria-label="Breadcrumb">
                <Link href="/">Home</Link><span>/</span><Link href="/ideas">Trip ideas</Link><span>/</span><span>{guide.shortTitle}</span>
              </nav>
              <p className="eyebrow eyebrow-light">{guide.eyebrow}</p>
              <h1>{guide.title}</h1>
              <p className="guide-deck">{guide.description}</p>
              <p className="guide-review">By <a href="https://chrisizworski.com/">Chris Izworski</a> · Reviewed July 20, 2026</p>
            </div>
            <aside className="guide-glance" aria-label="Guide at a glance">
              <p>AT A GLANCE</p>
              <dl>
                <div><dt>Best for</dt><dd>{guide.bestFor}</dd></div>
                <div><dt>Planner starts with</dt><dd>{guide.planStart}</dd></div>
                <div><dt>Conditions can change it</dt><dd>{guide.weatherPivot}</dd></div>
              </dl>
            </aside>
          </div>
        </header>

        <section className="guide-answer content-wrap" aria-labelledby="quick-answer-title">
          <p className="eyebrow">Quick answer</p>
          <h2 id="quick-answer-title">The useful way to make this decision</h2>
          <p>{guide.directAnswer}</p>
          <div className="guide-audience"><strong>Who this is for</strong><span>{guide.audience}</span></div>
        </section>

        <section className="guide-tips content-wrap" aria-labelledby="guide-tips-title">
          <div className="section-kicker"><span>HOW TO CHOOSE</span><i /></div>
          <h2 id="guide-tips-title">Three decisions before the destination.</h2>
          <div className="guide-tip-grid">
            {guide.tips.map((tip, index) => (
              <article key={tip.title}><span>{String(index + 1).padStart(2, "0")}</span><h3>{tip.title}</h3><p>{tip.text}</p></article>
            ))}
          </div>
        </section>

        <div className="content-wrap guide-planner-wrap">
          <div className="guide-planner-intro">
            <div><p className="eyebrow">Make it personal</p><h2>Now build it from where you are.</h2></div>
            <p>This planner is already set for {guide.planner.activities.map((activity) => activityLabels[activity].toLowerCase()).join(" and ")}. Enter your Michigan city or ZIP and adjust anything.</p>
          </div>
          <Planner
            compactIntro
            initialDate={guide.planner.date}
            initialMaxDriveHours={guide.planner.maxDriveHours}
            initialActivities={guide.planner.activities}
            initialKids={guide.planner.kids}
            initialDog={guide.planner.dog}
            initialAccessible={guide.planner.accessible}
          />
        </div>

        <section className="guide-examples content-wrap" aria-labelledby="guide-examples-title">
          <div className="section-kicker"><span>CURATED STARTING POINTS</span><i /></div>
          <div className="guide-section-heading">
            <h2 id="guide-examples-title">Places that show what this day can look like.</h2>
            <p>These are examples, not a fixed ranking. The planner orders matching places for your drive and available conditions.</p>
          </div>
          <div className="guide-example-grid">
            {examples.map((destination, index) => (
              <article key={destination.id}>
                <span>{String(index + 1).padStart(2, "0")} · {destination.area}</span>
                <h3>{destination.name}</h3>
                <p>{destination.summary}</p>
                <small>{destination.setting}</small>
                <div className="guide-example-links">
                  <Link href={`/places/${destination.id}`}>Plan this place →</Link>
                  <a href={destination.officialUrl} target="_blank" rel="noreferrer">Official source ↗</a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="guide-check-section">
          <div className="content-wrap guide-check-grid">
            <div>
              <p className="eyebrow eyebrow-light">Before you go</p>
              <h2>A short check beats a ruined drive.</h2>
              <p>Trip-fit helps compare choices. Official sources decide closures, rules, access, and safety information.</p>
              {guide.relatedTool && (
                <a className="related-tool-card" href={guide.relatedTool.url}>
                  <span>Related tool by Chris Izworski</span><strong>{guide.relatedTool.label} →</strong><small>{guide.relatedTool.description}</small>
                </a>
              )}
            </div>
            <ol>{guide.checklist.map((item, index) => <li key={item}><span>{index + 1}</span>{item}</li>)}</ol>
          </div>
        </section>

        <section className="guide-faq content-wrap" aria-labelledby="guide-faq-title">
          <div className="section-kicker"><span>PLAIN ANSWERS</span><i /></div>
          <h2 id="guide-faq-title">Questions people ask before this trip</h2>
          <div className="faq-list">
            {guide.faqs.map((item) => (
              <details key={item.question}><summary>{item.question}<span aria-hidden="true">+</span></summary><p>{item.answer}</p></details>
            ))}
          </div>
        </section>

        <nav className="related-guides content-wrap" aria-label="Related Michigan outdoor guides">
          <p className="eyebrow">Keep exploring</p>
          <div>{relatedGuides.map((item) => <Link href={`/ideas/${item.slug}`} key={item.slug}>{item.shortTitle}<span>→</span></Link>)}</div>
        </nav>
      </article>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
