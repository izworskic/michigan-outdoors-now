# Live Opportunity Detection

Updated: August 28, 2026

Michigan Outdoors Now now has a second decision layer beyond ordinary destination ranking: **brief outdoor windows that stand out enough to be worth noticing now**.

## Product rule

An opportunity is not simply a high score.

A candidate must:

1. clear an activity-specific absolute fit threshold;
2. pass conservative weather guards;
3. be materially better than tomorrow at the same place, materially better than the statewide peer set, or clear an exceptional absolute threshold;
4. retain explicit source and safety boundaries.

This prevents the homepage from turning into a permanent "everything is great" recommendation feed.

## Initial opportunity types

- standout hiking weather
- standout scenic weather
- unusually clear dark-sky weather
- calm-weather paddling leads

The paddling signal is deliberately **weather-only**. It does not claim safe waves, currents, marine conditions, launch status, or cold-water risk. Every paddling opportunity routes the visitor to the Great Lakes Buoys specialist before commitment.

Dark-sky opportunities likewise do not claim aurora visibility. They route to Northern Lights Michigan to verify space weather and other night-sky factors.

## Repeat-use thesis

The core planner answers:

> Where should I go?

The opportunity layer adds:

> What unusually good window is happening right now that I might otherwise miss?

That distinction is intended to create a reason to return even when a visitor is not starting from a blank trip-planning task.

## Measurement

Two fixed-label events are added:

- `opportunity_opened`
- `opportunity_verify_opened`

They record fixed opportunity kind, activity, and destination slug only. Exact coordinates and free-text user queries remain outside growth analytics.

## Growth brief

The weekly growth workflow now also writes a concise Markdown and JSON brief that:

- separates non-branded search from Chris / owned-brand queries;
- summarizes impressions, clicks, CTR, and weighted position;
- summarizes landing → planner → completion → directions behavior;
- ranks the highest-leverage `UX_REPAIR`, `PUSH_CTR`, and `BUILD_AUTHORITY` opportunities;
- shows family expansion gates;
- posts the brief into the GitHub Actions run summary while retaining raw artifacts.

The existing rule remains unchanged: search visibility by itself cannot authorize more indexable pages.
