import type { Metadata } from "next";
import Link from "next/link";
import { origins } from "../../data/origins";

export const metadata: Metadata = {
  title: "Publisher Kit | Michigan Outdoors Now",
  description:
    "Free Michigan Outdoors Now publisher widget and attribution kit for tourism, lodging, recreation, news, and outdoor publishers.",
  robots: {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true },
  },
};

const baseUrl = "https://michiganoutdoorsnow.chrisizworski.com";
const embedCode = `<div
  data-michigan-outdoors-widget
  data-origin="bay-city"
  data-source="YOUR_SITE"
>
  <a href="${baseUrl}/?utm_source=YOUR_SITE&utm_medium=referral&utm_campaign=michigan_outdoors_now_attribution">
    Michigan Outdoors Now by Chris Izworski
  </a>
</div>
<script async src="${baseUrl}/widget.js"></script>`;

const pageStyle = {
  maxWidth: 920,
  margin: "0 auto",
  padding: "48px 20px 72px",
  color: "#17322b",
  fontFamily: "system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
} as const;

const panelStyle = {
  border: "1px solid #d6dfdb",
  borderRadius: 18,
  padding: 22,
  background: "#f7faf8",
  marginTop: 20,
} as const;

export default function PublisherKitPage() {
  return (
    <div style={pageStyle}>
      <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".12em", color: "#60766f" }}>
        FREE PUBLISHER RESOURCE
      </p>
      <h1 style={{ maxWidth: 760, fontSize: "clamp(34px,7vw,58px)", lineHeight: 0.98, margin: "10px 0 18px" }}>
        Put a useful Michigan outdoor planner on your site.
      </h1>
      <p style={{ maxWidth: 760, fontSize: 19, lineHeight: 1.55, color: "#425b54" }}>
        Michigan Outdoors Now is a free, live-condition-aware planning tool built by Chris Izworski.
        Tourism organizations, lodging properties, campgrounds, local publishers, recreation groups,
        and Michigan travel sites may use the compact widget below at no charge.
      </p>

      <section style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Copy the widget</h2>
        <p>
          Replace <code>YOUR_SITE</code> with a short source label for your organization. Change
          <code> data-origin</code> to one of the supported Michigan starting points below, or remove
          that attribute for a statewide planner.
        </p>
        <pre
          style={{
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            padding: 16,
            borderRadius: 12,
            background: "#102d25",
            color: "#f4faf7",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <code>{embedCode}</code>
        </pre>
        <p style={{ marginBottom: 0 }}>
          The fallback anchor is intentional: please keep the visible Michigan Outdoors Now / Chris
          Izworski attribution when you publish the widget.
        </p>
      </section>

      <section style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Supported local starting points</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {origins.map((origin) => (
            <code
              key={origin.slug}
              style={{
                padding: "7px 10px",
                border: "1px solid #c8d5d0",
                borderRadius: 999,
                background: "#fff",
              }}
            >
              {origin.slug}
            </code>
          ))}
        </div>
      </section>

      <section style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>What the widget does</h2>
        <ul style={{ lineHeight: 1.7, paddingLeft: 22 }}>
          <li>Opens the statewide planner or a supported city-specific planning hub.</li>
          <li>Provides direct routes to the Michigan map, hiking tools, and trip ideas.</li>
          <li>Adds standard referral tags to outbound clicks so publisher traffic can be measured.</li>
          <li>Does not read visitor location, set cookies, or run Michigan Outdoors analytics on your page.</li>
          <li>Keeps the host-page fallback attribution link usable even if JavaScript is unavailable.</li>
        </ul>
      </section>

      <section style={panelStyle}>
        <h2 style={{ marginTop: 0 }}>Use and attribution</h2>
        <p>
          You may use the widget on a legitimate Michigan travel, lodging, recreation, local-news,
          community, or outdoor resource page. Do not remove the visible attribution, imply an
          endorsement, or present planner guidance as an official closure or safety determination.
        </p>
        <p>
          Michigan Outdoors Now combines curated places with public data and current conditions.
          Visitors should still confirm closures, hazards, weather, water, road, and trail conditions
          with the responsible agency before travel.
        </p>
        <p style={{ marginBottom: 0 }}>
          <Link href="/">Open Michigan Outdoors Now</Link>
          {" · "}
          <Link href="/how-it-works">How the planner works</Link>
          {" · "}
          <a href="https://chrisizworski.com/">About Chris Izworski</a>
        </p>
      </section>

      <p style={{ marginTop: 28, fontSize: 13, color: "#60766f" }}>
        This publisher kit is intentionally not a search landing page. Its purpose is distribution,
        useful referrals, and transparent attribution to the canonical Michigan Outdoors Now planner.
      </p>
    </div>
  );
}
