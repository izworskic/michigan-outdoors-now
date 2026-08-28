#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  scoreFamilyGrowth,
  scoreSearchOpportunity,
} from "../src/lib/growth-opportunities";

const root = path.resolve(import.meta.dirname, "..");
function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
async function readJson(file) {
  return JSON.parse(await readFile(path.resolve(root, file), "utf8"));
}

const searchFile = arg("--search", "data/growth/search-console-baseline.json");
const productFile = arg("--product", "data/growth/product-events-baseline.json");
const search = await readJson(searchFile);
const product = await readJson(productFile);

const productByPage = new Map((product.rows ?? []).map((row) => [row.pageKey, row]));
const opportunities = (search.rows ?? []).map((row) =>
  scoreSearchOpportunity(row, productByPage.get(row.page.replace(/^\//, ""))),
);

const families = [...new Set((search.rows ?? []).map((row) => row.family).filter(Boolean))];
const familyDecisions = families.map((family) =>
  scoreFamilyGrowth(family, search.rows ?? [], product.rows ?? []),
);

console.log("\nMICHIGAN OUTDOORS NOW GROWTH REPORT");
console.log("=".repeat(78));
console.log(`Search snapshot: ${search.window?.label ?? searchFile}`);
console.log(`Product snapshot: ${product.window?.label ?? productFile}`);

console.log("\nPAGE / QUERY OPPORTUNITIES\n");
for (const item of opportunities) {
  console.log(`${item.action.padEnd(15)} pos ${item.row.position.toFixed(1).padStart(5)}  imp ${String(item.row.impressions).padStart(5)}  ctr ${(item.row.ctr * 100).toFixed(2).padStart(5)}%  ${item.row.query}`);
  console.log(`  ${item.reason}`);
}

console.log("\nFAMILY EXPANSION GATES\n");
for (const item of familyDecisions) {
  console.log(`${item.action.padEnd(15)} ${item.family} · ${item.impressions} impressions · ${item.plannerCompletions} plans · ${item.directions} directions`);
  console.log(`  ${item.reason}`);
}

console.log("\nRULE: Search visibility alone cannot authorize new pages. Family expansion requires demonstrated downstream planning value as well as search demand.\n");
