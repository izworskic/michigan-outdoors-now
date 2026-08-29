# Trail decision stack benchmark

This benchmark keeps Michigan Outdoors Now from drifting back toward generic outdoor recommendations after route-specific intelligence is introduced.

## Product contract

### Trail Truth

A selected hiking result may resolve a nearby OpenStreetMap hiking relation. When it does, relation tags are preferred for distance and ascent. Mapped relation-member geometry may provide a clearly labeled mileage fallback, and sampled terrain may provide clearly labeled ascent evidence. Difficulty, surface, visibility and foot access appear only when mapped tags exist. Official land-manager maps remain the final source for closures, seasonal rules and route choice.

Nearby DNR mapped miles are never presented as exact route mileage.

### Ranked route answers

For curated hiking destinations, semantic discovery may attach the best matching official trail profile directly to the ranked result card. The route matcher uses the visitor's expressed intent (for example long, short, easy, rugged, waterfall or roughly ten miles) and never substitutes a nearby trail-system mileage for a named route.

When an agency-published route profile is available, the result card may show:

- the named route;
- official published mileage;
- route shape;
- broad difficulty;
- a deliberately broad hiking-time estimate derived from mileage and difficulty;
- agency-published trailhead/access facts where explicitly available.

The hiking-time range is planning guidance, not a completion-time promise. Access facts are optional and remain absent when the official source does not establish them.

The selected-place sheet prefers an official route profile for those route facts, while keeping current OpenStreetMap relation data, Michigan DNR closures/reroutes and live weather as separate evidence layers.

### Current case

Selected-place intelligence combines current weather, near-term precipitation and gusts, recent rain/snow, AQI, daylight and Michigan DNR access changes. The output is a planning signal, not a safety rating.

### Routed travel

Both semantic discovery and the structured planner use road-routed travel when OSRM answers inside a strict interaction budget. Failed routing remains an explicit estimate.

### Build My Day

Two or three kept semantic places can be ordered to minimize routed driving from the user's start. If the routing service fails, the itinerary remains usable but visibly estimated.

### Search

The route-specific SEO expansion is statewide and question-led, not another city multiplication system. Published route mileage on those pages comes from NPS, Michigan DNR or U.S. Forest Service sources.

## Release discipline

The release must preserve the existing result-first, skeptic-conversion and organic-growth gates. Trail truth should remove uncertainty, not add another mandatory wizard.
