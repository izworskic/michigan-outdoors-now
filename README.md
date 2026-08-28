# Michigan Outdoors Now

A mobile-first Michigan day and weekend planner designed and built by [Chris Izworski](https://chrisizworski.com/).

The planner supports both structured planning and free-form semantic discovery, with explainable destination matches based on:

- Michigan city or ZIP starting point
- today, tomorrow, or this weekend
- a one-way drive-time window
- outdoor activities and practical needs
- current forecast, wind, and U.S. AQI when available

It combines a curated Michigan destination set with live OpenStreetMap discovery, routed travel when the fast routing budget answers, Open-Meteo weather/AQI, Michigan DNR trail/access layers, comparison, provenance, and a fail-soft fallback. It requires no account or LLM. Device location is an optional one-tap input; typed Michigan cities and ZIP codes remain the default fallback.

The site also includes substantial server-rendered planning guides for distinct search intents: outdoors today, family days, beaches, hiking, birding, paddling, dark skies, freighters, dog-friendly trips, and lower-barrier access. Each guide includes unique decision help, relevant curated examples, official links, FAQs, structured data, and a preconfigured planner.

The impact-readiness release adds a real zoomable, filterable Michigan map at `/explore` and 32 server-rendered destination decision pages at `/places/[place]`. The map uses MapLibre with OpenFreeMap/OpenStreetMap data, needs no account or API key, shows numbered pins matched to the result list, and can privately rank matches from a visitor's one-time device location. Each destination page combines a unique direct answer, live planning signals, activity and access context, official and map links, nearby alternatives, related guides, structured place data, and the interactive planner.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validation

```bash
npm run check
```

This runs linting, deterministic planner, guide, destination, and privacy tests; the production build; generated SEO and structured-data checks; live production-server requests; the original source-readiness checks; and the stricter 200-point impact gate.

The scorecard methodology lives in `docs/usefulness-scorecard.md`, `docs/search-growth-plan.md`, and `docs/impact-readiness-v2.md`. Scores measure release readiness, not guaranteed rankings or traffic.

## Safe indexing gate

Vercel production builds (`VERCEL_ENV=production`) are indexable automatically once this approved release reaches production. Preview deployments, local builds, and test builds remain `noindex` by default. Set `NEXT_PUBLIC_ALLOW_INDEXING=true` only for an approved non-Vercel production build, or set `NEXT_PUBLIC_DISABLE_INDEXING=true` as an emergency production kill switch.

Set `NEXT_PUBLIC_SITE_URL` to the approved canonical production origin before enabling indexing. Generated planner API responses always remain private, non-cacheable, and `noindex`.

## Data and limits

Forecast, wind, and air quality come from [Open-Meteo](https://open-meteo.com/). Map tiles come from [OpenFreeMap](https://openfreemap.org/) with OpenStreetMap data and visible attribution. Drive times are rough estimates, not live traffic. Trip-fit scores are not safety ratings. Visitors should confirm official closures, hazards, water, weather, road, trail, and access conditions before travel.


## Growth operating system

Michigan Outdoors Now measures acquisition and usefulness as one funnel rather than treating page count as growth.

- 54 quality-gated location-intent pages are attributed by surface, starting-city slug, intent slug, and page key.
- Vercel custom events cover planner starts/completions plus the semantic decision funnel through comparison, trust/provenance, departure mode, and directions.
- Exact coordinates, device location, and free-text semantic queries are excluded from growth analytics.
- `npm run report:growth` joins normalized Search Console and product-funnel snapshots and classifies opportunities as `PUSH_CTR`, `BUILD_AUTHORITY`, `UX_REPAIR`, `PROTECT`, or `HOLD`.
- Search families only earn `EXPAND_FAMILY` when they demonstrate both qualified search demand and downstream planning value.
- `/growth-manifest.json` exposes the versioned noindex measurement contract so the central ChrisIzworski.com search portfolio can coordinate ownership and experiments across repos.

The initial Search Console snapshot is explicitly pre-launch evidence. The attributed product-funnel baseline is empty rather than backfilled with invented counts.
