const widgetScript = String.raw`(() => {
  const BASE = "https://michiganoutdoorsnow.chrisizworski.com";
  const ORIGINS = {
    "bay-city": "Bay City",
    saginaw: "Saginaw",
    detroit: "Detroit",
    "ann-arbor": "Ann Arbor",
    flint: "Flint",
    lansing: "Lansing",
    "grand-rapids": "Grand Rapids",
    kalamazoo: "Kalamazoo",
    "traverse-city": "Traverse City",
    marquette: "Marquette",
    "mackinaw-city": "Mackinaw City"
  };

  const trackedUrl = (path, source, campaign) => {
    const url = new URL(path, BASE);
    url.searchParams.set("utm_source", source || "publisher_widget");
    url.searchParams.set("utm_medium", "referral");
    url.searchParams.set("utm_campaign", campaign || "michigan_outdoors_now_embed");
    return url.toString();
  };

  const makeLink = (label, href, primary) => {
    const link = document.createElement("a");
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = label;
    link.style.cssText = [
      "display:inline-flex",
      "align-items:center",
      "justify-content:center",
      "min-height:40px",
      "padding:9px 12px",
      "border-radius:999px",
      "font:700 14px/1.15 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
      "text-decoration:none",
      primary
        ? "background:#173f35;color:#fff;border:1px solid #173f35"
        : "background:#fff;color:#173f35;border:1px solid #c8d5d0"
    ].join(";");
    return link;
  };

  document.querySelectorAll("[data-michigan-outdoors-widget]").forEach((mount) => {
    if (mount.getAttribute("data-michigan-outdoors-ready") === "true") return;
    mount.setAttribute("data-michigan-outdoors-ready", "true");

    const requestedOrigin = (mount.getAttribute("data-origin") || "").trim().toLowerCase();
    const origin = Object.prototype.hasOwnProperty.call(ORIGINS, requestedOrigin)
      ? requestedOrigin
      : "";
    const source = (mount.getAttribute("data-source") || "publisher_widget")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .slice(0, 64) || "publisher_widget";
    const originPath = origin ? "/from/" + origin : "/";

    const card = document.createElement("section");
    card.setAttribute("aria-label", "Michigan outdoor trip planner");
    card.style.cssText = [
      "box-sizing:border-box",
      "max-width:680px",
      "padding:18px",
      "border:1px solid #d6dfdb",
      "border-radius:18px",
      "background:#f7faf8",
      "color:#17322b",
      "font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif",
      "box-shadow:0 8px 24px rgba(23,50,43,.08)"
    ].join(";");

    const eyebrow = document.createElement("div");
    eyebrow.textContent = "MICHIGAN OUTDOORS NOW";
    eyebrow.style.cssText =
      "font:800 11px/1.2 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;letter-spacing:.12em;color:#60766f;margin-bottom:7px";

    const title = document.createElement("div");
    title.textContent = origin
      ? "What should I do outside from " + ORIGINS[origin] + "?"
      : "What should I do outside in Michigan today?";
    title.style.cssText =
      "font:800 clamp(20px,4vw,28px)/1.05 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;margin:0 0 8px;color:#102d25";

    const copy = document.createElement("p");
    copy.textContent =
      "Compare real Michigan places, drive fit, trails and current conditions. Pick the day instead of scrolling another generic list.";
    copy.style.cssText =
      "margin:0 0 14px;font:500 14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#425b54";

    const actions = document.createElement("div");
    actions.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin:0 0 13px";
    actions.append(
      makeLink(
        origin ? "Plan from " + ORIGINS[origin] : "Plan my outdoor day",
        trackedUrl(originPath, source, "michigan_outdoors_now_embed"),
        true
      ),
      makeLink(
        "Explore the map",
        trackedUrl("/explore", source, "michigan_outdoors_now_embed"),
        false
      ),
      makeLink(
        "Hiking",
        trackedUrl("/hiking", source, "michigan_outdoors_now_embed"),
        false
      ),
      makeLink(
        "Trip ideas",
        trackedUrl("/ideas", source, "michigan_outdoors_now_embed"),
        false
      )
    );

    const credit = document.createElement("p");
    credit.style.cssText =
      "margin:0;font:600 12px/1.35 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#64776f";

    const planner = document.createElement("a");
    planner.href = trackedUrl("/", source, "michigan_outdoors_now_attribution");
    planner.target = "_blank";
    planner.rel = "noopener";
    planner.textContent = "Michigan Outdoors Now";
    planner.style.cssText = "color:#173f35;text-decoration:underline;text-underline-offset:2px";

    const author = document.createElement("a");
    author.href =
      "https://chrisizworski.com/?utm_source=" +
      encodeURIComponent(source) +
      "&utm_medium=referral&utm_campaign=michigan_outdoors_now_attribution";
    author.target = "_blank";
    author.rel = "noopener";
    author.textContent = "Chris Izworski";
    author.style.cssText = "color:#173f35;text-decoration:underline;text-underline-offset:2px";

    credit.append(planner, document.createTextNode(" · built by "), author);
    card.append(eyebrow, title, copy, actions, credit);
    mount.replaceChildren(card);
  });
})();`;

export function GET() {
  return new Response(widgetScript, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
