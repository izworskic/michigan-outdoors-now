import { readFile } from "node:fs/promises";
import process from "node:process";

async function main() {
  const root = new URL("../", import.meta.url);
  const benchmark = JSON.parse(await readFile(new URL("benchmarks/interface-loss.json", root), "utf8"));
  const paths = [
    "src/app/explore/page.tsx",
    "src/components/destination-explorer.tsx",
    "src/components/michigan-destination-map.tsx",
    "src/app/globals.css",
    "src/lib/outdoor-universe.ts",
  ];
  const files = Object.fromEntries(
    await Promise.all(paths.map(async (path) => [path, await readFile(new URL(path, root), "utf8")])),
  );
  const page = files["src/app/explore/page.tsx"];
  const explorer = files["src/components/destination-explorer.tsx"];
  const map = files["src/components/michigan-destination-map.tsx"];
  const css = files["src/app/globals.css"];
  const universe = files["src/lib/outdoor-universe.ts"];

  const penalties: Array<{ key: string; max: number; loss: number; reason: string }> = [];

  const destinationIndex = page.indexOf("<DestinationExplorer");
  const coverageIndex = page.indexOf("universe-coverage");
  const explainerIndex = page.indexOf("universe-explainer");
  const contentBeforeTool = [coverageIndex, explainerIndex].some((index) => index >= 0 && index < destinationIndex);
  penalties.push({
    key: "actionLatency",
    max: 20,
    loss: contentBeforeTool ? 20 : page.includes("explore-command-head") ? 0 : 8,
    reason: contentBeforeTool ? "explanatory/content blocks precede the primary tool" : "primary tool appears before supporting content",
  });

  const visibleLayerButtons = explorer.includes("universeLayerIds.map") && explorer.includes("universe-layer-picker");
  const visibleFilterGrid = explorer.includes("explorer-primary-filters");
  penalties.push({
    key: "controlEntropy",
    max: 15,
    loss: visibleLayerButtons && visibleFilterGrid ? 15 : visibleLayerButtons || visibleFilterGrid ? 7 : 0,
    reason: visibleLayerButtons && visibleFilterGrid ? "layer choices and advanced filters compete at the same hierarchy" : "primary controls are consolidated",
  });

  const permanentSplit = css.includes(".universe-workspace {\n  grid-template-columns:");
  const viewportMap = /height:\s*(?:min\()?\s*7\dvh|height:\s*calc\(100dvh/.test(css);
  penalties.push({
    key: "mapCompetition",
    max: 15,
    loss: permanentSplit ? 15 : viewportMap ? 0 : 6,
    reason: permanentSplit ? "permanent desktop rail shrinks the map" : "map owns the primary viewport",
  });

  const drawerClosedByDefault = explorer.includes('const [browseOpen, setBrowseOpen] = useState(false)') &&
    css.includes(".universe-drawer[data-open=\"false\"]");
  penalties.push({
    key: "progressiveDisclosure",
    max: 15,
    loss: drawerClosedByDefault ? 0 : explorer.includes("universe-discovery-rail") ? 15 : 6,
    reason: drawerClosedByDefault ? "supporting results stay hidden until requested" : "supporting content is persistently exposed",
  });

  const cardNoise = page.includes("universe-coverage-grid") || page.includes("universe-explainer-grid");
  penalties.push({
    key: "hierarchyNoise",
    max: 10,
    loss: cardNoise ? 10 : 0,
    reason: cardNoise ? "repetitive informational card grids compete with the map" : "supporting explanation is visually subordinate",
  });

  const mutuallyExclusiveViews = explorer.includes('mobileView') && explorer.includes('data-mobile-view');
  const mobileDrawer = css.includes("@media (max-width: 700px)") && css.includes(".universe-drawer");
  penalties.push({
    key: "ergonomics",
    max: 10,
    loss: mutuallyExclusiveViews ? 10 : mobileDrawer ? 0 : 4,
    reason: mutuallyExclusiveViews ? "mobile requires a map/list mode switch" : "mobile keeps the map and uses a contextual drawer",
  });

  const hasClosures = universe.includes("DNR_TRAIL_CLOSURES_SERVICE") &&
    map.includes("official-dnr-closures") &&
    map.includes("official-dnr-reroutes");
  penalties.push({
    key: "safetyAccess",
    max: 10,
    loss: hasClosures ? 0 : 10,
    reason: hasClosures ? "closure and reroute overlays are part of the primary map" : "current DNR access changes are absent from the map",
  });

  const localTrust = explorer.includes("Source: Michigan DNR") &&
    explorer.includes("Updated") &&
    explorer.includes("closureCount");
  penalties.push({
    key: "trustDistance",
    max: 5,
    loss: localTrust ? 0 : 5,
    reason: localTrust ? "source, freshness, and access state sit with the map" : "source/freshness is separated from the primary view",
  });

  const loss = penalties.reduce((sum, item) => sum + item.loss, 0);
  const fatal: string[] = [];
  const allSource = page + explorer + map;
  if (/result-map-number|textContent\s*=\s*String\(index\s*\+\s*1\)|numbered pins/.test(allSource)) fatal.push("arbitrary numbered map markers");
  if (permanentSplit) fatal.push("permanent map/list split");
  if (contentBeforeTool) fatal.push("content before first primary interaction");
  if (universe.includes("closures") && !map.includes("official-dnr-closures")) fatal.push("returned closures not represented on map");
  if (mutuallyExclusiveViews) fatal.push("mobile map/list mode switching");

  console.log(JSON.stringify({
    benchmark: "interface-loss",
    direction: "lower-is-better",
    baselineLoss: benchmark.baselineLoss,
    loss,
    releaseTarget: benchmark.releaseTarget,
    flagshipTarget: benchmark.flagshipTarget,
    deltaFromBaseline: loss - benchmark.baselineLoss,
    penalties,
    fatal,
  }, null, 2));

  if (loss > benchmark.releaseTarget || fatal.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
