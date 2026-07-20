# Michigan Outdoors Now usefulness scorecard

This scorecard prevents a visual redesign from being mistaken for a more useful product. The weighted quality score is a release gate; live engagement is a separate outcome measure.

## Baseline and release gate

- Audited baseline: **62/100** on 2026-07-20.
- Required preview score: **88/100 or higher**.
- Production stays untouched until build, runtime, mobile, accessibility, SEO, and live-data checks pass on the preview.
- Production domain/indexing verification is intentionally worth three points and cannot pass from source code alone.

| Category | Weight | Baseline | What earns full credit |
| --- | ---: | ---: | --- |
| Decision quality | 25 | 14 | Curated ranking, current conditions, activity-aware weather, primary/backup choice, and map/official next actions |
| Interaction efficiency | 20 | 8 | Progressive form, useful presets, shareable private-fragment setup, share action, and easy reruns |
| Result clarity | 15 | 7 | Side-by-side comparison, the weather signals that matter, and plain-language reasons/cautions |
| Trust and safety | 15 | 13 | Source/timestamp/fallback clarity, explicit safety limitations, official checks, and no account/device-location request |
| Mobile and accessibility | 15 | 14 | Semantic controls, keyboard/focus/live-region support, mobile layout, touch targets, and reduced motion |
| Discoverability and measurement | 10 | 6 | Metadata/schema/local pages, verified production domain/indexing, product analytics, and Chris Izworski identity links |

Run `npm run score:usefulness` to evaluate source-backed criteria. It reports production verification separately instead of pretending a branch can prove DNS, indexing, or a live alias.

## Engagement benchmark

There was no reliable product-event baseline before this upgrade, so a claim of “10x” today would be invented. This release creates the first honest benchmark through privacy-safe events that do not include a visitor’s entered city or ZIP.

The north-star metric is **high-intent actions per visit**: completed plans, primary/backup decisions, shares, map opens, and official-detail opens. Initial targets are 30% planner completion, 50% decision action after completion, 35% outbound action after completion, and 8% sharing. The longer-term goal is 10x high-intent actions compared with the first stable seven-day post-release baseline, while holding 404s, build checks, and Core Web Vitals steady or better.

SEO should be judged separately using indexed-page coverage, non-brand impressions, click-through rate, and clicks in Google Search Console. Product interactions can improve immediately; search changes need crawling and enough impressions to become meaningful.
