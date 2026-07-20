import Link from "next/link";
import { destinationCount } from "../data/destinations";
import { origins } from "../data/origins";
import { Planner } from "../components/planner";
import { featuredGuideSlugs, guidesBySlug } from "../data/guides";
import { jsonLd, personSchema, siteUrl } from "../lib/site";

const frequentlyAsked = [
  {
    question: "How does Michigan Outdoors Now choose places?",
    answer:
      "It first filters a curated Michigan destination set by drive time, activities, and practical needs. It then uses forecast and air-quality data when available to help rank the strongest fits.",
  },
  {
    question: "Is the trip-fit number a safety rating?",
    answer:
      "No. It is only a comparison of the choices entered, estimated drive distance, and available conditions. Always check official closures, marine forecasts, road conditions, and local alerts.",
  },
  {
    question: "Does the planner track my location?",
    answer:
      "Only if you tap Use my location. That optional browser permission supplies coordinates for one planner request; the tool keeps them out of the shared URL and analytics and does not save a trip profile. You can always type a Michigan city or ZIP instead.",
  },
];

export default function Home() {
  const featuredGuides = featuredGuideSlugs
    .map((slug) => guidesBySlug.get(slug))
    .filter((guide) => guide !== undefined);
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${siteUrl}/#planner`,
        name: "Michigan Outdoors Now",
        url: siteUrl,
        applicationCategory: "TravelApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript",
        description:
          "A live-condition-aware Michigan day and weekend planner using drive time, interests, forecast, wind, and air quality.",
        featureList: [
          "Michigan day-trip recommendations",
          "Drive-window filtering",
          "Forecast, wind, and air-quality context",
          "Primary and weather-backup decisions",
          "Shareable planner setups",
        ],
        author: { "@id": personSchema["@id"] },
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@type": "FAQPage",
        mainEntity: frequentlyAsked.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      },
    ],
  };

  return (
    <>
      <section className="hero">
        <div className="hero-contours" aria-hidden="true" />
        <div className="hero-grid">
          <div className="hero-copy">
            <p className="eyebrow eyebrow-light">Made for the Michigan decision</p>
            <h1>Less searching.<br /><span>More outside.</span></h1>
            <p className="hero-lede">
              Tell us where you are, how far you will drive, and what sounds good. Get three
              Michigan plans shaped by current conditions—not a wall of generic listings.
            </p>
            <div className="hero-actions">
              <a className="hero-button" href="#planner">Build my plan <span aria-hidden="true">↓</span></a>
              <Link className="hero-secondary" href="/explore">Explore all 28 places →</Link>
            </div>
            <p className="byline">Designed and built by <a href="https://chrisizworski.com/">Chris Izworski</a></p>
          </div>
          <div className="hero-map" aria-label="Michigan destination coverage illustration">
            <div className="compass" aria-hidden="true"><span>N</span><i /></div>
            <div className="map-card map-card-one"><small>LAKE SUPERIOR</small><strong>Cliffs + falls</strong><span>U.P.</span></div>
            <div className="map-card map-card-two"><small>THE STRAITS</small><strong>Ships + stars</strong><span>NORTH</span></div>
            <div className="map-card map-card-three"><small>GREAT LAKES</small><strong>Dunes + beach</strong><span>WEST</span></div>
            <div className="map-card map-card-four"><small>RIVER COUNTRY</small><strong>Trout + trails</strong><span>EAST</span></div>
            <div className="hero-stamp"><strong>{destinationCount}</strong><span>curated<br />destinations</span></div>
          </div>
        </div>
      </section>

      <div className="trust-strip" aria-label="Planner features">
        <span><i>01</i> Michigan-only</span>
        <span><i>02</i> Conditions-aware</span>
        <span><i>03</i> No account</span>
        <span><i>04</i> Shareable decision</span>
      </div>

      <div className="content-wrap planner-wrap planner-wrap-primary">
        <Planner />
      </div>

      <section className="persona-section content-wrap" aria-labelledby="persona-title">
        <div className="section-kicker"><span>START WITH YOU</span><i /></div>
        <div className="persona-heading">
          <h2 id="persona-title">Which sentence sounds most like your day?</h2>
          <p>Choose a plain-English starting point. Each guide gives you the important details and opens a planner already shaped for that kind of trip.</p>
        </div>
        <div className="persona-grid">
          {featuredGuides.map((guide, index) => (
            <Link className="persona-card" href={`/ideas/${guide.slug}`} key={guide.slug}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{guide.entryLabel}</h3>
              <p>{guide.entryDetail}</p>
            </Link>
          ))}
        </div>
        <Link className="text-link persona-all" href="/ideas">See all Michigan trip guides →</Link>
        <Link className="text-link persona-all" href="/explore">Or filter the interactive Michigan map →</Link>
      </section>

      <section className="method-section">
        <div className="content-wrap">
          <div className="section-kicker"><span>FIELD METHOD</span><i /></div>
          <div className="method-heading">
            <h2>A short list with a reason behind it.</h2>
            <p>The goal is not to catalog every trailhead. It is to make the next decision easier.</p>
          </div>
          <div className="method-grid">
            <article><span>01</span><h3>Fit first</h3><p>Drive time, activity match, kids, dogs, and lower-barrier access narrow the field.</p></article>
            <article><span>02</span><h3>Conditions next</h3><p>Forecast, rain chance, gusts, temperature, and air quality adjust the order when available.</p></article>
            <article><span>03</span><h3>You decide</h3><p>Each result explains the match, flags concerns, and links to maps and official details.</p></article>
          </div>
          <Link className="text-link" href="/how-it-works">Read the full method, privacy, and limits →</Link>
        </div>
      </section>

      <section className="origin-section content-wrap">
        <div className="section-kicker"><span>START LOCAL</span><i /></div>
        <div className="origin-heading">
          <h2>Michigan ideas from where you already are.</h2>
          <p>Open a local starting page or enter any Michigan city or ZIP in the planner.</p>
        </div>
        <div className="origin-grid">
          {origins.map((origin) => (
            <Link href={`/from/${origin.slug}`} key={origin.slug}>
              <span>{origin.name}</span><small>{origin.zip}</small><i aria-hidden="true">↗</i>
            </Link>
          ))}
        </div>
      </section>

      <section className="maker-section">
        <div className="content-wrap maker-grid">
          <div className="maker-badge" aria-hidden="true"><span>CI</span><i>MI</i></div>
          <div>
            <p className="eyebrow">Made by a real Michigan builder</p>
            <h2>Hi, I’m Chris Izworski.</h2>
            <p>
              I build useful Michigan and Great Lakes tools that turn scattered information into
              a clearer next step. This planner connects that work into one practical starting point.
            </p>
            <div className="maker-links">
              <a href="https://chrisizworski.com/">About Chris →</a>
              <a href="https://chrisizworski.com/tools">Explore all tools →</a>
              <a href="https://github.com/izworskic">GitHub →</a>
            </div>
          </div>
        </div>
      </section>

      <section className="faq-section content-wrap">
        <div className="section-kicker"><span>GOOD TO KNOW</span><i /></div>
        <h2>Before you build a plan</h2>
        <div className="faq-list">
          {frequentlyAsked.map((item) => (
            <details key={item.question}>
              <summary>{item.question}<span aria-hidden="true">+</span></summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
