import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { allowIndexing, jsonLd, personSchema, siteUrl } from "../lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Michigan Outdoors Now — Day Trip Planner by Chris Izworski",
    template: "%s | Michigan Outdoors Now",
  },
  description:
    "Choose a Michigan city, day, drive time, and outdoor interests. Get three practical Michigan outing ideas ranked with current weather and air quality when available.",
  applicationName: "Michigan Outdoors Now",
  authors: [{ name: "Chris Izworski", url: "https://chrisizworski.com/" }],
  creator: "Chris Izworski",
  publisher: "Chris Izworski",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Michigan Outdoors Now",
    title: "Michigan Outdoors Now — by Chris Izworski",
    description:
      "A live-condition-aware Michigan day and weekend planner built around your drive time and interests.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Michigan Outdoors Now — by Chris Izworski",
    description: "Three practical Michigan outdoor plans, matched to your day, drive, and current conditions.",
  },
  robots: allowIndexing
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true },
  category: "travel",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#123d35",
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
        creator: { "@id": "https://chrisizworski.com/#chris-izworski" },
        inLanguage: "en-US",
      },
    ],
  };

  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <header className="site-header">
          <div className="site-header-inner">
            <Link className="brand" href="/" aria-label="Michigan Outdoors Now home">
              <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
              <span><strong>Michigan Outdoors</strong><em>NOW</em></span>
            </Link>
            <nav aria-label="Main navigation">
              <Link href="/#planner">Build a plan</Link>
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
              <p>A focused Michigan planning tool built by <a href="https://chrisizworski.com/">Chris Izworski</a>.</p>
            </div>
            <div className="footer-links">
              <Link href="/how-it-works">Method & privacy</Link>
              <a href="https://chrisizworski.com/tools">All tools</a>
              <a href="https://github.com/izworskic/michigan-outdoors-now">Source</a>
            </div>
          </div>
          <p className="fine-print">Conditions change. Confirm weather, closures, water, trail, and road conditions with official sources before travel.</p>
        </footer>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(identityGraph) }} />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
