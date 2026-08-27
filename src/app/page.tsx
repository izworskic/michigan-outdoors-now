import type { Metadata } from "next";
import { OutdoorIntentHub } from "../components/outdoor-intent-hub";
import { destinations } from "../data/destinations";
import { jsonLd, personSchema, siteUrl } from "../lib/site";

export const metadata: Metadata = {
  title: "What Should I Do Outside in Michigan Today? | Michigan Outdoors Now",
  description:
    "Tell us where you are starting and how far you will travel. Find a Michigan outdoor plan for today or this weekend, check a place, or start with an activity.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Michigan Outdoors Now — Find the right outdoor plan",
    description:
      "Starting point, maximum drive, where to go, when to go, why it works, and what could spoil the plan.",
    url: "/",
  },
  twitter: {
    title: "Michigan Outdoors Now — Find the right outdoor plan",
    description:
      "Starting point, maximum drive, where to go, when to go, why it works, and what could spoil the plan.",
  },
};

export default function Home() {
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
          "Recommendations based on a Michigan starting point and maximum drive radius",
          "Best Michigan outdoor options for today and this weekend",
          "Best time window and practical watch-outs",
          "Specific-place condition checks",
          "Activity-specific live tools",
        ],
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "What does a four-hour travel limit mean?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "It means any qualifying destination from nearby through four hours away can be considered. Four hours is the maximum one-way drive, not a target distance.",
            },
          },
          {
            "@type": "Question",
            name: "How does Michigan Outdoors Now choose where to go?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "It starts with your Michigan location and maximum travel time, filters to places inside that radius, then compares current conditions using activity-specific rules.",
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
      <OutdoorIntentHub places={placeOptions} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
    </>
  );
}
