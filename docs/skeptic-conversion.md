# Skeptic-conversion benchmark

The next competitor is indifference. A skeptical visitor does not care how many data sources the planner uses. They need a reason to prefer this decision over Google Maps, AllTrails, a generic AI answer, or their own Michigan knowledge.

## Hostile personas

### “I already know Michigan”
The product has to surprise this person with credible, less-obvious places rather than recycling household-name destinations.

### “AI recommendations are bullshit”
The product must show source provenance and unknowns. Confidence is qualitative, never a fake percentage.

### “AllTrails already does trails”
Michigan Outdoors Now wins by comparing the whole outdoor day and explaining why one option is better for this request and this moment.

### “Google Maps already finds places”
The product must argue the decision, not merely locate the place.

### “Stop turning the outdoors into an app”
After the user commits, discovery chrome disappears. The interface becomes a departure card with only the information needed to leave.

## Release requirements

### Surprise me
A location-aware **Surprise me** action uses the existing travel constraint but intentionally de-emphasizes Michigan household names. It prefers credible less-obvious curated places and strong mapped leads. It is not random novelty.

The user can say **Not for me** without creating an account. That dismissal lasts for the current session and is excluded from the next surprise query.

### Why this one?
A selected result can answer:
- what this place gives the user
- what it costs versus a serious alternative
- when the alternative is the better choice

The copy must use actual drive and planning-depth differences rather than generic persuasion.

### Get me out of here
After commitment, the tool removes discovery clutter and shows:
- destination
- drive / arrival if leaving now
- current weather
- trail / terrain
- access cautions
- directions
- deeper guide/source only when needed

No “you may also like” carousel appears in departure mode.

### Provenance ledger
Every serious selected result exposes:
- route provenance
- weather source
- trail/access source
- OSM metadata source when used
- last confidence refresh
- explicit unknowns

The ledger is compact and expandable. It does not require an account.

## Taste rule

The full funnel becomes:

**Discover → understand → believe → commit → leave.**

Each stage should remove uncertainty rather than add controls.
