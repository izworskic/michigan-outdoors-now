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

### Statewide coverage contract

Trail Truth is now a statewide catalog rather than a small flagship sample. The release gate requires at least 150 verified route profiles, route-level coverage for at least 26 of the planner's hiking destination families, at least 80% destination-family coverage, unique profile IDs, positive mileage and explicit HTTPS provenance.

Uncovered hiking destinations must be documented. A gap can exist because an agency maps trails without publishing route mileage clearly enough for this product, or because the land manager explicitly says there are no designated trails. In either case, the catalog stays empty rather than inventing a route.

Network mileage is labeled as network mileage. It is never presented as though a six-mile trail network were one six-mile loop. Descriptive profile names such as a published maximum-length loop are permitted only when the source explicitly establishes that route length and the source note explains the choice.

Current sources span Michigan DNR, National Park Service, U.S. Forest Service, U.S. Fish & Wildlife Service, Huron-Clinton Metroparks and municipal park agencies.

### Trail Truth Live

A selected verified route is now an operational decision object rather than only a static profile.

- **Route chooser:** destinations with multiple verified routes expose those routes directly. Changing the route changes the route facts, current planning signal, daylight fit and map highlight.
- **Official-first geometry:** Michigan DNR route profiles first resolve against the DNR Trails Open Data layer; National Park Service profiles first resolve against the NPS Public Trails geographic service.
- **Mapped fallback:** if an official centerline cannot be name-matched inside the destination area, Trail Truth may show a name-matched OpenStreetMap route. It must be labeled as mapped fallback, never official geometry.
- **Map behavior:** the selected route is highlighted above the general trail network and the map frames the resolved geometry.
- **Finish before dark:** the daylight test subtracts expected drive time before comparing remaining daylight with the route's broad hiking-time range and a planning buffer.
- **Trailhead action:** a route gets a direct trailhead navigation action only when its verified profile explicitly names the trailhead. Point-to-point routes also warn the visitor to plan return transportation.
- **Live planning fit:** route-specific current fit combines the existing weather, recent rain, gust, AQI and DNR access signals with route difficulty and daylight. This remains planning guidance rather than a safety rating.

The public geometry feeds are evidence layers, not distance authorities. The land manager's published route mileage remains authoritative when a centerline's calculated geometry differs.

### Depth standard

Trail Truth depth is now measured as a product-quality property rather than raw record count.

- The release gate requires at least **150 verified route profiles**.
- At least **65 profiles** must carry a named trailhead/access label before geometry fallback is counted.
- At least **23 destinations** must have more than one verified route.
- At least **12 destinations** must have five or more verified routes.
- Large local catalogs stay collapsed to the best six routes until the visitor explicitly expands them.
- A verified profile trailhead remains the preferred navigation target. When that is absent, official land-manager route geometry may provide an explicitly labeled mapped route start. OpenStreetMap fallback starts remain labeled as mapped fallback and are never promoted to official trailheads.
- New route records must retain positive published mileage, route shape, source label and an official source URL.

The first depth batch concentrates additional route truth in Pictured Rocks, Sleeping Bear Dunes, Kensington Metropark, Hartwick Pines, Ludington State Park and the Manistee River corridor.

### Shallow-destination attack

The next depth pass targets destinations that previously had only one or two route profiles.

- Warren Dunes now exposes the DNR's numbered foot-trail route combinations instead of hiding behind only the six-mile network total.
- Petoskey State Park now preserves the representative Old Baldy / Portage choices while adding current-map branch and campground trail detail.
- Mackinac Island adds the exact three-quarter-mile Hardwood Nature Trail without inventing mileage for the many other named island trails whose official page does not publish distance.
- Tawas Point adds the DNR-published approximately four-mile paved connection from the park entrance to East Tawas City Park.
- Ocqueoc Falls adds the published shortest three-mile Bicentennial Pathway option while retaining the six-mile maximum option; neither gets an invented loop name.
- Numbered/branch routes use `network` when the official map establishes mileage but not a defensible loop or point-to-point shape.

The release gate now measures remaining shallowness directly. It caps one-route destinations at seven and all one-or-two-route destinations at eleven. Places such as Rifle River, Fayette, Presque Isle Marquette and Belle Isle remain intentionally shallow when the managing agency publishes only network totals, unlabeled segments or no route-specific mileage.

### Hard-source depth

Trail Truth no longer equates "more records" with better truth. The remaining shallow destinations use two distinct depth paths:

- **Route depth** when an agency publishes a defensible route name, mileage and shape. This pass adds the 3.8-mile Warner Creek Pathway and the City of Marquette's 0.5-mile Bog Walk Trails.
- **Operational depth** when the land manager publishes one network total but multiple official ways into it. Brown Bridge, Rifle River, Highbanks and Fayette now expose official entry points instead of fabricated extra routes.
- **Conflict disclosure** when official sources disagree. Brown Bridge's management plan states approximately 9.3 miles of hiking trail while the recreation-directory summary still says 6 miles; Trail Truth preserves that disagreement rather than silently choosing a false certainty.
- **Status correction** when newer official evidence resolves an old caveat. Michigan DNR announced the 5.8-mile Ralph C. Wilson, Jr. Trail complete in September 2025, so Belle Isle is now represented as a completed loop rather than an incomplete mapped network.
- **Current access caveats** remain explicit. Brown Bridge carries the city's April 23, 2026 Grasshopper Creek pedestrian-bridge closure notice and phased 2026 expansion access note.

The release gate now tracks official entry-point count and `operationallyThinDestinationCount`: a one-route destination is only treated as truly thin when it also lacks at least two official entry points. This prevents agents from "fixing" shallow coverage by inventing route names.

### Trail Truth 150 and source drift

The 150-route milestone deliberately concentrates new depth in Porcupine Mountains Wilderness State Park and Isle Royale National Park rather than creating another thin search-page family.

Porcupine Mountains also introduces an explicit **current-source-wins** rule. When two official DNR publications disagree on mileage, Trail Truth uses the newer/current park map for the route distance, preserves the older official value in the provenance note, and shows the discrepancy in the selected-route UI. Older descriptive material may still support terrain, route character, or access context; it does not override newer published mileage.

The current DNR map is therefore authoritative for Escarpment Trail (3.7 miles), Lake Superior Trail (15.6 miles), and Big Carp River Trail (8 miles) even though the older DNR trail-description sheet lists 4.3, 17.1, and 9.6 miles respectively. Big Carp no longer qualifies for the approximately-ten-mile intent family; Little Carp River Trail at 10.7 miles now carries that current-map role.

Isle Royale depth now spans Rock Harbor, Windigo, Greenstone Ridge, Hidden Lake and Passage Island. Access-dependent routes retain the access mode in the profile: a two-mile Lookout Louise route does not imply a two-mile walk from Rock Harbor, and Passage Island does not imply road/trailhead access from the main island.

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
