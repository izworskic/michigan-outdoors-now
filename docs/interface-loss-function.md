# Michigan Outdoors Now — Interface Loss Function

Status: release gate  
Direction: **lower is better**  
Release target: **<= 25 / 100**  
Flagship target: **<= 15 / 100**

The interface is not graded on visual decoration. It is penalized when it makes an outdoor decision harder, slower, denser, or less trustworthy.

## Loss function

`L = A + C + M + P + H + E + S + T`

| Term | Max loss | What it penalizes |
| --- | ---: | --- |
| A — Action latency | 20 | Content, explanation, or promotional blocks before the first useful map action |
| C — Control entropy | 15 | Too many equal-weight controls visible at once |
| M — Map competition | 15 | Permanent rails, fixed dashboard splits, or chrome that steals the map's primary visual role |
| P — Progressive disclosure failure | 15 | Lists, advanced filters, and supporting data shown before the user asks for them |
| H — Hierarchy noise | 10 | Repetitive stat cards, explainer cards, and decorative sections competing with the task |
| E — Ergonomic/mobile friction | 10 | Mode switching, small targets, or layouts that require choosing between map and results |
| S — Safety/access blindness | 10 | Current closures/reroutes hidden from the primary discovery surface |
| T — Trust distance | 5 | Source/freshness information separated from the data it qualifies |

Maximum loss = 100.

## Design contract

The first useful screen should answer: **what is here, what layer am I looking at, and is anything closed?**

The default state should contain only five primary actions:

1. search
2. choose activity/layer
3. use location
4. open filters
5. browse results

Everything else is contextual or progressive.

### Map contract

- The map is the dominant surface, not one half of a dashboard.
- Decision-ready places are visible without implying arbitrary ranking.
- DNR trail geometry is visible for broad discovery.
- Temporary closures and reroutes are visually distinct and visible by default when returned.
- Supporting lists open as an overlay/drawer rather than permanently shrinking the map.
- Source and freshness travel with the map status.

### Mobile contract

- The map remains usable without switching to a separate "list mode."
- Browse results use a bottom sheet/drawer.
- Search and layer selection stay reachable.
- Secondary filters are collapsed by default.

## Fatal interface regressions

A release fails regardless of numerical loss if it reintroduces:

- arbitrary numbered pins
- a permanent map/list split as the default experience
- explanatory/marketing sections before the first primary interaction
- hidden closure/reroute data when the source returned it
- fabricated safety/access states
- a mobile interaction that makes the user abandon the map to see results

## Why a loss function

A feature can add data and still make the product worse. This gate forces every new integration to pay for its interface cost. New controls must replace, combine, or hide old controls rather than accumulating indefinitely.
