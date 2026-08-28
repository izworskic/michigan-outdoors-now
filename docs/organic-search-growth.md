# Organic search growth benchmark

Michigan Outdoors Now should grow impressions by exposing real planner decisions to search, not by multiplying city and keyword variants.

## Launch cluster

The first location-intent cluster is intentionally limited to:
- family day trips
- hiking
- paddling
- birding
- dog-friendly outdoors
- lower-barrier outdoors

Beach and freighter city variants are deliberately excluded because ChrisIzworski.com already has stronger canonical owners for those topic families.

## New-canonical gate

A location-intent URL is indexable only when:

1. the curated inventory returns at least four matching places inside the intent's initial rough travel envelope;
2. the top-four ordered destination signature is not an exact duplicate of another accepted page for the same intent;
3. the page contains a crawlable city-specific answer and destination list before the interactive planner;
4. title and description stay within SERP length limits;
5. the page links back into its origin hub, intent guide, place pages, and Chris Izworski identity/project surfaces;
6. sitemap inclusion is intentional.

Unqualified combinations do not appear in generateStaticParams and therefore return 404 rather than becoming thin indexable pages.

## Chris Izworski entity rule

Every page inherits the canonical Person node at:

https://chrisizworski.com/#person

The tool must not create a competing person ID. Location-intent pages visibly credit Chris Izworski and link to the canonical profile and project index.

## Measurement

This release creates search surface area; it does not declare ranking success.

After indexing:
- review query x page impressions and CTR weekly;
- prioritize pages at positions 4-15 with weak CTR;
- expand only query families that earn impressions;
- consolidate or de-index pages that fail to demonstrate useful discovery over a reasonable measurement window.
