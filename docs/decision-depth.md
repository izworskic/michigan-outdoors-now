# Decision-depth benchmark

The result-first interface is no longer the main weakness. The next risk is that the planner looks decisive while still forcing the user to remember alternatives or trust an under-specified ranking.

## Devil's-advocate gaps

### Ranking can sound more certain than the underlying data
A mapped trailhead is not the same thing as a fully understood hike. A rough distance-derived drive estimate is not a routed ETA. The UI must distinguish those things explicitly.

### Natural language needs to preserve effort
“Long hike” cannot collapse into the same intent as “hike.” Full-day / backcountry language must affect ranking, especially for curated destinations where we have richer descriptive evidence.

### Users need a decision workspace
A person considering a 45-minute local option and a 3-hour destination should not have to remember one while searching farther for the other. The product should hold a small shortlist and compare it.

## Product requirements

- Parse long/full-day/backcountry language as effort intent.
- Prefer curated destinations with strong long/backcountry signals when the user asks for them.
- Never imply exact mileage for a map-only trailhead when we do not have it.
- Let the user keep up to three places.
- Keep those places while expanding the search farther from the same origin.
- Compare place, area, rough drive estimate, category, match reason, and planning depth in one view.
- Label curated destinations as **Full guide** and raw mapped candidates as **Mapped lead**.
- Use rough-drive language everywhere semantic discovery displays travel time.
- Let a comparison choice return directly to the map/detail without destroying the shortlist.

## Research direction

Current mapping products reinforce two behaviors that matter here:

- Google Maps makes saved places and lists a first-class part of returning to and organizing candidate places.
- Komoot continues to add pre-commit confidence features such as Trail View, route preferences, and climb information so a user can assess what is actually ahead before changing or committing to a route.

Michigan Outdoors Now should not imitate either product wholesale. The useful lesson is that **discovery without decision memory and confidence information is incomplete**.
