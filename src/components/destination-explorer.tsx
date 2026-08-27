"use client";

import { track } from "@vercel/analytics";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { destinations } from "../data/destinations";
import {
  destinationRegion,
  filterDestinations,
  regionIds,
  regionLabels,
  type RegionId,
} from "../lib/destination-content";
import {
  universeLayerIds,
  universeLayerLabels,
  type OutdoorUniverseResponse,
  type UniverseLayerId,
} from "../lib/outdoor-universe";
import { activityLabels, haversineMiles, isPlausibleMichiganCoordinate } from "../lib/planner";
import { activityIds, type ActivityId } from "../lib/types";
import { MichiganDestinationMap } from "./michigan-destination-map";

type LocationPoint = {
  latitude: number;
  longitude: number;
};

function safeTrack(name: string, properties?: Record<string, string | number | boolean>) {
  try {
    track(name, properties);
  } catch {
    // The explorer remains usable when analytics are blocked.
  }
}

function emptyUniverse(layer: UniverseLayerId): OutdoorUniverseResponse {
  return {
    layer,
    label: universeLayerLabels[layer],
    status: "unavailable",
    fetchedAt: "",
    source: {
      name: "Michigan DNR Trails Open Data",
      url: "https://gisagoegle.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/FeatureServer/layers",
      authority: "Michigan Department of Natural Resources",
    },
    featureCount: 0,
    systemCount: 0,
    miles: 0,
    partial: false,
    pagesFetched: 0,
    geojson: { type: "FeatureCollection", features: [] },
    systems: [],
    access: {
      status: "unavailable",
      closureCount: 0,
      rerouteCount: 0,
      closures: { type: "FeatureCollection", features: [] },
      reroutes: { type: "FeatureCollection", features: [] },
      partial: false,
      note: "Loading DNR access data.",
    },
    note: "Loading the official DNR trail layer.",
  };
}

function updatedLabel(iso: string) {
  if (!iso) return "updating";
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function DestinationExplorer() {
  const [query, setQuery] = useState("");
  const [activity, setActivity] = useState<ActivityId | "all">("all");
  const [region, setRegion] = useState<RegionId | "all">("all");
  const [kids, setKids] = useState(false);
  const [dog, setDog] = useState(false);
  const [accessible, setAccessible] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [location, setLocation] = useState<LocationPoint>();
  const [locationStatus, setLocationStatus] = useState("");
  const [locating, setLocating] = useState(false);
  const [trailLayer, setTrailLayer] = useState<UniverseLayerId>("hiking");
  const [universe, setUniverse] = useState<OutdoorUniverseResponse>(() => emptyUniverse("hiking"));
  const [trailLoading, setTrailLoading] = useState(true);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [browseTab, setBrowseTab] = useState<"decisions" | "trails">("decisions");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch(`/api/outdoor-universe?layer=${trailLayer}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Trail layer unavailable");
        return response.json() as Promise<OutdoorUniverseResponse>;
      })
      .then((payload) => {
        if (!cancelled) setUniverse(payload);
      })
      .catch(() => {
        if (!cancelled) setUniverse(emptyUniverse(trailLayer));
      })
      .finally(() => {
        if (!cancelled) setTrailLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [trailLayer]);

  const visible = useMemo(() => {
    const matches = filterDestinations(destinations, { query, activity, region, kids, dog, accessible });
    if (!location) return matches;
    return [...matches].sort((a, b) => (
      haversineMiles(location.latitude, location.longitude, a.latitude, a.longitude) -
      haversineMiles(location.latitude, location.longitude, b.latitude, b.longitude)
    ));
  }, [query, activity, region, kids, dog, accessible, location]);

  const filteredTrailSystems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return universe.systems;
    return universe.systems.filter((system) =>
      `${system.name} ${system.type} ${system.unit ?? ""}`.toLowerCase().includes(normalized),
    );
  }, [query, universe.systems]);

  const filteredTrailGeoJson = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return universe.geojson;
    return {
      type: "FeatureCollection" as const,
      features: universe.geojson.features.filter((feature) => {
        const properties = feature.properties ?? {};
        return `${properties.Name ?? ""} ${properties.TrailNamePrimary ?? ""} ${properties.PRDTrailUnit ?? ""}`
          .toLowerCase()
          .includes(normalized);
      }),
    };
  }, [query, universe.geojson]);

  const activeDestination = visible.find((destination) => destination.id === activeId);
  const filterCount =
    Number(activity !== "all") + Number(region !== "all") + Number(kids) + Number(dog) + Number(accessible);
  const trailSystemsToShow = filteredTrailSystems.slice(0, query ? 80 : 40);

  const activate = useCallback((destinationId: string) => {
    setActiveId(destinationId);
    safeTrack("explorer_map_marker_selected");
  }, []);

  function clearFilters() {
    setActivity("all");
    setRegion("all");
    setKids(false);
    setDog(false);
    setAccessible(false);
    setActiveId("");
  }

  function useMyLocation() {
    setLocationStatus("");
    if (!navigator.geolocation) {
      setLocationStatus("Location is unavailable in this browser.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latitude = Number(coords.latitude.toFixed(5));
        const longitude = Number(coords.longitude.toFixed(5));
        if (!isPlausibleMichiganCoordinate(latitude, longitude)) {
          setLocationStatus("Your location appears outside Michigan.");
          setLocating(false);
          return;
        }
        setLocation({ latitude, longitude });
        setLocationStatus("Full-planning places are sorted near you.");
        setLocating(false);
        safeTrack("explorer_device_location_used");
      },
      () => {
        setLocationStatus("Location was not available. Search still works.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 600_000 },
    );
  }

  function showOnMap(destinationId: string) {
    activate(destinationId);
    setBrowseOpen(false);
    window.setTimeout(() => {
      document.getElementById("destination-map-panel")?.scrollIntoView({ block: "nearest" });
    }, 0);
  }

  function distanceFromUser(latitude: number, longitude: number) {
    if (!location) return null;
    return Math.round(haversineMiles(location.latitude, location.longitude, latitude, longitude));
  }

  const closureCount = universe.access.closureCount;
  const rerouteCount = universe.access.rerouteCount;

  return (
    <section className="explorer-shell explorer-map-shell" aria-label="Explore Michigan outdoors">
      <div className="map-command-bar">
        <label className="map-search">
          <span>Search Michigan</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            placeholder="Trail, park, river, dunes…"
          />
        </label>

        <label className="map-layer-select">
          <span>Official DNR map layer</span>
          <select
            value={trailLayer}
            onChange={(event) => {
              const layer = event.target.value as UniverseLayerId;
              if (layer !== trailLayer) setTrailLoading(true);
              setTrailLayer(layer);
              safeTrack("explorer_universe_layer_changed", { layer });
            }}
          >
            {universeLayerIds.map((layer) => (
              <option value={layer} key={layer}>{universeLayerLabels[layer]}</option>
            ))}
          </select>
        </label>

        <button type="button" className="map-command-button map-near-button" onClick={useMyLocation} disabled={locating}>
          <span aria-hidden="true">◎</span>
          {locating ? "Finding…" : location ? "Near me" : "Find outdoor places near me"}
        </button>

        <details className="map-filter-menu">
          <summary>Filters{filterCount ? ` · ${filterCount}` : ""}</summary>
          <div className="map-filter-popover">
            <label>
              <span>Decision activity</span>
              <select value={activity} onChange={(event) => { setActivity(event.target.value as ActivityId | "all"); safeTrack("explorer_filter_changed", { filter: "activity" }); }}>
                <option value="all">Any activity</option>
                {activityIds.map((activityId) => <option value={activityId} key={activityId}>{activityLabels[activityId]}</option>)}
              </select>
            </label>
            <label>
              <span>Region</span>
              <select value={region} onChange={(event) => setRegion(event.target.value as RegionId | "all")}>
                <option value="all">All Michigan</option>
                {regionIds.map((regionId) => <option value={regionId} key={regionId}>{regionLabels[regionId]}</option>)}
              </select>
            </label>
            <div className="map-checks" aria-label="Family, dog & access filters">
              <label><input type="checkbox" checked={kids} onChange={(event) => setKids(event.target.checked)} /><span>Family fit</span></label>
              <label><input type="checkbox" checked={dog} onChange={(event) => setDog(event.target.checked)} /><span>Dog-compatible</span></label>
              <label><input type="checkbox" checked={accessible} onChange={(event) => setAccessible(event.target.checked)} /><span>Lower-barrier</span></label>
            </div>
            {filterCount > 0 && <button type="button" onClick={clearFilters}>Clear filters</button>}
          </div>
        </details>

        <button
          type="button"
          className="map-command-button map-browse-button"
          aria-expanded={browseOpen}
          onClick={() => {
            setBrowseOpen((value) => !value);
            safeTrack("explorer_browse_toggled");
          }}
        >
          Browse
        </button>
      </div>

      <p className="map-location-status" aria-live="polite">{locationStatus}</p>

      <section className="explorer-map-panel" id="destination-map-panel" aria-label="Michigan outdoor universe map">
        <MichiganDestinationMap
          activeId={activeId}
          destinations={visible}
          onActivate={activate}
          trailGeoJson={filteredTrailGeoJson}
          trailSystems={filteredTrailSystems}
          closuresGeoJson={universe.access.closures}
          reroutesGeoJson={universe.access.reroutes}
          closureCount={closureCount}
          rerouteCount={rerouteCount}
          trailLayerLabel={universe.label}
          userLocation={location}
        />

        <div className="map-live-strip" aria-live="polite">
          <div>
            <span className="map-live-dot" aria-hidden="true" />
            <strong>{trailLoading ? "Updating…" : universe.status === "live" ? universe.label : "DNR layer unavailable"}</strong>
          </div>
          {!trailLoading && universe.status === "live" && (
            <>
              <span>{universe.featureCount.toLocaleString()} segments · {universe.miles.toLocaleString()} mi</span>
              {closureCount > 0 && <span className="map-access-alert">{closureCount} closure{closureCount === 1 ? "" : "s"}</span>}
              {rerouteCount > 0 && <span>{rerouteCount} reroute{rerouteCount === 1 ? "" : "s"}</span>}
              {universe.partial && <span>partial coverage</span>}
            </>
          )}
          <span className="map-source-inline">Source: Michigan DNR · Updated {updatedLabel(universe.fetchedAt)}</span>
        </div>

        {activeDestination && (
          <article className="map-selection">
            <button type="button" className="map-selection-close" onClick={() => setActiveId("")} aria-label="Close selected place">×</button>
            <span>Full trip planning · {regionLabels[destinationRegion(activeDestination)]}</span>
            <h3>{activeDestination.name}</h3>
            <p>{activeDestination.summary}</p>
            <div>
              <Link href={`/places/${activeDestination.id}`}>Conditions & trip decision →</Link>
            </div>
          </article>
        )}

        <aside className="universe-drawer" data-open={browseOpen} aria-hidden={!browseOpen}>
          <header>
            <div>
              <span>Explore this map</span>
              <strong>{query ? `Matches for “${query}”` : universe.label}</strong>
            </div>
            <button type="button" onClick={() => setBrowseOpen(false)} aria-label="Close browse drawer">×</button>
          </header>
          <div className="universe-drawer-tabs" role="tablist" aria-label="Browse map results">
            <button type="button" role="tab" aria-selected={browseTab === "decisions"} onClick={() => setBrowseTab("decisions")}>
              Full planning <span>{visible.length}</span>
            </button>
            <button type="button" role="tab" aria-selected={browseTab === "trails"} onClick={() => setBrowseTab("trails")}>
              Trail systems <span>{filteredTrailSystems.length}</span>
            </button>
          </div>

          <div className="universe-drawer-body">
            {browseTab === "decisions" ? (
              visible.length ? (
                <div className="decision-ready-list">
                  {visible.slice(0, 30).map((destination) => {
                    const distance = distanceFromUser(destination.latitude, destination.longitude);
                    return (
                      <article key={destination.id}>
                        <button type="button" className="drawer-place-button" onClick={() => showOnMap(destination.id)}>
                          <span>{regionLabels[destinationRegion(destination)]}{distance === null ? "" : ` · ~${distance} mi`}</span>
                          <strong>{destination.name}</strong>
                          <small>{destination.summary}</small>
                        </button>
                        <Link href={`/places/${destination.id}`}>Open decision →</Link>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="drawer-empty"><strong>No full-planning place matches.</strong><span>Clear a filter or browse the statewide trail systems.</span></div>
              )
            ) : (
              universe.status === "live" && trailSystemsToShow.length ? (
                <div className="trail-system-list">
                  {trailSystemsToShow.map((system) => (
                    <article key={system.name}>
                      <span>{system.type}</span>
                      <strong>{system.name}</strong>
                      <small>{system.unit || "Michigan DNR trail network"} · {system.miles.toLocaleString()} mi</small>
                    </article>
                  ))}
                  {filteredTrailSystems.length > trailSystemsToShow.length && (
                    <p>Showing {trailSystemsToShow.length} of {filteredTrailSystems.length.toLocaleString()}. Search to narrow.</p>
                  )}
                </div>
              ) : (
                <div className="drawer-empty"><strong>{trailLoading ? "Loading DNR trails…" : "No trail-system match."}</strong></div>
              )
            )}
          </div>

          <footer>
            <span>{universe.access.note}</span>
            <a href={universe.source.url}>Michigan DNR source →</a>
          </footer>
        </aside>
      </section>
    </section>
  );
}
