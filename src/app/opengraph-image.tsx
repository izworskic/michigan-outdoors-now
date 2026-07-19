import { ImageResponse } from "next/og";

export const alt = "Michigan Outdoors Now — day trip planner by Chris Izworski";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        position: "relative",
        overflow: "hidden",
        background: "#123d35",
        color: "#fffaf0",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ position: "absolute", inset: 36, border: "2px solid rgba(255,255,255,.22)", display: "flex" }} />
      <div style={{ position: "absolute", width: 560, height: 560, borderRadius: 999, border: "80px solid rgba(53,185,177,.17)", right: -80, top: 32, display: "flex" }} />
      <div style={{ position: "absolute", width: 310, height: 310, borderRadius: 999, border: "2px solid rgba(255,255,255,.18)", right: 100, top: 156, display: "flex" }} />
      <div style={{ padding: "84px 80px", display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 25, letterSpacing: 4, fontWeight: 700 }}>
          <span style={{ color: "#f59f55" }}>MICHIGAN</span> OUTDOORS NOW
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", flexDirection: "column", fontFamily: "Georgia, serif", fontSize: 84, lineHeight: .98, letterSpacing: -3, maxWidth: 810 }}>Less searching.<br />More outside.</div>
          <div style={{ marginTop: 30, fontSize: 27, color: "#d5e7df" }}>Three practical Michigan plans shaped by your drive and current conditions.</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", fontSize: 22 }}>
          <span>Built by Chris Izworski</span><span style={{ color: "#f59f55", letterSpacing: 3 }}>EXPLORE MICHIGAN →</span>
        </div>
      </div>
    </div>,
    size,
  );
}
