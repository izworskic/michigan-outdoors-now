import { origins } from "../../data/origins";
import { siteUrl } from "../../lib/site";

export function GET() {
  const localPages = origins
    .map((origin) => `- [Plans from ${origin.name}](${siteUrl}/from/${origin.slug})`)
    .join("\n");
  const body = `# Michigan Outdoors Now

> Michigan Outdoors Now is a free, conditions-aware Michigan day and weekend planner designed and built by Chris Izworski.

## Primary pages

- [Planner](${siteUrl})
- [Method, privacy, and limits](${siteUrl}/how-it-works)
- [More tools by Chris Izworski](https://chrisizworski.com/tools)

## Local starting pages

${localPages}

## Important limitation

Trip-fit results are planning suggestions, not safety ratings. Users should verify official closures, alerts, weather, water, road, and local access conditions before travel.
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
