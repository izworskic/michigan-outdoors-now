import type { Metadata } from "next";
import Link from "next/link";
import { destinationCount } from "../../data/destinations";

export const metadata: Metadata = {
  title: "How the Michigan Outdoor Planner Works",
  description:
    "See how Michigan Outdoors Now uses a real destination map, curated places, rough drive estimates, weather, wind, and air quality, plus its privacy and safety limits.",
  alternates: { canonical: "/how-it-works" },
};

export default function HowItWorksPage() {
  return (
    <>
      <section className="page-hero">
        <div className="content-wrap narrow-copy">
          <p className="eyebrow eyebrow-light">Method, privacy & limits</p>
          <h1>A useful shortlist,<br />not a magic answer.</h1>
          <p>Michigan Outdoors Now helps compare practical choices. It explains what it uses, what it does not know, and where your judgment still matters.</p>
        </div>
      </section>
      <article className="content-wrap prose-page">
        <section>
          <span className="prose-number">01</span>
          <div><h2>Curated Michigan destinations</h2><p>The planner starts with {destinationCount} established Michigan destinations spanning both peninsulas. Each entry has a geographic point, activity tags, and practical notes for kids, dogs, and lower-barrier access. This focused set keeps results explainable and useful.</p></div>
        </section>
        <section>
          <span className="prose-number">02</span>
          <div><h2>Hard requirements first</h2><p>Your maximum drive time and selected activities remove poor fits. Kids, dogs, and access selections act as requirements, not small score boosts. Drive times are rough geographic estimates and do not include traffic, ferries, construction, or winter roads.</p></div>
        </section>
        <section>
          <span className="prose-number">03</span>
          <div><h2>Current data adjusts the order</h2><p>The remaining choices are compared with daily forecast data, including temperature, rain chance, precipitation, gusts, sunshine, and cloud cover. U.S. Air Quality Index data is included when available. Wind receives extra weight for selected water activities and cloud cover matters more for dark-sky plans. Data comes from <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> and can be delayed, incomplete, or unavailable.</p></div>
        </section>
        <section>
          <span className="prose-number">04</span>
          <div><h2>The score is only trip fit</h2><p>The number helps order the three returned choices for the inputs you chose. It is not a safety score, official recommendation, forecast guarantee, trail rating, or accessibility certification. High wind, lightning, surf, current, wildfire smoke, ice, closures, and local rules always outrank this tool.</p></div>
        </section>
        <section>
          <span className="prose-number">05</span>
          <div><h2>Minimal data by design</h2><p>The planner does not require an account. You can enter a city or ZIP, or explicitly tap Use my location. Optional coordinates are used for that request, kept out of the shared URL and analytics, and are not saved as a personal trip profile or sold.</p></div>
        </section>
        <section>
          <span className="prose-number">06</span>
          <div><h2>A real map with a list fallback</h2><p>The <Link href="/explore">Michigan destination map</Link> uses MapLibre with OpenFreeMap and OpenStreetMap data, visible attribution, and no API key. Numbered pins match the readable destination list. If you explicitly use device location, it ranks nearby matches for that visit and keeps the coordinates out of URLs and analytics.</p></div>
        </section>
        <section>
          <span className="prose-number">07</span>
          <div><h2>Guides answer a real planning need</h2><p>The <Link href="/ideas">Michigan trip guides</Link> are organized around people and decisions: family days, beaches, trails, birding, paddling, night skies, freighters, dogs, and lower-barrier access. Each page contains visible guidance, curated examples, official links, limitations, and a preconfigured planner. They are not automatically generated city-and-keyword pages.</p></div>
        </section>
        <aside className="prose-callout">
          <p className="eyebrow">Before leaving</p>
          <h2>Check the source closest to the risk.</h2>
          <p>Use official park pages for closures and rules, the National Weather Service for hazards, marine forecasts and buoy observations for open water, and current road agencies for travel.</p>
          <Link className="primary-button" href="/#planner"><span>Build a Michigan plan</span><span aria-hidden="true">→</span></Link>
        </aside>
      </article>
    </>
  );
}
