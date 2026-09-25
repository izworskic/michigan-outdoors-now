from pathlib import Path

p = Path("src/lib/discovery.ts")
s = p.read_text()
old = 'source: "OpenStreetMap" | "Michigan Outdoors Now" | "Michigan DNR" | "U.S. Forest Service" | "National Park Service" | "U.S. Fish & Wildlife Service";'
new = 'source: "OpenStreetMap" | "Michigan Outdoors Now" | "Michigan DNR" | "U.S. Forest Service" | "National Park Service" | "U.S. Fish & Wildlife Service" | "USGS PAD-US";'
if old not in s:
    raise SystemExit("DiscoveryPlace source union anchor missing")
s = s.replace(old, new, 1)
p.write_text(s)

p = Path("src/lib/authoritative-discovery.ts")
s = p.read_text()
const_anchor = 'const FWS_BOUNDARIES = "https://services.arcgis.com/QVENGdaPbd4LUkLV/arcgis/rest/services/National_Wildlife_Refuge_System_Boundaries/FeatureServer/0/query";'
const_replacement = const_anchor + '\nconst PADUS_LOCAL_OPEN = "https://services.arcgis.com/v01gqwM5QqNysAAi/arcgis/rest/services/Manager_Type_PADUS/FeatureServer/0/query";'
if const_anchor not in s:
    raise SystemExit("PAD-US constant anchor missing")
s = s.replace(const_anchor, const_replacement, 1)

ids_anchor = 'export const federalDiscoverySourceIds = ["usfs-recreation", "usfs-trails", "nps-units", "fws-refuges"] as const;\n\nexport type AuthoritativeSourceId = (typeof authoritativeDiscoverySources)[number]["id"] | "dnr-trails" | (typeof federalDiscoverySourceIds)[number];'
ids_replacement = '''export const federalDiscoverySourceIds = ["usfs-recreation", "usfs-trails", "nps-units", "fws-refuges"] as const;
export const protectedLandDiscoverySourceIds = ["padus-local-open"] as const;
export const padusLocalOpenWhere = "State_Nm='MI' AND Mang_Type IN ('LOC','DIST','NGO') AND Pub_Access='OA' AND FeatClass='Fee'";

export type AuthoritativeSourceId =
  | (typeof authoritativeDiscoverySources)[number]["id"]
  | "dnr-trails"
  | (typeof federalDiscoverySourceIds)[number]
  | (typeof protectedLandDiscoverySourceIds)[number];'''
if ids_anchor not in s:
    raise SystemExit("source id anchor missing")
s = s.replace(ids_anchor, ids_replacement, 1)

insert_anchor = 'async function fetchNpsUnits(args: {'
if insert_anchor not in s:
    raise SystemExit("NPS insertion anchor missing")

padus_functions = r'''function padusCategory(properties: Record<string, unknown>): DiscoveryCategory {
  const text = [
    properties.Unit_Nm,
    properties.Loc_Nm,
    properties.Des_Tp,
    properties.Loc_Ds,
    properties.Loc_Mang,
    properties.Mang_Name,
  ]
    .map((value) => cleanText(value, 180).toLowerCase())
    .filter(Boolean)
    .join(" ");

  if (/beach|swim|shore|waterfront/.test(text)) return "beach";
  if (/campground|camping|camp\b/.test(text)) return "campground";
  if (/trail|greenway|pathway/.test(text)) return "trailhead";
  if (/wildlife|refuge|sanctuary|nature|natural area|preserve|conservation|wetland|marsh|bog|fen|prairie/.test(text)) return "wildlife";
  return "park";
}

function padusManagerLabel(properties: Record<string, unknown>) {
  const localManager = cleanText(properties.Loc_Mang, 120);
  const standardManager = cleanText(properties.Mang_Name, 120);
  const localOwner = cleanText(properties.Loc_Own, 120);
  if (localManager) return localManager;
  if (standardManager && !/^unknown$/i.test(standardManager)) return standardManager;
  if (localOwner) return localOwner;
  const type = cleanText(properties.Mang_Type, 20).toUpperCase();
  if (type === "LOC") return "Local government";
  if (type === "DIST") return "Regional agency / special district";
  if (type === "NGO") return "Nonprofit conservation organization";
  return "Local or nonprofit protected land";
}

async function fetchPadusLocalOpen(args: {
  originLatitude: number;
  originLongitude: number;
  maxDriveHours: number;
  minDriveHours: number;
  intent: DiscoveryIntent;
}) {
  const params = new URLSearchParams({
    where: padusLocalOpenWhere,
    outFields: "OBJECTID,Unit_Nm,Loc_Nm,Loc_Mang,Loc_Own,Mang_Type,Mang_Name,Pub_Access,Access_Src,GIS_Acres,Des_Tp,Loc_Ds,State_Nm,FeatClass",
    returnGeometry: "true",
    outSR: "4326",
    inSR: "4326",
    geometryType: "esriGeometryEnvelope",
    spatialRel: "esriSpatialRelIntersects",
    geometry: envelopeFor(args.originLatitude, args.originLongitude, args.maxDriveHours).join(","),
    resultRecordCount: "1000",
    f: "geojson",
  });

  try {
    const response = await fetch(`${PADUS_LOCAL_OPEN}?${params.toString()}`, {
      headers: { Accept: "application/geo+json, application/json" },
      signal: AbortSignal.timeout(1_250),
      next: { revalidate: 21600 },
    });
    if (!response.ok) throw new Error(`padus-local-open returned ${response.status}`);
    const payload = (await response.json()) as GeoJsonCollection;
    if (payload.type !== "FeatureCollection" || !Array.isArray(payload.features)) {
      throw new Error("padus-local-open returned invalid GeoJSON");
    }

    const seen = new Set<string>();
    const places: DiscoveryPlace[] = [];
    for (const feature of payload.features) {
      const properties = feature.properties ?? {};
      const center = featureCenter(feature);
      const name = cleanText(properties.Unit_Nm ?? properties.Loc_Nm, 180);
      const publicAccess = cleanText(properties.Pub_Access, 20).toUpperCase();
      const featureClass = cleanText(properties.FeatClass, 20).toLowerCase();
      const managerType = cleanText(properties.Mang_Type, 20).toUpperCase();
      if (!center || !name || /^(unknown|n\/a|none)$/i.test(name)) continue;
      if (publicAccess !== "OA" || featureClass !== "fee") continue;
      if (!["LOC", "DIST", "NGO"].includes(managerType)) continue;
      if (!isDiscoveryCandidateInRange({
        latitude: center.latitude,
        longitude: center.longitude,
        originLatitude: args.originLatitude,
        originLongitude: args.originLongitude,
        maxDriveHours: args.maxDriveHours,
      })) continue;

      const key = normalized(name);
      if (!key || seen.has(key)) continue;

      const category = padusCategory(properties);
      const metrics = scoreDiscoveryCandidate({
        latitude: center.latitude,
        longitude: center.longitude,
        originLatitude: args.originLatitude,
        originLongitude: args.originLongitude,
        maxDriveHours: args.maxDriveHours,
        category,
        intent: args.intent,
        name,
        website: "https://www.usgs.gov/programs/gap-analysis-project/science/protected-areas",
      });
      if (metrics.driveHours + 0.05 < args.minDriveHours) continue;
      seen.add(key);

      const manager = padusManagerLabel(properties);
      const acresRaw = properties.GIS_Acres;
      const acres = typeof acresRaw === "number" && Number.isFinite(acresRaw) && acresRaw > 0
        ? Math.round(acresRaw)
        : null;
      const acreageNote = acres ? ` PAD-US maps about ${acres.toLocaleString("en-US")} acres.` : "";
      const objectId = typeof properties.OBJECTID === "number"
        ? String(properties.OBJECTID)
        : cleanText(properties.OBJECTID, 40);

      places.push({
        id: `padus:${objectId || sourceKey(name)}`,
        name,
        area: manager,
        latitude: center.latitude,
        longitude: center.longitude,
        category,
        categoryLabel: categoryLabel(category),
        distanceMiles: metrics.distanceMiles,
        driveHours: metrics.driveHours,
        score: Math.min(99, metrics.score + 5),
        why: `USGS PAD-US 4.1 identifies this as fee-owned, open-access protected land managed by ${manager}.${acreageNote} Local hours, entrances and rules still need a current check before visiting.`,
        source: "USGS PAD-US",
        sourceUrl: PADUS_LOCAL_OPEN.replace(/\/query$/, ""),
        directionsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`,
        website: "https://www.usgs.gov/programs/gap-analysis-project/science/protected-areas",
      });
    }

    return {
      id: "padus-local-open" as const,
      label: "USGS PAD-US local, regional and nonprofit open-access protected lands",
      status: "live" as const,
      places,
    };
  } catch {
    return {
      id: "padus-local-open" as const,
      label: "USGS PAD-US local, regional and nonprofit open-access protected lands",
      status: "unavailable" as const,
      places: [] as DiscoveryPlace[],
    };
  }
}

'''
s = s.replace(insert_anchor, padus_functions + insert_anchor, 1)

promise_anchor = '    fetchFwsRefuges(args),\n  ]);'
if promise_anchor not in s:
    raise SystemExit("authoritative Promise.all anchor missing")
s = s.replace(promise_anchor, '    fetchFwsRefuges(args),\n    fetchPadusLocalOpen(args),\n  ]);', 1)
p.write_text(s)

p = Path("src/app/api/discover/route.ts")
s = p.read_text()
s = s.replace(
    'place.source === "Michigan DNR" || place.source === "U.S. Forest Service" || place.source === "National Park Service" || place.source === "U.S. Fish & Wildlife Service"',
    'place.source === "Michigan DNR" || place.source === "U.S. Forest Service" || place.source === "National Park Service" || place.source === "U.S. Fish & Wildlife Service" || place.source === "USGS PAD-US"',
)
s = s.replace(
    'U.S. Fish & Wildlife Service refuges/conservation areas, Michigan Outdoors Now curated places',
    'U.S. Fish & Wildlife Service refuges/conservation areas, USGS PAD-US open-access local/regional/nonprofit protected lands, Michigan Outdoors Now curated places',
)
s = s.replace(
    'authoritative Michigan DNR, U.S. Forest Service, National Park Service, and U.S. Fish & Wildlife Service inventories',
    'authoritative Michigan DNR, U.S. Forest Service, National Park Service, U.S. Fish & Wildlife Service, and USGS PAD-US open-access protected-land inventories',
)
p.write_text(s)

p = Path("tests/authoritative-discovery.test.ts")
s = p.read_text()
s = s.replace(
    '  federalDiscoverySourceIds,\n} from "../src/lib/authoritative-discovery";',
    '  federalDiscoverySourceIds,\n  padusLocalOpenWhere,\n  protectedLandDiscoverySourceIds,\n} from "../src/lib/authoritative-discovery";',
)
s += '''

test("PAD-US expansion is limited to visitable local/regional/nonprofit fee lands", () => {
  const ids = new Set(protectedLandDiscoverySourceIds);
  assert.ok(ids.has("padus-local-open"));
  assert.match(padusLocalOpenWhere, /State_Nm='MI'/);
  assert.match(padusLocalOpenWhere, /Mang_Type IN \('LOC','DIST','NGO'\)/);
  assert.match(padusLocalOpenWhere, /Pub_Access='OA'/);
  assert.match(padusLocalOpenWhere, /FeatClass='Fee'/);
  assert.doesNotMatch(padusLocalOpenWhere, /PVT/);
  assert.doesNotMatch(padusLocalOpenWhere, /Easement/);
});
'''
p.write_text(s)
