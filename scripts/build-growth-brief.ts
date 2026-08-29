#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  scoreFamilyGrowth,
  scoreSearchOpportunity,
  type ProductFunnelRow,
  type SearchConsoleRow,
} from "../src/lib/growth-opportunities";

type SearchSnapshot = {
  window?: { label?: string };
  rows?: SearchConsoleRow[];
};

type ProductSnapshot = {
  window?: { label?: string };
  rows?: ProductFunnelRow[];
  opportunitySignals?: Array<{ kind: string; opens: number; verifications: number }>;
  myOutdoorsSignals?: Record<string, number>;
};

const root = path.resolve(import.meta.dirname, "..");

function arg(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.resolve(root, file), "utf8")) as T;
}

function brandedQuery(query: string) {
  return /\b(chris\s+izworski|izworski|freighter\s+view\s+farms)\b/i.test(query);
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

async function main() {
const searchFile = arg("--search", "data/growth/search-console-baseline.json");
const productFile = arg("--product", "data/growth/product-events-baseline.json");
const markdownOutput = arg("--markdown", "artifacts/growth/growth-brief.md");
const jsonOutput = arg("--json", "artifacts/growth/growth-brief.json");

const search = await readJson<SearchSnapshot>(searchFile);
const product = await readJson<ProductSnapshot>(productFile);
const searchRows = search.rows ?? [];
const productRows = product.rows ?? [];

const productByPage = new Map(productRows.map((row) => [row.pageKey, row]));
const scored = searchRows.map((row) =>
  scoreSearchOpportunity(row, productByPage.get(row.page.replace(/^\//, ""))),
);

const priorityOrder = new Map([
  ["UX_REPAIR", 0],
  ["PUSH_CTR", 1],
  ["BUILD_AUTHORITY", 2],
  ["PROTECT", 3],
  ["HOLD", 4],
]);

const priorities = [...scored]
  .sort((a, b) => {
    const action = (priorityOrder.get(a.action) ?? 9) - (priorityOrder.get(b.action) ?? 9);
    if (action !== 0) return action;
    return b.row.impressions - a.row.impressions;
  })
  .slice(0, 8);

const families = [
  ...new Set(
    searchRows
      .map((row) => row.family)
      .filter((family): family is string => Boolean(family)),
  ),
];
const familyDecisions = families.map((family) =>
  scoreFamilyGrowth(family, searchRows, productRows),
);

const brandedRows = searchRows.filter((row) => row.branded ?? brandedQuery(row.query));
const nonBrandedRows = searchRows.filter((row) => !(row.branded ?? brandedQuery(row.query)));

function searchTotals(rows: SearchConsoleRow[]) {
  const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  const weightedPosition = impressions
    ? rows.reduce((sum, row) => sum + row.position * row.impressions, 0) / impressions
    : 0;
  return {
    impressions,
    clicks,
    ctr: percent(clicks, impressions),
    position: weightedPosition,
  };
}

const productTotals = productRows.reduce(
  (totals, row) => ({
    landingViews: totals.landingViews + row.landingViews,
    plannerStarts: totals.plannerStarts + row.plannerStarts,
    plannerCompletions: totals.plannerCompletions + row.plannerCompletions,
    resultOpens: totals.resultOpens + row.resultOpens,
    departures: totals.departures + row.departures,
    directions: totals.directions + row.directions,
  }),
  {
    landingViews: 0,
    plannerStarts: 0,
    plannerCompletions: 0,
    resultOpens: 0,
    departures: 0,
    directions: 0,
  },
);

const summary = {
  generatedAt: new Date().toISOString(),
  searchWindow: search.window?.label ?? searchFile,
  productWindow: product.window?.label ?? productFile,
  search: {
    all: searchTotals(searchRows),
    branded: searchTotals(brandedRows),
    nonBranded: searchTotals(nonBrandedRows),
  },
  product: {
    ...productTotals,
    plannerStartRate: percent(productTotals.plannerStarts, productTotals.landingViews),
    completionRate: percent(productTotals.plannerCompletions, productTotals.plannerStarts),
    directionsRate: percent(productTotals.directions, productTotals.landingViews),
  },
  priorities: priorities.map((item) => ({
    action: item.action,
    page: item.row.page,
    query: item.row.query,
    impressions: item.row.impressions,
    ctr: item.row.ctr,
    position: item.row.position,
    reason: item.reason,
  })),
  familyDecisions,
  opportunitySignals: product.opportunitySignals ?? [],
  myOutdoorsSignals: product.myOutdoorsSignals ?? {},
};

const fmtPct = (value: number) => `${(value * 100).toFixed(1)}%`;
const fmtPos = (value: number) => (value ? value.toFixed(1) : "—");

const markdown = `# Michigan Outdoors Now weekly growth brief

**Search window:** ${summary.searchWindow}  
**Product window:** ${summary.productWindow}

## Search acquisition

| Segment | Impressions | Clicks | CTR | Weighted position |
| --- | ---: | ---: | ---: | ---: |
| Non-branded | ${summary.search.nonBranded.impressions} | ${summary.search.nonBranded.clicks} | ${fmtPct(summary.search.nonBranded.ctr)} | ${fmtPos(summary.search.nonBranded.position)} |
| Chris / owned-brand | ${summary.search.branded.impressions} | ${summary.search.branded.clicks} | ${fmtPct(summary.search.branded.ctr)} | ${fmtPos(summary.search.branded.position)} |
| All | ${summary.search.all.impressions} | ${summary.search.all.clicks} | ${fmtPct(summary.search.all.ctr)} | ${fmtPos(summary.search.all.position)} |

## Product value

- Landing views: **${summary.product.landingViews}**
- Planner starts: **${summary.product.plannerStarts}** (${fmtPct(summary.product.plannerStartRate)} of landings)
- Completed plans: **${summary.product.plannerCompletions}** (${fmtPct(summary.product.completionRate)} of starts)
- Directions opens: **${summary.product.directions}** (${fmtPct(summary.product.directionsRate)} of landings)

## Live opportunity engagement

${summary.opportunitySignals.length
  ? summary.opportunitySignals
      .map((item) => `- **${item.kind}** — ${item.opens} opens · ${item.verifications} specialist verifications`)
      .join("\n")
  : "- No measured opportunity opens yet."}

## My Outdoors continuity

- Drawer opens: **${summary.myOutdoorsSignals.my_outdoors_opened ?? 0}**
- Saved/applied setups: **${(summary.myOutdoorsSignals.my_outdoors_saved ?? 0) + (summary.myOutdoorsSignals.my_outdoors_applied ?? 0)}**
- Place saves: **${summary.myOutdoorsSignals.my_outdoors_place_saved ?? 0}**
- Visited toggles: **${summary.myOutdoorsSignals.my_outdoors_visited_toggled ?? 0}**
- Remembered setup loads: **${summary.myOutdoorsSignals.my_outdoors_loaded ?? 0}**

## Highest-leverage actions

${summary.priorities.length
  ? summary.priorities
      .map(
        (item, index) =>
          `${index + 1}. **${item.action}** — ${item.query} · ${item.impressions} imp · ${fmtPct(item.ctr)} CTR · pos ${item.position.toFixed(1)}\n   - ${item.reason}`,
      )
      .join("\n")
  : "No page/query rows have enough evidence to prioritize yet."}

## Family expansion gates

${summary.familyDecisions.length
  ? summary.familyDecisions
      .map(
        (item) =>
          `- **${item.family}: ${item.action}** — ${item.impressions} impressions, ${item.clicks} clicks, ${item.plannerCompletions} completed plans, ${item.directions} directions. ${item.reason}`,
      )
      .join("\n")
  : "- No indexed location-intent family has enough measured query data yet."}

> Expansion remains blocked by default. Visibility alone cannot authorize new search pages; downstream planning value and the central canonical/cannibalization gate are both required.
`;

for (const output of [markdownOutput, jsonOutput]) {
  await mkdir(path.dirname(path.resolve(root, output)), { recursive: true });
}
await writeFile(path.resolve(root, markdownOutput), markdown);
await writeFile(path.resolve(root, jsonOutput), JSON.stringify(summary, null, 2) + "\n");

console.log(markdown);
console.log(`Wrote ${path.resolve(root, markdownOutput)}`);
console.log(`Wrote ${path.resolve(root, jsonOutput)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
