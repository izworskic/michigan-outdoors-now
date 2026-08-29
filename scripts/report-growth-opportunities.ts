#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  scoreFamilyGrowth,
  scoreSearchOpportunity,
  type ProductFunnelRow,
  type SearchConsoleRow,
} from "../src/lib/growth-opportunities";
import {
  trailCandidateDemand,
  trailCandidateDemandRule,
} from "../src/lib/trail-query-demand";

type SearchSnapshot = {
  window?: { label?: string };
  rows?: SearchConsoleRow[];
};

type ProductSnapshot = {
  window?: { label?: string };
  rows?: ProductFunnelRow[];
};

const root = path.resolve(import.meta.dirname, "..");

function arg(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.resolve(root, file), "utf8")) as T;
}

const searchFile = arg("--search", "data/growth/search-console-baseline.json");
const productFile = arg("--product", "data/growth/product-events-baseline.json");
const search = await readJson<SearchSnapshot>(searchFile);
const product = await readJson<ProductSnapshot>(productFile);

const productByPage = new Map<string, ProductFunnelRow>(
  (product.rows ?? []).map((row) => [row.pageKey, row]),
);
const opportunities = (search.rows ?? []).map((row) =>
  scoreSearchOpportunity(row, productByPage.get(row.page.replace(/^\//, ""))),
);

const families = [
  ...new Set(
    (search.rows ?? [])
      .map((row) => row.family)
      .filter((family): family is string => typeof family === "string" && family.length > 0),
  ),
];
const familyDecisions = families.map((family) =>
  scoreFamilyGrowth(family, search.rows ?? [], product.rows ?? []),
);
const trailDemand = trailCandidateDemand(search.rows ?? []);

console.log("\nMICHIGAN OUTDOORS NOW GROWTH REPORT");
console.log("=".repeat(78));
console.log(`Search snapshot: ${search.window?.label ?? searchFile}`);
console.log(`Product snapshot: ${product.window?.label ?? productFile}`);

console.log("\nPAGE / QUERY OPPORTUNITIES\n");
for (const item of opportunities) {
  console.log(`${item.action.padEnd(15)} pos ${item.row.position.toFixed(1).padStart(5)}  imp ${String(item.row.impressions).padStart(5)}  ctr ${(item.row.ctr * 100).toFixed(2).padStart(5)}%  ${item.row.query}`);
  console.log(`  ${item.reason}`);
}

console.log("\nBLOCKED TRAIL-FAMILY DEMAND — LEADING SIGNAL ONLY\n");
for (const item of trailDemand.filter((candidate) => candidate.impressions > 0)) {
  console.log(
    `${item.label.padEnd(34)} imp ${String(item.impressions).padStart(5)}  clicks ${String(item.clicks).padStart(3)}  ctr ${(item.ctr * 100).toFixed(2).padStart(5)}%  pos ${item.weightedPosition.toFixed(1).padStart(5)}`,
  );
  console.log(
    `  ${item.profileCount} verified routes across ${item.destinationCount} destinations · ${item.state}`,
  );
}
if (!trailDemand.some((candidate) => candidate.impressions > 0)) {
  console.log("No blocked trail-family candidate has matched query demand yet.");
}
console.log(`\nRULE: ${trailCandidateDemandRule}\n`);

console.log("\nFAMILY EXPANSION GATES\n");
for (const item of familyDecisions) {
  console.log(`${item.action.padEnd(15)} ${item.family} · ${item.impressions} impressions · ${item.plannerCompletions} plans · ${item.directions} directions`);
  console.log(`  ${item.reason}`);
}

console.log("\nRULE: Search visibility alone cannot authorize new pages. Family expansion requires demonstrated downstream planning value as well as search demand.\n");
