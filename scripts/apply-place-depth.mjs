import fs from "node:fs";

function replaceOnce(text, needle, replacement, label) {
  const first = text.indexOf(needle);
  if (first < 0) throw new Error(`Missing patch anchor: ${label}`);
  if (text.indexOf(needle, first + needle.length) >= 0) {
    throw new Error(`Patch anchor is not unique: ${label}`);
  }
  return text.slice(0, first) + replacement + text.slice(first + needle.length);
}

const componentPath = "src/components/outdoor-intent-hub.tsx";
let component = fs.readFileSync(componentPath, "utf8");
component = replaceOnce(
  component,
  'import { MyOutdoorsDrawer } from "./my-outdoors-drawer";',
  'import { MyOutdoorsDrawer } from "./my-outdoors-drawer";\nimport { PlaceDepthPanel } from "./place-depth-panel";',
  "PlaceDepthPanel import",
);
component = replaceOnce(
  component,
  '              </section>\n\n              <div className="canvas-sheet-actions">',
  `              </section>\n\n              <PlaceDepthPanel\n                place={activeDiscovery}\n                discoveryPlaces={discovery?.places ?? []}\n                boatLaunches={boatLaunches}\n                onOpenDiscovery={activateDiscovery}\n                onFocusPoint={(point) =>\n                  setFocusPoint({\n                    key: \`place-depth-\${point.key}-\${Date.now()}\`,\n                    latitude: point.latitude,\n                    longitude: point.longitude,\n                    zoom: point.zoom ?? 12.2,\n                  })\n                }\n              />\n\n              <div className="canvas-sheet-actions">`,
  "selected-place depth panel",
);
fs.writeFileSync(componentPath, component);

const runtimePath = "scripts/runtime-check.mjs";
let runtime = fs.readFileSync(runtimePath, "utf8");
runtime = replaceOnce(
  runtime,
  '  const dayPlanResponse = await fetch(`${origin}/api/day-plan`, {',
  `  const placeDepthStarted = performance.now();\n  const placeDepthResponse = await fetch(\`\${origin}/api/place-depth\`, {\n    method: "POST",\n    headers: { "Content-Type": "application/json" },\n    body: JSON.stringify({\n      latitude: confidenceTarget.latitude,\n      longitude: confidenceTarget.longitude,\n      placeName: confidenceTarget.name,\n    }),\n    signal: AbortSignal.timeout(5_000),\n  });\n  const placeDepthElapsed = performance.now() - placeDepthStarted;\n  assert.equal(placeDepthResponse.status, 200);\n  assert.ok(placeDepthElapsed <= 4_000, \`place depth exceeded 4 second enrichment budget: \${Math.round(placeDepthElapsed)}ms\`);\n  assert.match(placeDepthResponse.headers.get("cache-control") ?? "", /no-store/);\n  assert.match(placeDepthResponse.headers.get("x-robots-tag") ?? "", /noindex/);\n  const placeDepthPayload = await placeDepthResponse.json();\n  assert.ok(["live", "unavailable"].includes(placeDepthPayload.status));\n  assert.ok(Array.isArray(placeDepthPayload.points));\n\n  const dayPlanResponse = await fetch(\`\${origin}/api/day-plan\`, {`,
  "place-depth runtime check",
);
fs.writeFileSync(runtimePath, runtime);

const cssPath = "src/app/atlas.css";
let css = fs.readFileSync(cssPath, "utf8");
const cssMarker = "/* Selected-place depth: exact ways in, water access, viewpoints and companion stops. */";
if (!css.includes(cssMarker)) {
  css += `\n\n${cssMarker}\n.canvas-place-depth{\n  display:grid;\n  gap:12px;\n  margin-top:18px;\n  padding-top:18px;\n  border-top:1px solid rgba(31,61,69,.13);\n}\n.canvas-place-depth-head{display:grid;gap:4px}\n.canvas-place-depth-head>span,\n.canvas-place-depth-group>span{\n  color:#728186;\n  font-size:8px;\n  font-weight:850;\n  letter-spacing:.08em;\n  text-transform:uppercase;\n}\n.canvas-place-depth-head>strong{font:500 19px/1.08 Georgia,serif}\n.canvas-place-depth-head>small{color:#63767b;font-size:8px;line-height:1.45}\n.canvas-place-depth-groups{display:grid;gap:14px}\n.canvas-place-depth-group{display:grid;gap:6px}\n.canvas-place-depth-group article{\n  display:grid;\n  grid-template-columns:minmax(0,1fr) auto;\n  gap:10px;\n  align-items:center;\n  padding:9px 0;\n  border-top:1px solid rgba(31,61,69,.10);\n}\n.canvas-place-depth-group article>div:first-child{display:grid;gap:3px;min-width:0}\n.canvas-place-depth-group article strong{font-size:10px;line-height:1.3}\n.canvas-place-depth-group article small{color:#6d7e82;font-size:8px;line-height:1.4}\n.canvas-place-depth-actions{display:flex;gap:4px;align-items:center}\n.canvas-place-depth-actions button,\n.canvas-place-depth-actions a{\n  min-height:34px;\n  display:inline-flex;\n  align-items:center;\n  justify-content:center;\n  padding:5px 8px;\n  border:1px solid rgba(31,61,69,.14);\n  border-radius:7px;\n  background:#fff;\n  color:#193d48;\n  font-size:8px;\n  font-weight:800;\n  text-decoration:none;\n  cursor:pointer;\n}\n.canvas-place-depth-source{margin:0;color:#78878b;font-size:7px;line-height:1.45}\n@media(max-width:700px){\n  .canvas-place-depth-group article{grid-template-columns:1fr}\n  .canvas-place-depth-actions{justify-content:flex-start}\n  .canvas-place-depth-actions button,\n  .canvas-place-depth-actions a{min-height:40px}\n}\n`;
  fs.writeFileSync(cssPath, css);
}
