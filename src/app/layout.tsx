import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PublisherReferralTracker } from "../components/publisher-referral-tracker";
import { allowIndexing, jsonLd, personSchema, siteUrl } from "../lib/site";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import "./atlas.css";

const GA_MEASUREMENT_ID = "G-Y5D2V2W7HN";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Michigan Outdoor Day Trip Planner | Chris Izworski",
    template: "%s | Michigan Outdoors Now",
  },
  description:
    "Find Michigan outdoor trips by starting city, drive time and activity. Compare routed travel, weather, trail access, DNR data and less-obvious options.",
  applicationName: "Michigan Outdoors Now",
  authors: [{ name: "Chris Izworski", url: "https://chrisizworski.com/chris-izworski/" }],
  creator: "Chris Izworski",
  publisher: "Chris Izworski",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Michigan Outdoors Now",
    title: "Michigan Outdoor Day Trip Planner | Chris Izworski",
    description:
      "Find Michigan outdoor trips by city, drive time and activity, then compare routing, weather, trail access, DNR data and current trip confidence.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Michigan Outdoor Day Trip Planner | Chris Izworski",
    description: "Find and compare Michigan outdoor trips with drive time, current conditions, trail access and source-backed confidence.",
  },
  robots: allowIndexing
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true },
  category: "travel",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#132b3a",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const identityGraph = {
    "@context": "https://schema.org",
    "@graph": [
      personSchema,
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "Michigan Outdoors Now",
        description: "A Michigan outdoor day and weekend planner by Chris Izworski.",
        creator: { "@id": "https://chrisizworski.com/#person" },
        publisher: { "@id": "https://chrisizworski.com/#person" },
        inLanguage: "en-US",
      },
    ],
  };

  return (
    <html lang="en">
      <head>
        {/* Google tag (gtag.js) */}
        <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}');
            `,
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <header className="site-header">
          <div className="site-header-inner">
            <Link className="brand" href="/" aria-label="Michigan Outdoors Now home">
              <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
              <span><strong>Michigan Outdoors</strong><em>NOW</em></span>
            </Link>
            <nav aria-label="Main navigation">
              <Link href="/">Plan a day</Link>
              <Link href="/explore">Explore map</Link>
              <Link href="/ideas">Trip ideas</Link>
              <Link href="/how-it-works">How it works</Link>
              <a href="https://chrisizworski.com/tools">More tools</a>
            </nav>
          </div>
        </header>
        <main id="main-content">{children}</main>
        <footer className="site-footer">
          <div className="footer-grid">
            <div>
              <p className="footer-brand">Michigan Outdoors Now</p>
              <p>A Michigan decision tool built by <a href="https://chrisizworski.com/chris-izworski/">Chris Izworski</a>.</p>
            </div>
            <div className="footer-links">
              <Link href="/ideas">Trip guides</Link>
              <Link href="/explore">Destination map</Link>
              <Link href="/how-it-works">Method & privacy</Link>
              <a href="https://chrisizworski.com/tools">All tools</a>
              <a href="https://chrisizworski.com/chris-izworski/">About Chris Izworski</a>
              <a href="https://github.com/izworskic/michigan-outdoors-now">Source</a>
            </div>
          </div>
          <p className="fine-print">Conditions change. Confirm weather, closures, water, trail, and road conditions with official sources before travel.</p>
        </footer>
        <PublisherReferralTracker />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(identityGraph) }} />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
