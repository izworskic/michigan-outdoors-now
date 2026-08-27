import type { Metadata } from "next";
import { OutdoorIntentHub } from "../components/outdoor-intent-hub";
import { destinations } from "../data/destinations";
import { fetchWeatherSnapshots } from "../lib/live-data";
import { targetDateFor } from "../lib/planner";
import { jsonLd, personSchema, siteUrl } from "../lib/site";
import { rankStatewideDestinations, type StatewideResponse } from "../lib/statewide";

export const revalidate = 900;

export const metadata: Metadata = {
  title: "What Should I Do Outside in Michigan Today? | Michigan Outdoors Now",
  description:
    "Find a Michigan outdoor plan for today or this weekend, check a place before you go, or start with hiking, beaches, fishing, birding, dark skies and more.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Michigan Outdoors Now — Find the right outdoor plan",
    description:
      "Where to go, when to go, why it works, and what could spoil the plan.",
    url: "/",
  },
  twitter: {
    title: "Michigan Outdoors Now — Find the right outdoor plan",
    description:
      "Where to go, when to go, why it works, and what could spoil the plan.",
  },
};

async function initialToday(): Promise<StatewideResponse> {
  const targetDate = targetDateFor("today");
  let weatherByDestination = new Map();
  try {
    weatherByDestination = await fetchWeatherSnapshots(destinations, targetDate);
  } catch {
    // Render an honest unavailable state.
  }
  const picks = rankStatewideDestinations(weatherByDestination, "best");
  return {
    targetDate,
    generatedAt: new Date().toISOString(),
    mode: "best",
    conditionsStatus: picks.length ? "live" : "unavailable",
    picks,
    note: picks.length
      ? "Current weather and air-quality fit across selected Michigan destinations."
      : "Live statewide conditions are temporarily unavailable.",
  };
}

export default async function Home() {
  const initial = await initialToday();
  const placeOptions = destinations.map((destination) => ({
    id: destination.id,
    name: destination.name,
    area: destination.area,
    summary: destination.summary,
    activities: destination.activities,
  }));

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${siteUrl}/#outdoor-planner`,
        name: "Michigan Outdoors Now",
        url: siteUrl,
        applicationCategory: "TravelApplication",
        operatingSystem: "Any",
        description: metadata.description,
        author: { "@id": personSchema["@id"] },
        featureList: [
          "Best Michigan outdoor options for today and this weekend",
          "Best time window and practical watch-outs",
          "Specific-place condition checks",
          "Activity-specific live tools",
          "Optional drive-time personalization",
        ],
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "How does Michigan Outdoors Now choose where to go?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "It compares current conditions using activity-specific rules, then shows the strongest option, best time window, watch-outs and alternatives.",
            },
          },
          {
            "@type": "Question",
            name: "Does every activity use the same score?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "No. Hiking, beaches, fishing, birding, paddling and dark-sky outings rely on different conditions and specialist data.",
            },
          },
        ],
      },
    ],
  };

  return (
    <>
      <OutdoorIntentHub initialToday={initial} places={placeOptions} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
