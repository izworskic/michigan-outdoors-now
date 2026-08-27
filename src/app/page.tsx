import Link from "next/link";
import { Planner } from "../components/planner";
import { StatewideDecisionBoard } from "../components/statewide-decision-board";
import { destinationCount, destinations } from "../data/destinations";
import { specialistTools } from "../data/specialist-tools";
import { fetchWeatherSnapshots } from "../lib/live-data";
import { targetDateFor } from "../lib/planner";
import { jsonLd, personSchema, siteUrl } from "../lib/site";
import { rankStatewideDestinations, type StatewideResponse } from "../lib/statewide";

export const revalidate = 900;

const frequentlyAsked = [
  {
    question: "What does the statewide ranking actually measure?",
    answer:
      "It compares activity-specific weather and air-quality fit across the curated destination set. It does not pretend to know closures, trail conditions, road conditions, marine hazards, or local access unless a specialist tool explicitly carries that data.",
  },
  {
    question: "Why are beaches, paddling, fishing, aurora, ice, and birding separate?",
    answer:
      "Those decisions need different live signals. The statewide board handles general outdoor weather fit, then routes specialized decisions to tools built around waves, water, river gauges, sightings, space weather, ice, or snow.",
  },
  {
    question: "Can I make the answer local to me?",
    answer:
      "Yes. The planner below takes a Michigan city, ZIP code, or optional one-time device location and adds drive time, activities, kids, dogs, and lower-barrier access needs.",
  },
];

async function initialStatewide(): Promise<StatewideResponse> {
  const targetDate = targetDateFor("today");
  let weatherByDestination = new Map();

  try {
    weatherByDestination = await fetchWeatherSnapshots(destinations, targetDate);
  } catch {
    // The initial page still renders an honest unavailable state.
  }

  const picks = rankStatewideDestinations(weatherByDestination, "best");
  return {
    targetDate,
    generatedAt: new Date().toISOString(),
    mode: "best",
    conditionsStatus: picks.length ? "live" : "unavailable",
    picks,
    note: picks.length
      ? "Statewide weather-fit ranking across curated Michigan destinations."
      : "Live statewide conditions are temporarily unavailable. Use a verified specialist below or personalize a trip.",
  };
}

export default async function Home() {
  const initial = await initialStatewide();
  const liveTools = specialistTools.filter((tool) => tool.group === "live");
  const seasonalTools = specialistTools.filter((tool) => tool.group === "seasonal");
  const planningTools = specialistTools.filter((tool) => tool.group === "planning");

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${siteUrl}/#decision-engine`,
        name: "Michigan Outdoors Now",
        url: siteUrl,
        applicationCategory: "TravelApplication",
        operatingSystem: "Any",
        browserRequirements: "Requires JavaScript for interactive filters",
        description:
          "A Michigan outdoor decision engine that ranks statewide weather fit, then routes water, fishing, birding, aurora, shipping, fall color, ice, and snow decisions to verified live specialist tools.",
        featureList: [
          "Statewide outdoor rankings without requiring a location",
          "Activity-specific weather and air-quality scoring",
          "Best three-hour decision windows",
          "Personalized drive-time planning",
          "Verified live-tool handoffs for water, fishing, birding, aurora, shipping, fall color, ice, and skiing",
          "Explicit missing-data and confidence states",
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
      <section className="decision-hero">
        <div className="decision-hero-inner">
          <div className="decision-hero-copy">
            <p className="decision-kicker">Michigan decision engine · updated from live conditions</p>
            <h1>Where should you go outside today?</h1>
            <p>
              Start with the answer. Michigan Outdoors Now compares {destinationCount} curated
              destinations using current forecast and air-quality signals, then shows the strongest
              weather fit and the best time window.
            </p>
            <div className="decision-hero-actions">
              <a href="#statewide">See the statewide answer ↓</a>
              <a href="#planner">Make it local to me</a>
            </div>
            <div className="decision-trust">
              <span>No location required</span>
              <span>No fake fallback scores</span>
              <span>Activity-specific rules</span>
            </div>
          </div>
          <div id="statewide">
            <StatewideDecisionBoard initial={initial} />
          </div>
        </div>
      </section>

      <section className="verified-tools-section content-wrap" aria-labelledby="verified-tools-title">
        <div className="decision-section-head">
          <div>
            <p className="decision-section-label">Different question, different data</p>
            <h2 id="verified-tools-title">Go deeper when weather alone is not enough.</h2>
          </div>
          <p>
            A beach decision needs waves and swim risk. Trout needs river data. Aurora needs space
            weather and clouds. These are the live specialist tools currently verified in the network.
          </p>
        </div>

        <div className="verified-tools-grid">
          {liveTools.map((tool) => (
            <a className="verified-tool-card" href={tool.url} key={tool.id}>
              <div className="verified-tool-top">
                <span className="verified-pill">Live</span>
                <small>{tool.timing}</small>
              </div>
              <h3>{tool.name}</h3>
              <p>{tool.question}</p>
              <div className="verified-signals">{tool.signals.join(" · ")}</div>
              <strong>Open live tool →</strong>
            </a>
          ))}
        </div>
      </section>

      <section className="personalize-section" id="personalize">
        <div className="content-wrap">
          <div className="decision-section-head personalize-heading">
            <div>
              <p className="decision-section-label">Now make it yours</p>
              <h2>What is best within your drive window?</h2>
            </div>
            <p>
              Add where you are starting, how far you will drive, and what you actually want to do.
              The same decision logic becomes a personalized shortlist.
            </p>
          </div>
          <Planner
            compactIntro
            initialDate="today"
            initialMaxDriveHours={2}
            initialActivities={["hiking", "scenic"]}
          />
        </div>
      </section>

      <section className="seasonal-section content-wrap" aria-labelledby="seasonal-title">
        <div className="decision-section-head">
          <div>
            <p className="decision-section-label">Seasonal decision desks</p>
            <h2 id="seasonal-title">When Michigan changes, the data should change too.</h2>
          </div>
          <p>
            Fall color, ice, and skiing use seasonal signals rather than pretending the same year-round
            score works for every activity.
          </p>
        </div>
        <div className="seasonal-grid">
          {seasonalTools.map((tool) => (
            <a href={tool.url} className="seasonal-card" key={tool.id}>
              <span>{tool.timing}</span>
              <h3>{tool.name}</h3>
              <p>{tool.question}</p>
              <strong>Open decision tool →</strong>
            </a>
          ))}
        </div>
      </section>

      <section className="platform-proof">
        <div className="content-wrap">
          <div className="decision-section-head decision-section-head-light">
            <div>
              <p className="decision-section-label">What changed</p>
              <h2>A decision product, not another weather dashboard.</h2>
            </div>
            <p>
              The first screen answers where to go. Supporting data comes second. Specialized risks
              move to the tool that actually has the right inputs.
            </p>
          </div>
          <div className="proof-grid">
            <article>
              <span>01</span>
              <h3>Answer first</h3>
              <p>See the statewide #1, alternatives, best window, reason, and watch item before filling out anything.</p>
            </article>
            <article>
              <span>02</span>
              <h3>Activity rules</h3>
              <p>Hiking, scenic days, and dark skies are evaluated differently. Water and winter are handed to deeper live tools.</p>
            </article>
            <article>
              <span>03</span>
              <h3>No invented certainty</h3>
              <p>Missing conditions remain unavailable. A score is not allowed to hide missing safety or specialist data.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="network-section content-wrap">
        <div className="network-card">
          <div>
            <p className="decision-section-label">Build a bigger trip</p>
            <h2>Day, weekend, or map.</h2>
            <p>
              Use the statewide answer for the quick decision, the map when you want to browse all
              {destinationCount} destinations, or the weekend planner when one day is not enough.
            </p>
          </div>
          <div className="network-actions">
            <Link href="/explore">Explore the Michigan map →</Link>
            {planningTools.map((tool) => (
              <a href={tool.url} key={tool.id}>{tool.name} →</a>
            ))}
            <Link href="/ideas">Browse trip ideas →</Link>
          </div>
        </div>
      </section>

      <section className="decision-faq content-wrap">
        <p className="decision-section-label">Trust boundary</p>
        <h2>What this can and cannot tell you</h2>
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
