# My Michigan Outdoors

Updated: August 28, 2026

My Michigan Outdoors is an account-free continuity layer for returning visitors.

## What it remembers

On the visitor's current device only:

- usual Michigan starting city or ZIP;
- normal maximum drive time;
- preferred trip shape: quick outing, half day, full day, or weekend;
- favorite outdoor activities;
- usual kids, dog, and lower-barrier access constraints;
- favorite Michigan region labels entered by the visitor;
- saved places;
- places marked "been there";
- recently considered places.

Exact device coordinates are deliberately **not** stored. When a visitor uses browser geolocation, the current request may use those coordinates, but "Use current" only remembers the typed/resolved place label and drive range. A generic "My location" value is not persisted as a home location.

## Product behavior

The homepage keeps the existing result-first map. My Outdoors lives behind a compact drawer rather than occupying permanent first-screen space.

When remembered settings exist:

- the homepage seeds the normal start, drive range, trip shape/activity direction, and household/access constraints;
- the visitor can apply or edit them without an account;
- place and semantic-discovery decisions can be saved for later;
- opening curated or live-discovery results records a bounded recent-place history;
- place pages support Save and Been there actions;
- secondary place/guide planners inherit start, range, and household/access constraints while preserving the page's activity focus;
- explicit shared-plan links always override local memory.

## Truth boundary for preferences

Kids, dog, and lower-barrier access preferences are treated as actual constraints, not decoration.

For curated destinations, those preferences filter against the verified destination flags already maintained by Michigan Outdoors Now.

For semantic discovery, when any of those strict preferences is active, the API deliberately limits results to curated destinations with verified attributes rather than claiming that generic OpenStreetMap POIs prove household or accessibility suitability.


## What changed on return

Saved curated places now establish a lightweight opportunity baseline on the visitor's device.

The browser requests the same public statewide opportunity set used by Michigan Outdoors Now. It does **not** send the visitor's saved-place list, home location, favorite regions, or local baseline to a personalization endpoint.

On later visits, a saved curated place appears under **Since your last check** only when:

- it previously did not clear the conservative opportunity threshold and now does; or
- it was already strong but its weather-fit score improves by at least 8 points; or
- it improves by at least 4 score points plus at least 10 signal-strength points.

The first check only establishes a baseline. Small fluctuations do not create a notification.

When a material change exists, the My Outdoors trigger shows a compact changed badge. Opening My Outdoors marks the current baseline as seen while leaving the explanation visible for that visit.

This is intentionally an in-product return signal, not a push notification. It does not claim that access, trail, marine, ice, road, or local hazard conditions are safe merely because the weather-fit window improved.

Only curated saved places participate in this first version. Live semantic/OpenStreetMap-only saves remain saved, but do not receive a change claim until an equally trustworthy comparison model exists for them.

## Privacy boundary

My Outdoors uses browser localStorage only. It creates no account, server profile, cookie identity graph, or cross-device sync.

Growth analytics use fixed-label events and counts only. They may record whether a setup exists, the number of saved places, a trip-shape category, or the source category of a save. They must not record:

- exact coordinates;
- the remembered home city/ZIP value;
- favorite-region text;
- saved-place names;
- saved-place identifiers or opportunity baselines in My Outdoors change events;
- free-text outdoor searches;
- other local profile text.

## Measurement

The weekly product snapshot now counts:

- `my_outdoors_loaded`;
- `my_outdoors_opened`;
- `my_outdoors_saved`;
- `my_outdoors_applied`;
- `my_outdoors_place_remembered`;
- `my_outdoors_place_saved`;
- `my_outdoors_place_unsaved`;
- `my_outdoors_visited_toggled`;
- `my_outdoors_changes_detected`;
- `my_outdoors_changes_seen`;
- `my_outdoors_change_opened`;
- `my_outdoors_change_verify_opened`.

The weekly growth brief exposes the key continuity indicators so repeat-use value can be judged alongside search acquisition and opportunity engagement.
