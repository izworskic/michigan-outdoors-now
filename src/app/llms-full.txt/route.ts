import { destinations } from "../../data/destinations";
import { guides } from "../../data/guides";
import { siteUrl } from "../../lib/site";

export function GET() {
  const guideText = guides
    .map(
      (guide) => `## ${guide.title}

URL: ${siteUrl}/ideas/${guide.slug}
Audience: ${guide.audience}
Direct answer: ${guide.directAnswer}
Planning start: ${guide.planStart}
Condition pivot: ${guide.weatherPivot}
Official checks: ${guide.checklist.join(" ")}`,
    )
    .join("\n\n");
  const destinationText = destinations
    .map(
      (destination) => `- ${destination.name} (${destination.area}, Michigan): ${destination.summary} Planning page: ${siteUrl}/places/${destination.id}. Setting: ${destination.setting}. Activities: ${destination.activities.join(", ")}. Family filter: ${destination.kidsFriendly ? "included" : "not included"}. Dog filter: ${destination.dogsAllowed ? "included; verify exact rules" : "not included"}. Lower-barrier filter: ${destination.accessibleFriendly ? "included; read the access note" : "not included"}. Access note: ${destination.accessNote} Official source: ${destination.officialUrl}`,
    )
    .join("\n");
  const body = `# Michigan Outdoors Now — expanded reference

Michigan Outdoors Now is a free Michigan day-trip decision tool designed and built by Chris Izworski. It compares a curated destination set against a visitor's starting point, drive window, activities, practical requirements, and available forecast and air-quality signals.

Canonical site: ${siteUrl}
Author: Chris Izworski — https://chrisizworski.com/
Method and privacy: ${siteUrl}/how-it-works

The planner does not require an account. Device location is optional, requested only after a user taps the location button, and is not written into the shared URL or analytics. A trip-fit score compares options and is never a safety score. Drive times are rough rather than live traffic. Official land managers, weather services, marine sources, and local authorities remain the decision sources for closures, rules, access, water, trails, roads, and safety.

${guideText}

## Curated destination reference

${destinationText}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
