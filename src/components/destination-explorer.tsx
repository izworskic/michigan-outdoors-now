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
    // Discovery must work even when analytics are blocked.
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
      url: "https://gisagoegle.state.mi.us/arcgis/rest/services/DNR/DNRTrailsOPENDATA/FeatureServer/21",
      authority: "Michigan Department of Natural Resources",
    },
    featureCount: 0,
    systemCount: 0,
    miles: 0,
    partial: false,
    geojson: { type: "FeatureCollection", features: [] },
    systems: [],
    note: "Loading the official DNR trail layer.",
  };
}

export function DestinationExplorer() {
  const [query, setQuery] = useState("");
  const [activity, setActivity] = useState<ActivityId | "all">("all");
  const [region, setRegion] = useState<RegionId | "all">("all");
  const [kids, setKids] = useState(false);
  const [dog, setDog] = useState(false);
  const [accessible, setAccessible] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [mobileView, setMobileView] = useState<"map" | "discover">("map");
  const [location, setLocation] = useState<LocationPoint>();
  const [locationStatus, setLocationStatus] = useState("");
  const [locating, setLocating] = useState(false);
  const [trailLayer, setTrailLayer] = useState<UniverseLayerId>("hiking");
  const [universe, setUniverse] = useState<OutdoorUniverseResponse>(() => emptyUniverse("hiking"));
  const [trailLoading, setTrailLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setTrailLoading(true);

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
  const practicalFilterCount = Number(kids) + Number(dog) + Number(accessible);
  const hasFilters = Boolean(query || activity !== "all" || region !== "all" || practicalFilterCount);
  const trailSystemsToShow = filteredTrailSystems.slice(0, query ? 80 : 30);

  const activate = useCallback((destinationId: string) => {
    setActiveId(destinationId);
    safeTrack("explorer_map_marker_selected");
  }, []);

  function clearFilters() {
    setQuery("");
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
      setLocationStatus("Location is unavailable in this browser. You can still search by place or region.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latitude = Number(coords.latitude.toFixed(5));
        const longitude = Number(coords.longitude.toFixed(5));
        if (!isPlausibleMichiganCoordinate(latitude, longitude)) {
          setLocationStatus("Your location appears outside Michigan. Choose a region or search for a Michigan place instead.");
          setLocating(false);
          return;
        }
        setLocation({ latitude, longitude });
        setLocationStatus("Decision-ready places are sorted near you. Your coordinates are not saved or added to the URL.");
        setLocating(false);
        safeTrack("explorer_device_location_used");
      },
      () => {
        setLocationStatus("Location was not available. Allow it in your browser or use search and region filters.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 600_000 },
    );
  }

  function showOnMap(destinationId: string) {
    activate(destinationId);
    setMobileView("map");
    window.setTimeout(() => {
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      document.getElementById("destination-map-panel")?.scrollIntoView({ behavior, block: "start" });
    }, 0);
  }

  function distanceFromUser(latitude: number, longitude: number) {
    if (!location) return null;
    return Math.round(haversineMiles(location.latitude, location.longitude, latitude, longitude));
  }

  return (
    <section className="explorer-shell universe-explorer" aria-labelledby="explorer-title">
      <div className="explorer-controls universe-controls">
        <div className="explorer-heading">
          <div>
            <p className="eyebrow">Michigan outdoor universe</p>
            <h2 id="explorer-title">Discover broadly. Decide strictly.</h2>
            <p className="universe-intro">
              The map no longer pretends a small curated list is the whole state. Official Michigan DNR trail geometry
              provides the discovery layer; brighter dots mark places where this platform has enough structured data
              to make a stronger trip decision.
            </p>
          </div>
          <button type="button" className="explorer-location-button" onClick={useMyLocation} disabled={locating}>
            <span aria-hidden="true">◎</span>{locating ? "Finding you…" : location ? "Decision dots sorted near you" : "Find decision-ready places near me"}
          </button>
        </div>
        <p className="explorer-location-status" aria-live="polite">{locationStatus}</p>

        <div className="universe-layer-picker" aria-label="Choose official DNR trail layer">
          <span>Official DNR map layer</span>
          <div>
            {universeLayerIds.map((layer) => (
              <button
                type="button"
                key={layer}
                aria-pressed={trailLayer === layer}
                onClick={() => {
                  setTrailLayer(layer);
                  safeTrack("explorer_universe_layer_changed", { layer });
                }}
              >
                {universeLayerLabels[layer]}
              </button>
            ))}
          </div>
        </div>

        <div className="universe-stats" aria-live="polite">
          <div><strong>{visible.length}</strong><span>decision-ready matches</span></div>
          <div><strong>{trailLoading ? "…" : universe.featureCount.toLocaleString()}</strong><span>DNR trail segments</span></div>
          <div><strong>{trailLoading ? "…" : universe.systemCount.toLocaleString()}</strong><span>trail systems</span></div>
          <div><strong>{trailLoading ? "…" : universe.miles.toLocaleString()}</strong><span>mapped miles in layer</span></div>
        </div>

        <div className="explorer-primary-filters">
          <label className="explorer-search-field">
            <span>Search everything shown</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Place, trail, river, dunes…" />
          </label>
          <label>
            <span>Decision-ready activity</span>
            <select value={activity} onChange={(event) => { setActivity(event.target.value as ActivityId | "all"); safeTrack("explorer_filter_changed", { filter: "activity" }); }}>
              <option value="all">Any activity</option>
              {activityIds.map((activityId) => <option value={activityId} key={activityId}>{activityLabels[activityId]}</option>)}
            </select>
          </label>
          <label>
            <span>Decision-ready region</span>
            <select value={region} onChange={(event) => setRegion(event.target.value as RegionId | "all")}>
              <option value="all">Anywhere in Michigan</option>
              {regionIds.map((regionId) => <option value={regionId} key={regionId}>{regionLabels[regionId]}</option>)}
            </select>
          </label>
        </div>

        <details className="explorer-more-filters">
          <summary>Family, dog & access filters for decision-ready places{practicalFilterCount ? ` (${practicalFilterCount} on)` : ""}</summary>
          <div>
            <label><input type="checkbox" checked={kids} onChange={(event) => setKids(event.target.checked)} /><span>Family fit</span></label>
            <label><input type="checkbox" checked={dog} onChange={(event) => setDog(event.target.checked)} /><span>Dog-compatible</span></label>
            <label><input type="checkbox" checked={accessible} onChange={(event) => setAccessible(event.target.checked)} /><span>Lower-barrier possibilities</span></label>
          </div>
        </details>

        <div className="explorer-toolbar">
          <p>
            <strong>{universe.status === "live" ? universe.label : "DNR layer unavailable"}</strong>
            <span> · {visible.length} decision-ready place{visible.length === 1 ? "" : "s"}</span>
            {location && <span> · nearest first</span>}
          </p>
          <div className="explorer-toolbar-actions">
            {hasFilters && <button type="button" className="clear-filter-button" onClick={clearFilters}>Clear place filters</button>}
            <div className="explorer-view-toggle" aria-label="Choose map or discovery rail view">
              <button type="button" aria-pressed={mobileView === "map"} onClick={() => setMobileView("map")}>Map</button>
              <button type="button" aria-pressed={mobileView === "discover"} onClick={() => setMobileView("discover")}>Discover</button>
            </div>
          </div>
        </div>
      </div>

      <div className="explorer-workspace universe-workspace" data-mobile-view={mobileView}>
        <section className="explorer-map-panel" id="destination-map-panel" aria-label="Michigan outdoor universe map">
          <MichiganDestinationMap
            activeId={activeId}
            destinations={visible}
            onActivate={activate}
            trailGeoJson={filteredTrailGeoJson}
            trailLayerLabel={universe.label}
            userLocation={location}
          />
          {!activeDestination && (
            <div className="map-instruction universe-map-instruction">
              <strong>Dots are decisions. Lines are discovery.</strong>
              <span>Tap a bright dot for a decision-ready place. Change the DNR layer above to explore the statewide trail network.</span>
            </div>
          )}
          {activeDestination && (
            <article className="map-selection">
              <button type="button" className="map-selection-close" onClick={() => setActiveId("")} aria-label="Close selected place">×</button>
              <span>Decision-ready · {regionLabels[destinationRegion(activeDestination)]} · {activeDestination.area}</span>
              <h3>{activeDestination.name}</h3>
              <p>{activeDestination.summary}</p>
              <div>
                <Link href={`/places/${activeDestination.id}`}>Conditions & trip decision →</Link>
              </div>
            </article>
          )}
        </section>

        <aside className="explorer-results universe-discovery-rail" aria-label="Michigan outdoor discovery rail">
          <section className="universe-rail-section">
            <div className="universe-rail-heading">
              <div>
                <span>Decision-ready</span>
                <h3>Places with deeper intelligence</h3>
              </div>
              <strong>{visible.length}</strong>
            </div>
            {visible.length ? (
              <div className="decision-ready-list">
                {visible.slice(0, 18).map((destination) => {
                  const distance = distanceFromUser(destination.latitude, destination.longitude);
                  return (
                    <article id={`place-${destination.id}`} data-active={activeId === destination.id} key={destination.id}>
                      <button type="button" className="result-map-dot" onClick={() => showOnMap(destination.id)} aria-label={`Show ${destination.name} on the map`}>
                        <span aria-hidden="true" />
                      </button>
                      <div className="explorer-result-copy">
                        <div className="explorer-card-top">
                          <span>{regionLabels[destinationRegion(destination)]}</span>
                          <small>{distance === null ? destination.area : `~${distance} mi away`}</small>
                        </div>
                        <h3>{destination.name}</h3>
                        <p>{destination.summary}</p>
                        <div className="explorer-card-actions">
                          <Link href={`/places/${destination.id}`} onClick={() => safeTrack("explorer_place_opened")}>Open decision →</Link>
                          <button type="button" onClick={() => showOnMap(destination.id)}>Show dot</button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {visible.length > 18 && <p className="universe-more-note">{visible.length - 18} more decision-ready matches remain on the map. Use search or filters to narrow them.</p>}
              </div>
            ) : (
              <div className="explorer-empty">
                <h3>No decision-ready place matches every filter.</h3>
                <p>The official DNR discovery layer remains visible. Clear a place filter to restore decision dots.</p>
                <button type="button" onClick={clearFilters}>Clear place filters</button>
              </div>
            )}
          </section>

          <section className="universe-rail-section universe-trail-section">
            <div className="universe-rail-heading">
              <div>
                <span>Official Michigan DNR</span>
                <h3>{universe.label}</h3>
              </div>
              <strong>{universe.systemCount.toLocaleString()}</strong>
            </div>
            <p className="universe-source-note">{universe.note}</p>
            {universe.status === "live" && trailSystemsToShow.length ? (
              <div className="trail-system-list">
                {trailSystemsToShow.map((system) => (
                  <article key={system.name}>
                    <span>{system.type}</span>
                    <h4>{system.name}</h4>
                    <p>{system.unit || "Michigan DNR trail network"}</p>
                    <small>{system.miles.toLocaleString()} mapped mi · {system.segments} segment{system.segments === 1 ? "" : "s"}</small>
                  </article>
                ))}
              </div>
            ) : (
              <div className="universe-source-unavailable">
                <strong>{trailLoading ? "Loading official DNR geometry…" : "Official trail layer temporarily unavailable."}</strong>
                <span>Decision-ready dots continue to work independently.</span>
              </div>
            )}
            {filteredTrailSystems.length > trailSystemsToShow.length && (
              <p className="universe-more-note">
                Showing {trailSystemsToShow.length} of {filteredTrailSystems.length.toLocaleString()} matching trail systems. Search by trail name to narrow the rail; all returned geometry remains on the map.
              </p>
            )}
            <a className="universe-source-link" href={universe.source.url}>Michigan DNR source layer →</a>
          </section>
        </aside>
      </div>
    </section>
  );
}
