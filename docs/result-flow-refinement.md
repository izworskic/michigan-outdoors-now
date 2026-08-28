# Result-flow refinement benchmark

This benchmark measures the next stage of Michigan Outdoors Now: reducing navigation friction after search and making range controls do exactly what their labels imply.

## Release standard

- Release target: **90/100**
- Flagship target: **95/100**
- Baseline before this refinement: **52/100**

## Criteria

### Persistent result dock — 25
Search results remain reachable on the map without scrolling back to the search box. On phone the result rail is horizontally swipeable; on larger screens it remains a compact bottom dock.

### Detail returns to dock — 15
Opening a result expands detail. Closing it returns immediately to the same result rail and preserves the search result set.

### Farther uses a new distance band — 25
“Go farther” searches only the newly unlocked travel band. It must not simply rerank the same nearby places.

### Newly unlocked results first — 15
The farther action returns candidates beyond the previous maximum and labels that range explicitly.

### Range state visible — 10
The result UI shows whether the current result set is inclusive (for example, “up to 4 hr”) or a specific farther band (for example, “4–6 hr”).

### Responsive non-overlap — 5
The result dock, detail sheet, planner controls, and bottom activity rail cannot cover one another on phone/tablet/desktop.

### Regression coverage — 5
Tests verify persistent dock behavior and the farther-band request contract.

## Product rule

The primary travel setting remains inclusive: **4 hours means everything from nearby through 4 hours**. The special “Go farther” action is intentionally different: it asks for the newly unlocked band so the user gets genuinely farther alternatives.
