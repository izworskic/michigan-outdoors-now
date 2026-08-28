# Michigan Outdoors Now growth operating system

The growth system is not a page generator. It joins three kinds of evidence:

1. **Search acquisition** — query × page impressions, clicks, CTR, and average position from Google Search Console.
2. **Product value** — privacy-safe Vercel events that show whether a visitor actually plans, compares, commits, and opens directions.
3. **Portfolio governance** — ChrisIzworski.com remains the source of truth for canonical intent ownership, experiment freezes, entity strategy, and cross-tool promotion.

## Funnel

For qualified location-intent pages:

**Search landing view → planner start → planner completion → result consideration → commitment/directions**

Every event carries a fixed context:
- surface
- origin slug
- intent slug
- page key

The context must never include:
- exact coordinates
- device location
- the visitor's free-text semantic query

The flagship semantic planner uses the same event taxonomy from search through departure:

**semantic search → result open → keep → compare → decision argument → provenance → departure → directions**

## Search actions

The report engine can return:

- **PUSH_CTR** — meaningful impressions, near page one, weak CTR for position. Work on title/snippet/preview/first-answer alignment before more pages.
- **BUILD_AUTHORITY** — Google is testing the page but rank is the limiting factor. Improve answer depth and contextual inbound links.
- **UX_REPAIR** — the page gets visits but too few people start planning. Fix intent/product fit before trying to grow impressions.
- **PROTECT** — visibility and CTR are healthy enough to hold the treatment.
- **HOLD** — not enough evidence for a search-facing change.

## Family expansion

A search family does not earn more URLs from impressions alone.

**EXPAND_FAMILY** requires, in a comparable measured window:
- at least 250 Search Console impressions
- at least 5 clicks
- at least 10 completed plans
- at least 3 directions opens

Even then, every new URL must still pass the existing distinct-intent, duplicate-signature, cannibalization, canonical, and usefulness gates.

If a family has at least 500 impressions and at least 100 landing views but fewer than 2% start the planner, the system returns **DO_NOT_EXPAND**.

## Cadence

### Weekly
Use leading indicators only:
- indexing/canonical health
- emerging queries
- page position bands
- CTR gaps
- funnel breakpoints
- source/runtime regressions

Do not declare winners from partial windows.

### Complete 28-day window
Join Search Console and product funnel snapshots. Then:
- protect winners
- push CTR where rank already exists
- build authority where impressions exist but rank lags
- repair UX where clicks do not become planning
- expand only families that prove both demand and downstream value

## Cross-repo contract

Michigan Outdoors Now exposes a noindex machine-readable contract at:

`/growth-manifest.json`

ChrisIzworski.com remains the portfolio source of truth for:
- Chris Izworski entity ownership
- Tool Network Registry
- Search Authority Portfolio
- growth experiment ledger
- cannibalization boundaries
- cross-tool promotion

This keeps the tool's event/funnel implementation close to the product while central strategy remains coordinated across the whole owned network.
