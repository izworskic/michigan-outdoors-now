import { ImageResponse } from "next/og";
import { searchLandingByKey } from "../../../../lib/search-landings";

export const alt = "Michigan Outdoors Now local outdoor planning guide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ origin: string; intent: string }>;
}) {
  const { origin, intent } = await params;
  const landing = searchLandingByKey.get(`${origin}/${intent}`);
  const city = landing?.origin.name ?? "Michigan";
  const label = landing?.intent.label ?? "Outdoor day trips";
  const topPlace = landing?.places[0]?.name ?? "Find somewhere worth the drive";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: "#173b3f",
        color: "#f8f5ec",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ position: "absolute", inset: 34, border: "2px solid rgba(255,255,255,.2)", display: "flex" }} />
      <div style={{ position: "absolute", width: 600, height: 600, borderRadius: 999, border: "92px solid rgba(175,122,75,.18)", right: -120, top: 50, display: "flex" }} />
      <div style={{ padding: "74px 76px", display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
        <div style={{ display: "flex", fontSize: 22, fontWeight: 800, letterSpacing: 3 }}>
          <span style={{ color: "#efb47d" }}>MICHIGAN OUTDOORS NOW</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 880 }}>
          <div style={{ display: "flex", fontSize: 27, color: "#d8e7df", marginBottom: 13 }}>
            {label.toUpperCase()} FROM {city.toUpperCase()}
          </div>
          <div style={{ display: "flex", fontFamily: "Georgia, serif", fontSize: 76, lineHeight: .98, letterSpacing: -3 }}>
            Worth the drive?
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 25, color: "#f3d7bb" }}>
            Start with {topPlace}. Compare drive, weather, trail data and access.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20 }}>
          <span>Built by Chris Izworski</span>
          <span style={{ color: "#efb47d" }}>MAKE THE DECISION →</span>
        </div>
      </div>
    </div>,
    size,
  );
}
