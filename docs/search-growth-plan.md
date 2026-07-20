# Michigan Outdoors Now search growth plan

## Goal

Turn a broad Michigan planning tool into a set of approachable, useful search destinations. The release is designed to earn long-tail visibility by solving distinct planning jobs, not by generating thin permutations of cities and keywords.

The audited source baseline is **42/100**. The release gate is **85/100**. Production domain, crawlability, and indexing remain a manual gate because source code cannot prove them.

## Personas and search-intent clusters

| Persona | Planning job | Search-intent page |
| --- | --- | --- |
| Spontaneous local | “Give me something useful outside today within a short drive.” | `/ideas/outdoors-today` |
| Family decision-maker | “Find an outing flexible enough for kids and changing conditions.” | `/ideas/family-day-trips` |
| Shoreline seeker | “Which Michigan beach is a sensible day trip under current conditions?” | `/ideas/beach-day-trips` |
| Trail-day planner | “Choose a hiking destination before I select the exact route.” | `/ideas/hiking-day-trips` |
| Wildlife watcher | “Point me toward useful Michigan birding habitat within reach.” | `/ideas/birding-day-trips` |
| Water-day planner | “Narrow paddling destinations while keeping wind and water limits explicit.” | `/ideas/paddling-day-trips` |
| Night-sky seeker | “Choose a dark-sky direction using cloud cover and night access.” | `/ideas/dark-sky-stargazing` |
| Shipwatcher | “Choose between the Soo Locks, rivers, points, and harbor approaches.” | `/ideas/freighter-watching` |
| Dog-included planner | “Only show plans where the dog can be part of the actual outing.” | `/ideas/dog-friendly-day-trips` |
| Access-first planner | “Let route and facility needs lead the destination choice.” | `/ideas/lower-barrier-outdoors` |

## Page quality contract

Every indexable guide must have a unique intent, direct answer, named audience, decision guidance, safety/access checklist, at least five relevant curated destinations with official links, three visible FAQs, distinct metadata, breadcrumbs, structured data matching visible content, related internal links, and a preconfigured live planner. A page fails the automated gate if it cannot meet that contract.

City pages remain limited to the eleven curated starting points. The project will not create activity × city pages unless real search performance and enough unique local information justify each page.

## Google and AI search approach

Google states that AI Overviews and AI Mode do not require special AI markup. The same fundamentals apply: crawlable pages, visible textual answers, internal links, a strong page experience, and structured data that matches the page. The guide architecture follows that guidance. `llms.txt` and `llms-full.txt` provide an additional concise reference for systems that voluntarily use those files, but they are not treated as a Google ranking shortcut.

Primary guidance:

- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
- https://developers.google.com/search/docs/appearance/snippet

## Measurement

Search Console is the search source of truth: indexed canonical URLs, non-brand impressions, clicks, click-through rate, average position, query clusters, and guide-page landing traffic. Vercel Analytics measures what happens after the click: planner completions, primary/backup decisions, shares, maps, and official-detail opens.

The first stable 28 days after indexing establish the organic baseline. Initial quality targets are at least 25% planner completion from organic guide sessions, at least 30% outbound action after an organic completion, and at least 5% sharing. The long-term goal is 10x qualified organic entries compared with that baseline, without increasing thin pages, 404s, indexing errors, or Core Web Vitals regressions. Rankings and AI citations cannot be guaranteed.
