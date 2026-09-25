from pathlib import Path


def replace_expected(path: str, old: str, new: str, expected: int = 1):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != expected:
        raise SystemExit(f"Expected {expected} match(es) in {path}, found {count}: {old[:120]!r}")
    p.write_text(text.replace(old, new, expected))


replace_expected(
    "src/lib/discovery.ts",
    '  source: "OpenStreetMap" | "Michigan Outdoors Now" | "Michigan DNR" | "U.S. Forest Service" | "National Park Service" | "U.S. Fish & Wildlife Service" | "USGS PAD-US";\n',
    '  source: "OpenStreetMap" | "Michigan Outdoors Now" | "Michigan DNR" | "U.S. Forest Service" | "National Park Service" | "U.S. Fish & Wildlife Service" | "USGS PAD-US" | "Huron-Clinton Metroparks" | "Oakland County" | "Kent County";\n',
)

replace_expected(
    "src/lib/authoritative-discovery.ts",
    '} from "./discovery";\n\nconst DNR_OPEN_DATA',
    '} from "./discovery";\nimport {\n  fetchLocalAuthorityDiscoveryPlaces,\n  localAuthorityDiscoverySourceIds,\n} from "./local-authority-discovery";\n\nconst DNR_OPEN_DATA',
)

replace_expected(
    "src/lib/authoritative-discovery.ts",
    '  | (typeof federalDiscoverySourceIds)[number]\n  | (typeof protectedLandDiscoverySourceIds)[number];',
    '  | (typeof federalDiscoverySourceIds)[number]\n  | (typeof protectedLandDiscoverySourceIds)[number]\n  | (typeof localAuthorityDiscoverySourceIds)[number];',
)

replace_expected(
    "src/lib/authoritative-discovery.ts",
    '''  const results = await Promise.all([\n    ...authoritativeDiscoverySources.map((source) => fetchSource(source, args)),\n    fetchNearbyTrailSystems(args),\n    fetchUsfsRecreation(args),\n    fetchUsfsTrailSystems(args),\n    fetchNpsUnits(args),\n    fetchFwsRefuges(args),\n    fetchPadusLocalOpen(args),\n  ]);\n\n  return {\n    places: results.flatMap((result) => result.places),''',
    '''  const [coreResults, localAuthorityResults] = await Promise.all([\n    Promise.all([\n      ...authoritativeDiscoverySources.map((source) => fetchSource(source, args)),\n      fetchNearbyTrailSystems(args),\n      fetchUsfsRecreation(args),\n      fetchUsfsTrailSystems(args),\n      fetchNpsUnits(args),\n      fetchFwsRefuges(args),\n      fetchPadusLocalOpen(args),\n    ]),\n    fetchLocalAuthorityDiscoveryPlaces(args),\n  ]);\n  const results = [...coreResults, ...localAuthorityResults];\n\n  return {\n    places: results.flatMap((result) => result.places),''',
)

replace_expected(
    "src/app/api/discover/route.ts",
    '''  const sourceCredibility = place.curatedPlaceId\n    ? 10\n    : place.source === "Michigan DNR" || place.source === "U.S. Forest Service" || place.source === "National Park Service" || place.source === "U.S. Fish & Wildlife Service" || place.source === "USGS PAD-US"\n      ? 8\n      : 3;''',
    '''  const sourceCredibility = place.curatedPlaceId\n    ? 10\n    : place.source === "Huron-Clinton Metroparks" || place.source === "Oakland County" || place.source === "Kent County"\n      ? 9\n      : place.source === "Michigan DNR" || place.source === "U.S. Forest Service" || place.source === "National Park Service" || place.source === "U.S. Fish & Wildlife Service" || place.source === "USGS PAD-US"\n        ? 8\n        : 3;''',
)

replace_expected(
    "src/app/api/discover/route.ts",
    '''function sourcePriority(place: DiscoveryPlace) {\n  if (place.curatedPlaceId) return 8;\n  if (place.source === "Michigan DNR" || place.source === "U.S. Forest Service" || place.source === "National Park Service" || place.source === "U.S. Fish & Wildlife Service" || place.source === "USGS PAD-US") return 6;\n  if (place.source === "OpenStreetMap") return 1;\n  return 4;\n}''',
    '''function sourcePriority(place: DiscoveryPlace) {\n  if (place.curatedPlaceId) return 8;\n  if (place.source === "Huron-Clinton Metroparks" || place.source === "Oakland County" || place.source === "Kent County") return 7;\n  if (place.source === "Michigan DNR" || place.source === "U.S. Forest Service" || place.source === "National Park Service" || place.source === "U.S. Fish & Wildlife Service" || place.source === "USGS PAD-US") return 6;\n  if (place.source === "OpenStreetMap") return 1;\n  return 4;\n}''',
)

replace_expected(
    "src/app/api/discover/route.ts",
    'USGS PAD-US open-access local/regional/nonprofit protected lands, Michigan Outdoors Now curated places',
    'USGS PAD-US open-access local/regional/nonprofit protected lands, direct Huron-Clinton Metroparks/Oakland County/Kent County GIS, Michigan Outdoors Now curated places',
)

replace_expected(
    "src/app/api/discover/route.ts",
    'authoritative Michigan DNR, U.S. Forest Service, National Park Service, U.S. Fish & Wildlife Service, and USGS PAD-US open-access protected-land inventories.',
    'authoritative Michigan DNR, U.S. Forest Service, National Park Service, U.S. Fish & Wildlife Service, USGS PAD-US open-access protected-land inventories, plus direct Huron-Clinton Metroparks, Oakland County and Kent County GIS.',
    expected=2,
)

print("Local authority discovery wiring applied")
