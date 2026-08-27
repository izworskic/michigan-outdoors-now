# Michigan Outdoors Now — Platform Rebuild Operating Spec

Status: active  
Started: 2026-08-27

## Mission
Rebuild the existing Michigan outdoor tools and create net-new tools as one coherent statewide decision platform.

> Where should I go outside in Michigan, when should I go, and what should I do when I get there?

The platform turns live public data into actionable recommendations. Weather sites publish weather. Government sources publish measurements. Tourism sites list attractions. Michigan Outdoors Now should make the decision.

## Product goals
Optimize for organic Google impressions, SERP ownership, CTR, useful long-tail coverage, repeat visits, engagement, shareability, AI-answer discoverability, strong internal linking, future monetization, and above all genuine usefulness. Do not create thin programmatic SEO pages.

## Platform model
Keep useful existing URLs, rankings, backlinks, data integrations and indexed pages. Rebuild intelligence underneath them rather than discarding search equity. The parent experience is Michigan Outdoors Now. Specialist tools remain canonical owners for narrow decisions such as beaches, Great Lakes conditions, trout, birding, fall color, ice, skiing, aurora, ship tracking and destination-specific conditions. A specialist may only be surfaced after its live URL has been verified. Removed or retired tools must never be reintroduced from an old registry or historical branch.

## Shared decision intelligence
Normalize available inputs such as weather, precipitation, wind, AQI, smoke, waves, water temperature, currents, swim hazards, streamflow, snow, ice context, closures, daylight, road/access status and authoritative local observations. Prefer documented, stable, low-cost or free public sources. Do not silently fabricate replacement data.

## Activity-specific decisions
Do not create one generic weather score. Hiking, beaches, swimming, paddling, fishing, dark-sky viewing, photography, winter recreation and sightseeing respond to different conditions. A destination can be excellent for hiking while poor or dangerous for exposed-water recreation.

## Missing data and safety
Distinguish excellent, good, fair, poor, danger, closed and insufficient-data states. Missing required inputs must never be converted into an arbitrary midpoint score. Safety hazards and closures override favorable weather.

## Time-aware recommendations
Where hourly inputs exist, identify useful windows rather than scoring only whole days.

## Geographic decision layer
Support statewide and regional ranking, date choice, activity fit, drive-time constraints and eventually experience-per-hour-of-driving. The parent product answers “Where should I go?” while specialist tools answer deeper “Should I do this specific thing here?” questions.

## Discovery universe versus decision-ready intelligence
Never equate the hand-curated decision catalog with the full Michigan outdoor universe. Discovery should be broad and may use authoritative statewide datasets such as Michigan DNR trail geometry. Decision scoring remains narrower and must only apply where the required structured inputs exist. The map should visually distinguish broad discovery data from decision-ready places. Numbered markers are prohibited unless the numbers have an actual ranking or sequence meaning; arbitrary marker counts are not a navigation model.

## Search architecture
SEO is part of product architecture. Protect existing canonical intent owners and active experiments. Research queries, SERP composition, seasonal demand and gaps before creating a new canonical. Avoid doorway pages and keyword stuffing.

## UX
Answer first: decision, status/score, best time, key reason, critical hazard, supporting evidence, alternatives, detailed data. Avoid dashboard overload. Maps should help a decision and remain mobile/tablet safe.

## Trust and resilience
Show source provenance, freshness, uncertainty and estimates. Use caching, timeouts, stale labels, graceful degradation and explicit no-score states. A broken provider must not turn into invented conditions.

## Measurement
Instrument planner starts/completions, activity selections, decision handoffs, destination actions, specialist-tool handoffs, map interactions, shares, return behavior and outbound official actions without unnecessary personal data.

## Monetization
Keep commercial elements secondary to usefulness. Future ads, relevant affiliate products, lodging, guides, rentals, tours, campgrounds and sponsorships should follow the user's decision context.

## Development operating rules
Inspect current code, branches, recent work, search experiments and data sources before changing a surface. Coordinate with other agents by preserving useful work. Favor durable shared architecture and incremental production releases over wholesale rewrites.

## Tool lifecycle
A tool shown as live must resolve successfully at release time. CI must request every specialist URL and fail on broken responses. Keep an explicit retired-path regression list so removed tools cannot silently return through stale data, old branches, or copied registries.

## Homepage product contract
The first screen must answer the statewide decision before asking for a location or form completion. Personalization is the second step. The statewide layer may rank general weather-fit activities only when it has the required inputs; activities that need waves, water, river, sightings, space-weather, ice, snow, or AIS signals must route to the verified specialist that owns those inputs.

# Benchmark and Internal Evaluation Appendix

## Baseline
Before material rebuilds capture Search Console impressions, clicks, CTR, position, indexed URLs, Core Web Vitals, data sources/freshness, failure behavior, decision usefulness, safety handling, mobile usability, internal links and structured data where evidence is available. A rebuild must beat what it replaces.

## 100-point Michigan Outdoor Tool Quality Score
- Decision usefulness — 20
- Data quality and freshness — 15
- Activity-specific intelligence — 10
- Safety and uncertainty handling — 10
- Search opportunity / intent match — 10
- Technical SEO — 10
- UX / mobile usability — 10
- Performance / resilience — 5
- Explainability / trust — 5
- Internal linking / platform integration — 5

90–100 is flagship. 85–89 is production-ready. 70–84 is useful but incomplete. 60–69 is weak. Below 60 is not finished. No major rebuild is complete below 85; flagship surfaces target 90+.

## Fatal failures
A numerical score cannot override a dangerous recommendation, missing data represented as normal, stale safety data represented as current, ignored closure/hazard, fabricated data, broken primary interaction, major mobile failure, canonical/indexing regression, or an explanation that contradicts its inputs.

## Decision delta
0 raw data only; 1 data plus explanation; 2 good/bad interpretation; 3 activity recommendation; 4 activity plus best time plus explanation; 5 compares alternatives and tells the user where, what and when. Flagship tools should reach 4–5.

## Regression scenarios
Automate at least: sunny beach + swim hazard; calm morning + windy afternoon paddling; missing live inputs; high AQI; closure; dark-sky heavy cloud.

## Competitive benchmark
For priority query clusters compare the live SERP on answer speed, freshness, multi-source integration, actionable recommendation, best-time guidance, activity-specific risk, usability and unique utility.

## Platform benchmark
Track coverage of major Michigan outdoor decisions, geographic balance, activity coverage, search-intent coverage, data gaps, recommendation confidence and cross-tool consistency.

## Release principle
Do not measure success by pages created, code shipped or visual polish. Establish a baseline, score the work, run decision-quality regressions, compare against what existed, and document the measurable delta. Every rebuild must beat the thing it replaces.
