"use client";

import { track } from "@vercel/analytics";
import Link from "next/link";
import { useMemo, useState } from "react";
import { destinations } from "../data/destinations";
import {
  destinationActivityText,
  destinationRegion,
  filterDestinations,
  regionIds,
  regionLabels,
  type RegionId,
} from "../lib/destination-content";
import { activityLabels } from "../lib/planner";
import { activityIds, type ActivityId } from "../lib/types";

const mapWidth = 800;
const mapHeight = 760;

function markerPosition(latitude: number, longitude: number) {
  return {
    left: `${(((longitude + 90) * 96) / mapWidth) * 100}%`,
    top: `${(((48.5 - latitude) * 108) / mapHeight) * 100}%`,
  };
}

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

  const visible = useMemo(() => {
    return filterDestinations(destinations, { query, activity, region, kids, dog, accessible });
  }, [query, activity, region, kids, dog, accessible]);

  const visibleIds = useMemo(() => new Set(visible.map((destination) => destination.id)), [visible]);

  function setActivityFilter(next: ActivityId | "all") {
    setActivity(next);
    safeTrack("explorer_filter_changed", { filter: "activity", value: next });
  }

  function clearFilters() {
    setQuery("");
    setActivity("all");
    setRegion("all");
    setKids(false);
    setDog(false);
    setAccessible(false);
    setActiveId("");
  }

  function activate(destinationId: string) {
    setActiveId(destinationId);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`place-${destinationId}`)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
    safeTrack("explorer_map_marker_selected");
  }

  return (
    <section className="explorer-shell" aria-labelledby="explorer-title">
      <div className="explorer-controls">
        <div className="explorer-heading">
          <div><p className="eyebrow">Interactive Michigan finder</p><h2 id="explorer-title">Filter the state down to a day that fits.</h2></div>
          <p>Search a place or area, choose an activity, then add the practical needs that matter.</p>
        </div>

        <div className="explorer-search-row">
          <label>
            <span>Search by place, city, or setting</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Try dunes, Detroit, river…" />
          </label>
          <label>
            <span>Michigan region</span>
            <select value={region} onChange={(event) => setRegion(event.target.value as RegionId | "all")}>
              <option value="all">All regions</option>
              {regionIds.map((regionId) => <option value={regionId} key={regionId}>{regionLabels[regionId]}</option>)}
            </select>
          </label>
        </div>

        <fieldset className="explorer-activities">
          <legend>Activity</legend>
          <div>
            <button type="button" aria-pressed={activity === "all"} onClick={() => setActivityFilter("all")}>All</button>
            {activityIds.map((activityId) => (
              <button type="button" aria-pressed={activity === activityId} onClick={() => setActivityFilter(activityId)} key={activityId}>
                {activityLabels[activityId]}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="explorer-needs">
          <legend>Practical needs</legend>
          <div>
            <label><input type="checkbox" checked={kids} onChange={(event) => setKids(event.target.checked)} /><span>Family fit</span></label>
            <label><input type="checkbox" checked={dog} onChange={(event) => setDog(event.target.checked)} /><span>Dog-compatible</span></label>
            <label><input type="checkbox" checked={accessible} onChange={(event) => setAccessible(event.target.checked)} /><span>Lower-barrier options</span></label>
          </div>
        </fieldset>

        <div className="explorer-summary">
          <p aria-live="polite"><strong>{visible.length}</strong> of {destinations.length} curated places match</p>
          <button type="button" onClick={clearFilters}>Clear filters</button>
        </div>
      </div>

      <div className="explorer-workspace">
        <div className="michigan-map" aria-label="Interactive map of curated Michigan outdoor destinations">
          <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} role="img" aria-label="Stylized outline of Michigan's two peninsulas">
            <path d="M0 210 L35 165 L125 170 L165 100 L220 150 L270 202 L480 185 L550 218 L505 282 L365 305 L280 298 L225 365 L120 318 Z" />
            <path d="M505 290 L560 330 L640 380 L700 510 L730 610 L670 708 L575 726 L390 720 L325 640 L345 510 L420 405 L485 335 Z" />
            <path className="map-water-line" d="M286 215 C350 245 425 235 510 210 M410 423 C480 455 540 455 615 408" />
          </svg>
          {destinations.map((destination) => (
            <button
              type="button"
              className="map-marker"
              data-visible={visibleIds.has(destination.id)}
              data-active={activeId === destination.id}
              style={markerPosition(destination.latitude, destination.longitude)}
              onClick={() => activate(destination.id)}
              disabled={!visibleIds.has(destination.id)}
              aria-label={`Show ${destination.name}, ${destination.area}`}
              key={destination.id}
            ><span /></button>
          ))}
          <div className="map-key"><span /> Matching place <i /> Filtered out</div>
        </div>

        <div className="explorer-results" aria-label="Matching Michigan places">
          {visible.length ? visible.map((destination) => (
            <article id={`place-${destination.id}`} data-active={activeId === destination.id} key={destination.id}>
              <div className="explorer-card-top">
                <span>{regionLabels[destinationRegion(destination)]}</span>
                <small>{destination.area}</small>
              </div>
              <h3>{destination.name}</h3>
              <p>{destination.summary}</p>
              <div className="explorer-tags">
                <span>{destinationActivityText(destination)}</span>
                {destination.kidsFriendly && <span>Family fit</span>}
                {destination.dogsAllowed && <span>Dog-compatible</span>}
                {destination.accessibleFriendly && <span>Lower-barrier options</span>}
              </div>
              <Link href={`/places/${destination.id}`} onClick={() => safeTrack("explorer_place_opened")}>See conditions and plan this place →</Link>
            </article>
          )) : (
            <div className="explorer-empty">
              <h3>No place matches every filter.</h3>
              <p>Clear one practical need, choose all regions, or remove the search phrase.</p>
              <button type="button" onClick={clearFilters}>Show all 28 places</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
