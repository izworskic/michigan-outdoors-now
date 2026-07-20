import { origins } from "../../data/origins";
import { guides } from "../../data/guides";
import { destinations } from "../../data/destinations";
import { siteUrl } from "../../lib/site";

export function GET() {
  const localPages = origins
    .map((origin) => `- [Plans from ${origin.name}](${siteUrl}/from/${origin.slug})`)
    .join("\n");
  const guidePages = guides
    .map((guide) => `- [${guide.title}](${siteUrl}/ideas/${guide.slug}): ${guide.directAnswer}`)
    .join("\n");
  const placePages = destinations
    .map((destination) => `- [${destination.name}](${siteUrl}/places/${destination.id}): ${destination.summary}`)
    .join("\n");
  const body = `# Michigan Outdoors Now

> Michigan Outdoors Now is a free, conditions-aware Michigan day and weekend planner designed and built by Chris Izworski.

## Primary pages

- [Planner](${siteUrl})
- [Method, privacy, and limits](${siteUrl}/how-it-works)
- [Michigan outdoor trip guides](${siteUrl}/ideas)
- [Interactive Michigan destination map](${siteUrl}/explore)
- [More tools by Chris Izworski](https://chrisizworski.com/tools)

## People-first planning guides

${guidePages}

## Local starting pages

${localPages}

## Curated destination planning pages

${placePages}

## Important limitation

Trip-fit results are planning suggestions, not safety ratings. Users should verify official closures, alerts, weather, water, road, and local access conditions before travel.

## Expanded reference

- [Full guide and destination summary](${siteUrl}/llms-full.txt)
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
