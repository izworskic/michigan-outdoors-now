#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";

async function main() {
  const root = path.resolve(import.meta.dirname, "..");
  const read = (file: string) => readFile(path.join(root, file), "utf8");

  const [engine, route, component, contract, workflow, docs, brief] = await Promise.all([
    read("src/lib/opportunity-engine.ts"),
    read("src/app/api/opportunities/route.ts"),
    read("src/components/opportunity-pulse.tsx"),
    read("src/lib/growth-contract.ts"),
    read(".github/workflows/growth-intelligence.yml"),
    read("docs/opportunity-detection.md"),
    read("scripts/build-growth-brief.ts"),
  ]);

  const checks = [
    ["comparative threshold", /vsTomorrow|vsMedian/.test(engine)],
    ["exceptional threshold", /score < 92/.test(engine)],
    ["paddling marine boundary", /does not include local waves/.test(engine)],
    ["dark-sky truth boundary", /does not claim aurora/i.test(docs)],
    ["graceful API state", /status: "unavailable"/.test(route)],
    ["noindex API", /X-Robots-Tag/.test(route)],
    ["homepage product surface", /Worth noticing now/.test(component)],
    ["opportunity measurement", /opportunity_opened/.test(contract)],
    ["branded/non-branded brief", /Non-branded/.test(brief)],
    ["workflow summary", /GITHUB_STEP_SUMMARY/.test(workflow)],
  ] as const;

  const passed = checks.filter(([, ok]) => ok).length;
  const score = passed * 10;

  console.log(`Live opportunity detection score: ${score}/100`);
  for (const [name, ok] of checks) {
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  }

  if (score < 90) {
    throw new Error(`Live opportunity detection score ${score} is below release target 90.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
