"use client";

import { track } from "@vercel/analytics";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { destinations } from "../data/destinations";
import {
  destinationRegion,
  filterDestinations,
  regionIds,
  regionLabels,
  type RegionId,
} from "../lib/destination-content";
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

export function DestinationExplorer() {
  const [query, setQuery] = useState("");
  const [activity, setActivity] = useState<ActivityId | "all">("all");
  const [region, setRegion] = useState<RegionId | "all">("all");
  const [kids, setKids] = useState(false);
  const [dog, setDog] = useState(false);
  const [accessible, setAccessible] = useState(false);
  const [activeId, setActiveId] = useState("");
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [location, setLocation] = useState<LocationPoint>();
  const [locationStatus, setLocationStatus] = useState("");
  const [locating, setLocating] = useState(false);

  const visible = useMemo(() => {
    const matches = filterDestinations(destinations, { query, activity, region, kids, dog, accessible });
    if (!location) return matches;
    return [...matches].sort((a, b) => (
      haversineMiles(location.latitude, location.longitude, a.latitude, a.longitude) -
      haversineMiles(location.latitude, location.longitude, b.latitude, b.longitude)
    ));
  }, [query, activity, region, kids, dog, accessible, location]);

  const activeDestination = visible.find((destination) => destination.id === activeId);
  const practicalFilterCount = Number(kids) + Number(dog) + Number(accessible);
  const hasFilters = Boolean(query || activity !== "all" || region !== "all" || practicalFilterCount);

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
        setLocationStatus("Nearest matching places are now listed first. Your coordinates are not saved or added to the URL.");
        setLocating(false);
        safeTrack("explorer_device_location_used");
      },
      () => {
        setLocationStatus("Location was not available. Allow it in your browser or use the search and region filters.");
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

  function showInList(destinationId: string) {
    setMobileView("list");
    window.setTimeout(() => {
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      document.getElementById(`place-${destinationId}`)?.scrollIntoView({ behavior, block: "nearest" });
    }, 0);
  }

  function distanceFromUser(latitude: number, longitude: number) {
    if (!location) return null;
    return Math.round(haversineMiles(location.latitude, location.longitude, latitude, longitude));
  }

  return (
    <section className="explorer-shell" aria-labelledby="explorer-title">
      <div className="explorer-controls">
        <div className="explorer-heading">
          <div>
            <p className="eyebrow">Michigan destination finder</p>
            <h2 id="explorer-title">See the state. Pick a place. Make a plan.</h2>
          </div>
          <button type="button" className="explorer-location-button" onClick={useMyLocation} disabled={locating}>
            <span aria-hidden="true">◎</span>{locating ? "Finding you…" : location ? "Sorted near you" : "Find places near me"}
          </button>
        </div>
        <p className="explorer-location-status" aria-live="polite">{locationStatus}</p>

        <div className="explorer-primary-filters">
          <label className="explorer-search-field">
            <span>Search</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Place, city, river, dunes…" />
          </label>
          <label>
            <span>What sounds good?</span>
            <select value={activity} onChange={(event) => { setActivity(event.target.value as ActivityId | "all"); safeTrack("explorer_filter_changed", { filter: "activity" }); }}>
              <option value="all">Any activity</option>
              {activityIds.map((activityId) => <option value={activityId} key={activityId}>{activityLabels[activityId]}</option>)}
            </select>
          </label>
          <label>
            <span>Where?</span>
            <select value={region} onChange={(event) => setRegion(event.target.value as RegionId | "all")}>
              <option value="all">Anywhere in Michigan</option>
              {regionIds.map((regionId) => <option value={regionId} key={regionId}>{regionLabels[regionId]}</option>)}
            </select>
          </label>
        </div>

        <details className="explorer-more-filters">
          <summary>Family, dog & access filters{practicalFilterCount ? ` (${practicalFilterCount} on)` : ""}</summary>
          <div>
            <label><input type="checkbox" checked={kids} onChange={(event) => setKids(event.target.checked)} /><span>Family fit</span></label>
            <label><input type="checkbox" checked={dog} onChange={(event) => setDog(event.target.checked)} /><span>Dog-compatible</span></label>
            <label><input type="checkbox" checked={accessible} onChange={(event) => setAccessible(event.target.checked)} /><span>Lower-barrier possibilities</span></label>
          </div>
        </details>

        <div className="explorer-toolbar">
          <p aria-live="polite"><strong>{visible.length}</strong> matching {visible.length === 1 ? "place" : "places"}{location && " · nearest first"}</p>
          <div className="explorer-toolbar-actions">
            {hasFilters && <button type="button" className="clear-filter-button" onClick={clearFilters}>Clear filters</button>}
            <div className="explorer-view-toggle" aria-label="Choose map or list view">
              <button type="button" aria-pressed={mobileView === "map"} onClick={() => setMobileView("map")}>Map</button>
              <button type="button" aria-pressed={mobileView === "list"} onClick={() => setMobileView("list")}>List</button>
            </div>
          </div>
        </div>
      </div>

      <div className="explorer-workspace" data-mobile-view={mobileView}>
        <section className="explorer-map-panel" id="destination-map-panel" aria-label="Destination map">
          {visible.length ? (
            <MichiganDestinationMap
              activeId={activeId}
              destinations={visible}
              onActivate={activate}
              userLocation={location}
            />
          ) : (
            <div className="map-empty"><strong>No pins match.</strong><span>Clear a filter to bring places back.</span></div>
          )}
          {!activeDestination && visible.length > 0 && (
            <p className="map-instruction"><strong>{visible.length} numbered pins</strong><span>Tap one to preview the place.</span></p>
          )}
          {activeDestination && (
            <article className="map-selection">
              <button type="button" className="map-selection-close" onClick={() => setActiveId("")} aria-label="Close selected place">×</button>
              <span>{regionLabels[destinationRegion(activeDestination)]} · {activeDestination.area}</span>
              <h3>{activeDestination.name}</h3>
              <p>{activeDestination.summary}</p>
              <div>
                <Link href={`/places/${activeDestination.id}`}>Conditions & trip details →</Link>
                <button type="button" onClick={() => showInList(activeDestination.id)}>See in list</button>
              </div>
            </article>
          )}
        </section>

        <section className="explorer-results" aria-label="Matching Michigan places">
          {visible.length ? visible.map((destination, index) => {
            const distance = distanceFromUser(destination.latitude, destination.longitude);
            return (
              <article id={`place-${destination.id}`} data-active={activeId === destination.id} key={destination.id}>
                <button type="button" className="result-map-number" onClick={() => showOnMap(destination.id)} aria-label={`Show ${destination.name} on the map`}>
                  {index + 1}
                </button>
                <div className="explorer-result-copy">
                  <div className="explorer-card-top">
                    <span>{regionLabels[destinationRegion(destination)]}</span>
                    <small>{distance === null ? destination.area : `~${distance} mi away`}</small>
                  </div>
                  <h3>{destination.name}</h3>
                  <p>{destination.summary}</p>
                  <div className="explorer-card-actions">
                    <Link href={`/places/${destination.id}`} onClick={() => safeTrack("explorer_place_opened")}>Conditions & trip details →</Link>
                    <button type="button" onClick={() => showOnMap(destination.id)}>Show on map</button>
                  </div>
                </div>
              </article>
            );
          }) : (
            <div className="explorer-empty">
              <h3>No place matches every filter.</h3>
              <p>Remove the search phrase or clear one requirement.</p>
              <button type="button" onClick={clearFilters}>Show all 28 places</button>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
