# Michigan Outdoors Now

A mobile-first Michigan day and weekend planner designed and built by [Chris Izworski](https://chrisizworski.com/).

The planner returns up to three explainable destination matches based on:

- Michigan city or ZIP starting point
- today, tomorrow, or this weekend
- a one-way drive-time window
- outdoor activities and practical needs
- current forecast, wind, and U.S. AQI when available

It uses a curated set of 28 destinations, deterministic ranking, Open-Meteo data, and a distance-and-fit fallback. It requires no API key, account, device location, database, or LLM.

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

This runs linting, deterministic planner tests, the production build, generated SEO checks, and a production-server request check.

## Safe indexing gate

Search indexing is disabled unless `NEXT_PUBLIC_ALLOW_INDEXING=true` is explicitly set at build time. Until then, pages carry `noindex` metadata and headers and `robots.txt` disallows crawling.

Set `NEXT_PUBLIC_SITE_URL` to the approved canonical production origin before enabling indexing. Generated planner API responses always remain private, non-cacheable, and `noindex`.

## Data and limits

Forecast, wind, and air quality come from [Open-Meteo](https://open-meteo.com/). Drive times are rough estimates, not live traffic. Trip-fit scores are not safety ratings. Visitors should confirm official closures, hazards, water, weather, road, trail, and access conditions before travel.
