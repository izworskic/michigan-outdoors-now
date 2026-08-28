# Field-confidence benchmark

The planner can now find, rank and compare places. The next product standard is whether a user can make a real-world decision without being misled by missing trail or travel data.

## Product requirements

### Routed driving when available
Semantic discovery makes one batched road-routing request for the result set. Results that route successfully display road distance and routed duration. The request has a strict sub-second budget. If routing misses the budget, the result remains usable and clearly displays a planning estimate.

The public OSRM service is best-effort and replaceable through `ROUTING_BASE_URL`; it is never a hard dependency.

### Current point weather
Opening a semantic result loads current temperature, daily high, precipitation probability, gusts and AQI for the selected coordinates through Open-Meteo. Missing weather cannot block the place detail.

### Michigan-specific trail intelligence
The selected-place request uses a small spatial envelope instead of reloading the entire statewide DNR trail dataset. It retrieves nearby official hiking segments plus official closure and reroute layers.

Nearby DNR mileage is explicitly labeled as mileage returned inside the local window. It is not presented as a verified hike length.

### Terrain and difficulty
Nearby DNR trail geometry is sampled through Open-Meteo's elevation API to estimate terrain elevation range. This is not represented as total route gain.

Nearby OSM hiking relations and path ways are checked for mapped fields such as:
- route distance
- `sac_scale`
- `trail_visibility`
- surface
- foot/access tags

Those fields appear only when the source actually contains them.

### Access confidence
Official Michigan DNR closures and reroutes near the selected coordinates are surfaced prominently. No-result language says only that no item was returned from the official nearby layer; it never claims a trail is universally open.

## Taste rule

The confidence layer answers a different question than the result card:

**Result card:** Is this worth considering?

**Trip confidence:** What do we know right now that could change whether I actually go?
