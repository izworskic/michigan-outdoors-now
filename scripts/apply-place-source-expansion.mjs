import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, content) {
  fs.writeFileSync(path, content);
}

function replaceOnce(content, search, replacement, label) {
  const first = content.indexOf(search);
  if (first < 0) throw new Error(`Patch target not found: ${label}`);
  if (content.indexOf(search, first + search.length) >= 0) {
    throw new Error(`Patch target is not unique: ${label}`);
  }
  return content.slice(0, first) + replacement + content.slice(first + search.length);
}

// 1) Expand the semantic/OSM place vocabulary and allow federal authoritative sources.
{
  const path = "src/lib/discovery.ts";
  let content = read(path);

  content = replaceOnce(
    content,
    '  source: "OpenStreetMap" | "Michigan Outdoors Now" | "Michigan DNR";',
    '  source: "OpenStreetMap" | "Michigan Outdoors Now" | "Michigan DNR" | "U.S. Forest Service" | "National Park Service";',
    "DiscoveryPlace source union",
  );

  content = replaceOnce(
    content,
    '    keywords: ["park", "forest", "woods", "nature", "preserve", "reserve", "wild", "remote", "backcountry"],',
    '    keywords: ["park", "county park", "metropark", "forest", "woods", "nature", "preserve", "reserve", "conservancy", "sanctuary", "wild", "remote", "backcountry"],',
    "park keywords",
  );

  content = replaceOnce(
    content,
    '    selectors: [\'nwr["canoe"="put_in"]\', \'nwr["waterway"="access_point"]\', \'nwr["leisure"="slipway"]\'],\n    keywords: ["paddle", "paddling", "canoe", "kayak", "put in", "put-in", "boat launch"],',
    '    selectors: [\n      \'nwr["canoe"="put_in"]\',\n      \'nwr["waterway"="access_point"]\',\n      \'nwr["leisure"="slipway"]\',\n      \'nwr["leisure"="marina"]\',\n      \'nwr["man_made"="pier"]\',\n      \'nwr["harbour"]\',\n    ],\n    keywords: ["paddle", "paddling", "canoe", "kayak", "put in", "put-in", "boat launch", "river access", "water access", "harbor", "harbour", "marina", "pier", "dock"],',
    "paddling selectors and keywords",
  );

  content = replaceOnce(
    content,
    '    selectors: [\'nwr["leisure"="nature_reserve"]\'],\n    keywords: ["wildlife", "bird", "birding", "birds", "waterfowl", "migration", "refuge"],',
    '    selectors: [\n      \'nwr["leisure"="nature_reserve"]\',\n      \'nwr["leisure"="bird_hide"]\',\n      \'nwr["boundary"="protected_area"]\',\n    ],\n    keywords: ["wildlife", "bird", "birding", "birds", "waterfowl", "migration", "refuge", "sanctuary", "conservancy", "bird hide"],',
    "wildlife selectors and keywords",
  );

  content = replaceOnce(
    content,
    '  ["paddling", ["paddle", "paddling", "canoe", "kayak", "put in", "put-in", "boat launch"]],',
    '  ["paddling", ["paddle", "paddling", "canoe", "kayak", "put in", "put-in", "boat launch", "river access", "water access", "harbor", "harbour", "marina", "pier", "dock"]],',
    "paddling activity rules",
  );

  content = replaceOnce(
    content,
    '  ["birding", ["bird", "birding", "birds", "waterfowl", "migration", "wildlife", "refuge"]],',
    '  ["birding", ["bird", "birding", "birds", "waterfowl", "migration", "wildlife", "refuge", "sanctuary", "conservancy", "bird hide"]],',
    "birding activity rules",
  );

  write(path, content);
}

// 2) Add U.S. Forest Service recreation sites and NPS units to the authoritative pool.
{
  const path = "src/lib/authoritative-discovery.ts";
  let content = read(path);

  content = replaceOnce(
    content,
    'const DNR_TRAILS = "https://gisagoegle.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/FeatureServer/21/query";\n',
    'const DNR_TRAILS = "https://gisagoegle.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/FeatureServer/21/query";\nconst USFS_RECREATION = "https://apps.fs.usda.gov/arcx/rest/services/EDW/EDW_RecreationOpportunities_01/MapServer/0/query";\nconst NPS_BOUNDARIES = "https://services1.arcgis.com/fBc8EJBxQRMcHlei/ArcGIS/rest/services/National_Park_Service_Boundaries/FeatureServer/0/query";\n',
    "federal source constants",
  );

  content = replaceOnce(
    content,
    'export type AuthoritativeSourceId = (typeof authoritativeDiscoverySources)[number]["id"] | "dnr-trails";',
    'export type AuthoritativeSourceId = (typeof authoritativeDiscoverySources)[number]["id"] | "dnr-trails" | "usfs-recreation" | "nps-units";',
    "authoritative source id union",
  );

  const insertionPoint = 'export async function fetchAuthoritativeDiscoveryPlaces(args: {';
  const federalCode = `function safeFederalWebsite(value: unknown) {\n  const raw = cleanText(value, 500);\n  if (!raw) return undefined;\n  try {\n    const parsed = new URL(raw);\n    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : undefined;\n  } catch {\n    return undefined;\n  }\n}\n\nfunction usfsCategory(properties: Record<string, unknown>): DiscoveryCategory {\n  const text = [\n    properties.markeractivity,\n    properties.markeractivitygroup,\n    properties.markertype,\n    properties.recareaname,\n  ]\n    .map((value) => cleanText(value, 160).toLowerCase())\n    .filter(Boolean)\n    .join(" ");\n\n  if (/camp|cabins?|overnight/.test(text)) return "campground";\n  if (/fish|angling/.test(text)) return "fishing";\n  if (/canoe|kayak|boat|paddl|water access|river access|launch/.test(text)) return "paddling";\n  if (/beach|swim/.test(text)) return "beach";\n  if (/bird|wildlife|watchable wildlife/.test(text)) return "wildlife";\n  if (/trail|hiking|backpack|snowshoe|cross.country|ski/.test(text)) return "trailhead";\n  if (/lookout|view|scenic/.test(text)) return "viewpoint";\n  return "park";\n}\n\nasync function fetchUsfsRecreation(args: {\n  originLatitude: number;\n  originLongitude: number;\n  maxDriveHours: number;\n  minDriveHours: number;\n  intent: DiscoveryIntent;\n}) {\n  const params = new URLSearchParams({\n    where: "1=1",\n    outFields: "objectid,recareaid,recareaname,longitude,latitude,recareaurl,forestname,markertype,markeractivity,markeractivitygroup,openstatus,open_season_start,open_season_end",\n    returnGeometry: "true",\n    outSR: "4326",\n    inSR: "4326",\n    geometryType: "esriGeometryEnvelope",\n    spatialRel: "esriSpatialRelIntersects",\n    geometry: envelopeFor(args.originLatitude, args.originLongitude, args.maxDriveHours).join(","),\n    resultRecordCount: "1400",\n    f: "geojson",\n  });\n\n  try {\n    const response = await fetch(\`${USFS_RECREATION}?\${params.toString()}\`, {\n      headers: { Accept: "application/geo+json, application/json" },\n      signal: AbortSignal.timeout(3_400),\n      next: { revalidate: 1800 },\n    });\n    if (!response.ok) throw new Error(\`usfs-recreation returned \${response.status}\`);\n    const payload = (await response.json()) as GeoJsonCollection;\n    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {\n      throw new Error("usfs-recreation returned invalid GeoJSON");\n    }\n\n    const seen = new Set<string>();\n    const places: DiscoveryPlace[] = [];\n    for (const feature of payload.features) {\n      const properties = feature.properties ?? {};\n      const center = featureCenter(feature);\n      const name = cleanText(properties.recareaname, 180);\n      if (!center || !name) continue;\n      if (!isDiscoveryCandidateInRange({\n        latitude: center.latitude,\n        longitude: center.longitude,\n        originLatitude: args.originLatitude,\n        originLongitude: args.originLongitude,\n        maxDriveHours: args.maxDriveHours,\n      })) continue;\n\n      const openStatus = cleanText(properties.openstatus, 80);\n      if (/^closed$/i.test(openStatus) || /temporarily closed/i.test(openStatus)) continue;\n\n      const category = usfsCategory(properties);\n      const website = safeFederalWebsite(properties.recareaurl);\n      const metrics = scoreDiscoveryCandidate({\n        latitude: center.latitude,\n        longitude: center.longitude,\n        originLatitude: args.originLatitude,\n        originLongitude: args.originLongitude,\n        maxDriveHours: args.maxDriveHours,\n        category,\n        intent: args.intent,\n        name,\n        website,\n      });\n      if (metrics.driveHours + 0.05 < args.minDriveHours) continue;\n\n      const key = normalized(name);\n      if (!key || seen.has(key)) continue;\n      seen.add(key);\n\n      const forest = cleanText(properties.forestname, 140) || "U.S. Forest Service";\n      const recAreaId = typeof properties.recareaid === "number"\n        ? String(properties.recareaid)\n        : cleanText(properties.recareaid, 60);\n      const objectId = typeof properties.objectid === "number"\n        ? String(properties.objectid)\n        : cleanText(properties.objectid, 60);\n      const statusNote = openStatus ? \` Source status: \${openStatus}.\` : "";\n\n      places.push({\n        id: \`usfs:\${recAreaId || objectId || sourceKey(name)}\`,\n        name,\n        area: forest,\n        latitude: center.latitude,\n        longitude: center.longitude,\n        category,\n        categoryLabel: categoryLabel(category),\n        distanceMiles: metrics.distanceMiles,\n        driveHours: metrics.driveHours,\n        score: Math.min(99, metrics.score + 7),\n        why: \`U.S. Forest Service recreation data places this \${categoryLabel(category).toLowerCase()} in \${forest}.\${statusNote}\`,\n        source: "U.S. Forest Service",\n        sourceUrl: USFS_RECREATION.replace(/\\/query$/, ""),\n        directionsUrl: \`https://www.google.com/maps/dir/?api=1&destination=\${center.latitude.toFixed(6)},\${center.longitude.toFixed(6)}\`,\n        ...(website ? { website } : {}),\n      });\n    }\n\n    return { id: "usfs-recreation" as const, label: "U.S. Forest Service recreation sites", status: "live" as const, places };\n  } catch {\n    return { id: "usfs-recreation" as const, label: "U.S. Forest Service recreation sites", status: "unavailable" as const, places: [] as DiscoveryPlace[] };\n  }\n}\n\nasync function fetchNpsUnits(args: {\n  originLatitude: number;\n  originLongitude: number;\n  maxDriveHours: number;\n  minDriveHours: number;\n  intent: DiscoveryIntent;\n}) {\n  const params = new URLSearchParams({\n    where: "STATE='MI'",\n    outFields: "FID,UNIT_CODE,UNIT_NAME,STATE,UNIT_TYPE,PARKNAME",\n    returnGeometry: "true",\n    outSR: "4326",\n    inSR: "4326",\n    geometryType: "esriGeometryEnvelope",\n    spatialRel: "esriSpatialRelIntersects",\n    geometry: envelopeFor(args.originLatitude, args.originLongitude, args.maxDriveHours).join(","),\n    resultRecordCount: "250",\n    f: "geojson",\n  });\n\n  try {\n    const response = await fetch(\`${NPS_BOUNDARIES}?\${params.toString()}\`, {\n      headers: { Accept: "application/geo+json, application/json" },\n      signal: AbortSignal.timeout(3_400),\n      next: { revalidate: 21600 },\n    });\n    if (!response.ok) throw new Error(\`nps-units returned \${response.status}\`);\n    const payload = (await response.json()) as GeoJsonCollection;\n    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {\n      throw new Error("nps-units returned invalid GeoJSON");\n    }\n\n    const seen = new Set<string>();\n    const places: DiscoveryPlace[] = [];\n    for (const feature of payload.features) {\n      const properties = feature.properties ?? {};\n      const center = featureCenter(feature);\n      const name = cleanText(properties.UNIT_NAME ?? properties.PARKNAME, 180);\n      if (!center || !name) continue;\n      if (!isDiscoveryCandidateInRange({\n        latitude: center.latitude,\n        longitude: center.longitude,\n        originLatitude: args.originLatitude,\n        originLongitude: args.originLongitude,\n        maxDriveHours: args.maxDriveHours,\n      })) continue;\n\n      const category: DiscoveryCategory = "park";\n      const unitCode = cleanText(properties.UNIT_CODE, 20).toLowerCase();\n      const website = /^[a-z0-9]{4,8}$/.test(unitCode)\n        ? \`https://www.nps.gov/\${unitCode}/index.htm\`\n        : "https://www.nps.gov/state/mi/index.htm";\n      const metrics = scoreDiscoveryCandidate({\n        latitude: center.latitude,\n        longitude: center.longitude,\n        originLatitude: args.originLatitude,\n        originLongitude: args.originLongitude,\n        maxDriveHours: args.maxDriveHours,\n        category,\n        intent: args.intent,\n        name,\n        website,\n      });\n      if (metrics.driveHours + 0.05 < args.minDriveHours) continue;\n\n      const key = normalized(name);\n      if (!key || seen.has(key)) continue;\n      seen.add(key);\n\n      const unitType = cleanText(properties.UNIT_TYPE, 100) || "National Park Service";\n      const fid = typeof properties.FID === "number" ? String(properties.FID) : cleanText(properties.FID, 40);\n      places.push({\n        id: \`nps:\${unitCode || fid || sourceKey(name)}\`,\n        name,\n        area: unitType,\n        latitude: center.latitude,\n        longitude: center.longitude,\n        category,\n        categoryLabel: categoryLabel(category),\n        distanceMiles: metrics.distanceMiles,\n        driveHours: metrics.driveHours,\n        score: Math.min(99, metrics.score + 7),\n        why: \`National Park Service boundary data places this federal outdoor unit inside the requested Michigan travel range.\`,\n        source: "National Park Service",\n        sourceUrl: NPS_BOUNDARIES.replace(/\\/query$/, ""),\n        directionsUrl: \`https://www.google.com/maps/dir/?api=1&destination=\${center.latitude.toFixed(6)},\${center.longitude.toFixed(6)}\`,\n        website,\n      });\n    }\n\n    return { id: "nps-units" as const, label: "National Park Service units", status: "live" as const, places };\n  } catch {\n    return { id: "nps-units" as const, label: "National Park Service units", status: "unavailable" as const, places: [] as DiscoveryPlace[] };\n  }\n}\n\n`;

  content = replaceOnce(
    content,
    insertionPoint,
    federalCode + insertionPoint,
    "federal adapter insertion",
  );

  content = replaceOnce(
    content,
    '  const results = await Promise.all([\n    ...authoritativeDiscoverySources.map((source) => fetchSource(source, args)),\n    fetchNearbyTrailSystems(args),\n  ]);',
    '  const results = await Promise.all([\n    ...authoritativeDiscoverySources.map((source) => fetchSource(source, args)),\n    fetchNearbyTrailSystems(args),\n    fetchUsfsRecreation(args),\n    fetchNpsUnits(args),\n  ]);',
    "authoritative source fanout",
  );

  write(path, content);
}

// 3) Use authoritative inventory on ordinary searches too and rank federal sources as trusted.
{
  const path = "src/app/api/discover/route.ts";
  let content = read(path);

  content = replaceOnce(
    content,
    '  const sourceCredibility = place.curatedPlaceId ? 10 : place.source === "Michigan DNR" ? 8 : 3;',
    '  const sourceCredibility = place.curatedPlaceId\n    ? 10\n    : place.source === "Michigan DNR" || place.source === "U.S. Forest Service" || place.source === "National Park Service"\n      ? 8\n      : 3;',
    "surprise source credibility",
  );

  content = replaceOnce(
    content,
    '  if (place.source === "Michigan DNR") return 6;\n  if (place.source === "OpenStreetMap") return 1;',
    '  if (place.source === "Michigan DNR" || place.source === "U.S. Forest Service" || place.source === "National Park Service") return 6;\n  if (place.source === "OpenStreetMap") return 1;',
    "source priority",
  );

  content = replaceOnce(
    content,
    '    regional && !strictPreferenceMode\n      ? fetchAuthoritativeDiscoveryPlaces({',
    '    !strictPreferenceMode\n      ? fetchAuthoritativeDiscoveryPlaces({',
    "authoritative ordinary search gate",
  );

  content = replaceOnce(
    content,
    '        ? `Regional discovery blends Michigan DNR parks, wildlife lands, campgrounds, boating/fishing access and trail systems with Michigan Outdoors Now curated places and time-bounded OpenStreetMap enrichment. It returns a broad deterministic candidate set before downstream tools apply live-condition and safety gates. ${routedTravel.size ? "The leading candidates include best-effort routed driving times; remaining places retain planning estimates." : "Drive times remain planning estimates."}`\n        : elements\n          ? `Fast OpenStreetMap enrichment is blended with Michigan Outdoors Now curated destinations. ${routedTravel.size ? "Top results include best-effort routed driving times from OSRM; unrouted places fall back to planning estimates." : "Routing did not answer inside the fast budget, so drive times remain planning estimates."}`\n          : `Results are from the curated Michigan Outdoors Now destination set. External place enrichment did not answer inside the fast-search budget. ${routedTravel.size ? "Top results include best-effort routed driving times from OSRM." : "Drive times remain planning estimates."}`,',
    '        ? `Regional discovery blends Michigan DNR parks, wildlife lands, campgrounds, boating/fishing access and trail systems, U.S. Forest Service recreation sites, National Park Service units, Michigan Outdoors Now curated places, and time-bounded OpenStreetMap enrichment. It returns a broad deterministic candidate set before live-condition and safety gates. ${routedTravel.size ? "The leading candidates include best-effort routed driving times; remaining places retain planning estimates." : "Drive times remain planning estimates."}`\n        : elements\n          ? `Fast OpenStreetMap enrichment is blended with Michigan Outdoors Now plus authoritative Michigan DNR, U.S. Forest Service, and National Park Service inventories. ${routedTravel.size ? "Top results include best-effort routed driving times from OSRM; unrouted places fall back to planning estimates." : "Routing did not answer inside the fast budget, so drive times remain planning estimates."}`\n          : authoritativeLive\n            ? `Results blend Michigan Outdoors Now with authoritative Michigan DNR, U.S. Forest Service, and National Park Service inventories. OpenStreetMap enrichment did not answer inside the fast-search budget. ${routedTravel.size ? "Top results include best-effort routed driving times from OSRM." : "Drive times remain planning estimates."}`\n            : `Results are from the curated Michigan Outdoors Now destination set. External place enrichment did not answer inside the fast-search budget. ${routedTravel.size ? "Top results include best-effort routed driving times from OSRM." : "Drive times remain planning estimates."}`,',
    "source note",
  );

  write(path, content);
}

// 4) Strengthen tests for the newly covered mapped place families.
{
  const path = "tests/authoritative-discovery.test.ts";
  let content = read(path);

  content = replaceOnce(
    content,
    '  assert.match(joined, /lighthouse/);\n  assert.ok(selectors.every((selector) => selector.startsWith("nwr[")));',
    '  assert.match(joined, /lighthouse/);\n  assert.match(joined, /marina/);\n  assert.match(joined, /man_made.*pier/);\n  assert.match(joined, /harbour/);\n  assert.match(joined, /bird_hide/);\n  assert.ok(selectors.every((selector) => selector.startsWith("nwr[")));',
    "regional selector coverage assertions",
  );

  content = replaceOnce(
    content,
    '  assert.equal(categoryFromTags({ leisure: "slipway" }), "paddling");\n  assert.equal(categoryFromTags({ sport: "fishing" }), "fishing");',
    '  assert.equal(categoryFromTags({ leisure: "slipway" }), "paddling");\n  assert.equal(categoryFromTags({ leisure: "marina" }), "paddling");\n  assert.equal(categoryFromTags({ man_made: "pier" }), "paddling");\n  assert.equal(categoryFromTags({ leisure: "bird_hide" }), "wildlife");\n  assert.equal(categoryFromTags({ sport: "fishing" }), "fishing");',
    "mapped tag classification assertions",
  );

  write(path, content);
}

console.log("Applied Michigan outdoor location source expansion.");
