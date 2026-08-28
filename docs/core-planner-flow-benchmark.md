# Core planner flow benchmark

This benchmark covers the only flow that matters before additional planner intelligence is allowed to ship:

1. Establish a Michigan starting point.
2. Confirm that starting point visibly.
3. Describe the outdoor day in plain language.
4. Return useful possibilities quickly.
5. Let the visitor choose a result before opening a detail sheet.

## Release standard

A release must score at least **90/100** and cannot fail a critical criterion.

### 1. Typed origin resolution — 20
Submitting a typed city or ZIP must call a real origin-resolution endpoint, return a canonical Michigan place, coordinates, and recenter the map. Merely moving keyboard focus does not count.

### 2. Explicit origin state — 15
The UI must visibly distinguish unresolved, resolving, resolved, and error states. Search must not pretend an unresolved text string is a confirmed origin.

### 3. Device-location parity — 10
Device location and typed location must populate the same resolved-origin state used by discovery.

### 4. Fast discovery fallback — 20
The first useful answer must not depend on a public POI service. Curated Michigan results are computed first; external POI enrichment gets a strict short budget. Target API response: **<= 3 seconds** under external-provider failure.

### 5. Search does not auto-open detail — 15
Submitting intent returns map points and a compact result preview. The user chooses which result to open. A result sheet must never appear simply because search completed.

### 6. Visible search results — 10
Search success must be visually obvious even before a map marker is tapped: result count plus top candidate buttons.

### 7. Responsive non-overlap — 5
The origin control, intent control, result preview, and detail sheet cannot cover one another at phone, tablet, or desktop breakpoints.

### 8. Runtime endpoint coverage — 5
Production runtime checks must exercise typed origin resolution and the real discovery endpoint, including a maximum response-time assertion.

## Critical failures

Any of these block release regardless of total score:

- Typed city/ZIP submit does not resolve coordinates.
- Discovery requires external Overpass success.
- Discovery automatically opens a detail sheet.
- Search input is obscured by a result sheet.
- Runtime checks do not exercise both origin and discovery endpoints.
