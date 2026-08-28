# Semantic outdoor discovery

Michigan Outdoors Now now supports a free-form discovery path alongside the existing curated planner.

## What it does

A visitor can describe an outing in ordinary language, such as “quiet waterfall with a short hike, not crowded” or “brook trout water with camping nearby.” The discovery engine translates that request into a controlled geographic intent vocabulary, queries mapped Michigan POIs, blends those results with the curated destination catalog, applies the same inclusive one-to-eight-hour travel envelope, and ranks the candidates.

The live geographic source is OpenStreetMap through Overpass. Curated Michigan Outdoors Now destinations remain in the result set as a resilient fallback and as higher-context places that already have weather and specialist-tool integrations.

## Hugging Face research incorporated

The architecture was informed by two useful Hugging Face geospatial projects:

- `do-me/overture-places`: demonstrates bounding-box-first retrieval over a very large place universe and semantic category matching rather than downloading an entire POI corpus into the browser.
- `yuiseki/text2geoql`: demonstrates translating natural-language geographic intent into a constrained query vocabulary instead of sending arbitrary model output directly to a geographic backend.

This implementation deliberately does not ship the multi-gigabyte Overture corpus or a large embedding model in the default browser bundle. That would work against the planner’s recent map-load and CPU optimizations. The provider boundary is kept source-independent so a bounded Overture/FlatGeobuf adapter can be added later without changing the UI or result contract.

## Safety and reliability

User text is never interpolated into Overpass QL. It is mapped to an allow-listed set of POI selectors. Requests are bounded, time out, and fail over to a second public Overpass endpoint. If live discovery is unavailable, the API returns curated Michigan destinations rather than failing the planner.

Travel times are intentionally labeled as rough planning estimates. The search includes every qualifying place from nearby through the selected maximum drive time; the selected hour is a ceiling, not a distance band.

## Map behavior

Semantic results use a clustered MapLibre GeoJSON layer. They do not create large numbers of DOM markers, and they do not modify the transform behavior of the existing destination markers. This preserves the marker-coordinate and map-pan performance fixes already on `main`.
