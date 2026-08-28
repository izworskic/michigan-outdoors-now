"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { destinations } from "../data/destinations";
import { specialistTools } from "../data/specialist-tools";
import type { BoatLaunchResponse } from "../lib/boat-launches";
import { universeLayerIds, universeLayerLabels, type OutdoorUniverseResponse, type UniverseLayerId } from "../lib/outdoor-universe";
import type { ActivityId, DateChoice, Plan, PlannerRequest, PlannerResponse } from "../lib/types";
import { MichiganDestinationMap } from "./michigan-destination-map";

type PullId = "best" | "water" | "trail" | "river" | "dark" | "long" | "weekend";

type Pull = {
  id: PullId;
  label: string;
  short: string;
  driveHours: number;
  date: DateChoice;
  activities: ActivityId[];
};

const pulls: Pull[] = [
  { id: "best", label: "Best now", short: "Anything making a case today", driveHours: 2, date: "today", activities: ["hiking", "scenic", "birding"] },
  { id: "water", label: "Water", short: "Shorelines, beaches and paddling", driveHours: 3, date: "today", activities: ["beaches", "paddling", "scenic"] },
  { id: "trail", label: "Trail", short: "A day on foot", driveHours: 3, date: "today", activities: ["hiking"] },
  { id: "river", label: "River", short: "Fishing and moving water", driveHours: 3, date: "today", activities: ["fishing", "paddling"] },
  { id: "dark", label: "After dark", short: "Dark sky and night conditions", driveHours: 4, date: "today", activities: ["dark-sky", "scenic"] },
  { id: "long", label: "Long haul", short: "Open the whole state", driveHours: 8, date: "today", activities: ["hiking", "scenic"] },
  { id: "weekend", label: "Weekend", short: "Let both days compete", driveHours: 8, date: "weekend", activities: ["hiking", "scenic", "birding"] },
];

function emptyUniverse(layer: UniverseLayerId = "hiking"): OutdoorUniverseResponse {
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
      note: "Loading access data.",
    },
    note: "Loading the statewide trail layer.",
  };
}

function emptyBoatLaunches(): BoatLaunchResponse {
  return {
    status: "unavailable",
    fetchedAt: "",
    source: {
      name: "Michigan Boat Launches",
      url: "https://chrisizworski.com/michigan-boat-launches/",
      authority: "Michigan Department of Natural Resources + source-qualified municipal operators",
    },
    count: 0,
    greatLakesCount: 0,
    inlandCount: 0,
    geojson: { type: "FeatureCollection", features: [] },
    note: "Loading boat launches.",
  };
}

function driveTimeLabel(hours: number) {
  const minutes = Math.round(hours * 60);
  if (minutes < 60) return `${minutes} min`;
  const wholeHours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${wholeHours} hr ${remainder} min` : `${wholeHours} hr`;
}

function weatherLine(plan: Plan) {
  if (!plan.weather) return "Live weather is limited for this place.";
  const parts: string[] = [];
  if (plan.weather.high !== null) parts.push(`${Math.round(plan.weather.high)}°`);
  if (plan.weather.precipitationProbability !== null) parts.push(`${Math.round(plan.weather.precipitationProbability)}% rain`);
  if (plan.weather.windGust !== null) parts.push(`gusts ${Math.round(plan.weather.windGust)} mph`);
  if (plan.weather.aqi !== null) parts.push(`AQI ${Math.round(plan.weather.aqi)}`);
  return parts.join(" · ");
}

function whyLine(plan: Plan) {
  const useful = plan.reasons.filter((reason) => !reason.startsWith("About "));
  return useful.slice(0, 1).join(" ") || plan.destination.summary;
}

export function OutdoorIntentHub() {
  const [origin, setOrigin] = useState("");
  const [originCoordinates, setOriginCoordinates] = useState<PlannerRequest["originCoordinates"]>();
  const [userLocation, setUserLocation] = useState<PlannerRequest["originCoordinates"]>();
  const [pull, setPull] = useState<Pull>(pulls[0]);
  const [driveHours, setDriveHours] = useState(pulls[0].driveHours);
  const [plans, setPlans] = useState<PlannerResponse | null>(null);
  const [planning, setPlanning] = useState(false);
  const [message, setMessage] = useState("");
  const [activeId, setActiveId] = useState("");
  const [trailLayer, setTrailLayer] = useState<UniverseLayerId>("hiking");
  const [universe, setUniverse] = useState<OutdoorUniverseResponse>(() => emptyUniverse("hiking"));
  const [boatLaunches, setBoatLaunches] = useState<BoatLaunchResponse>(() => emptyBoatLaunches());
  const requestRef = useRef<AbortController | null>(null);
  const originInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const trailsController = new AbortController();
    setUniverse(emptyUniverse(trailLayer));

    fetch(`/api/outdoor-universe?layer=${trailLayer}`, { signal: trailsController.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Trail layer unavailable");
        return response.json() as Promise<OutdoorUniverseResponse>;
      })
      .then(setUniverse)
      .catch(() => undefined);

    return () => trailsController.abort();
  }, [trailLayer]);

  useEffect(() => {
    const launchesController = new AbortController();

    fetch("/api/boat-launches", { signal: launchesController.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Boat launches unavailable");
        return response.json() as Promise<BoatLaunchResponse>;
      })
      .then(setBoatLaunches)
      .catch(() => undefined);

    return () => launchesController.abort();
  }, []);

  const run = useCallback(async (
    nextPull: Pull = pull,
    nextDriveHours = driveHours,
    originOverride?: string,
    coordinateOverride?: PlannerRequest["originCoordinates"],
  ) => {
    const chosenOrigin = (originOverride ?? origin).trim();
    const coordinates = coordinateOverride ?? originCoordinates;

    if (!chosenOrigin) {
      setMessage(`Set a starting point, then ${nextPull.label.toLowerCase()} can take over from there.`);
      originInputRef.current?.focus();
      return;
    }

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setPlanning(true);
    setMessage("");

    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          origin: chosenOrigin,
          ...(coordinates ? { originCoordinates: coordinates } : {}),
          date: nextPull.date,
          maxDriveHours: nextDriveHours,
          activities: nextPull.activities,
          kids: false,
          dog: false,
          accessible: false,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !("plans" in payload)) throw new Error(payload.error ?? "Could not compare places.");

      const result = payload as PlannerResponse;
      if (requestRef.current !== controller) return;
      setPlans(result);
      setUserLocation({
        latitude: result.origin.latitude,
        longitude: result.origin.longitude,
      });
      setActiveId(result.plans[0]?.destination.id ?? "");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (requestRef.current !== controller) return;
      setMessage(error instanceof Error ? error.message : "Could not compare places.");
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setPlanning(false);
      }
    }
  }, [driveHours, origin, originCoordinates, pull]);

  function submitOrigin(event: FormEvent) {
    event.preventDefault();
    void run();
  }

  function choosePull(nextPull: Pull) {
    setPull(nextPull);
    setDriveHours(nextPull.driveHours);
    if (nextPull.id === "water" || nextPull.id === "river") setTrailLayer("water");
    if (nextPull.id === "trail") setTrailLayer("hiking");
    if (origin.trim() || originCoordinates) void run(nextPull, nextPull.driveHours);
    else {
      setMessage("");
      originInputRef.current?.focus();
    }
  }

  function useLocation() {
    setMessage("");
    if (!navigator.geolocation) {
      setMessage("Location is unavailable here. Type a Michigan city or ZIP.");
      return;
    }

    setPlanning(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const coordinates = {
          latitude: Number(coords.latitude.toFixed(5)),
          longitude: Number(coords.longitude.toFixed(5)),
        };
        setOrigin("My location");
        setOriginCoordinates(coordinates);
        setUserLocation(coordinates);
        void run(pull, driveHours, "My location", coordinates);
      },
      () => {
        setPlanning(false);
        setMessage("Location was not available. Type a Michigan city or ZIP.");
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 600_000 },
    );
  }

  function changeRange(delta: number) {
    const next = Math.max(1, Math.min(8, driveHours + delta));
    if (next === driveHours) return;
    setDriveHours(next);
    if (origin.trim() || originCoordinates) void run(pull, next);
  }

  function nextIdea() {
    const candidates = plans?.plans ?? [];
    if (candidates.length < 2) return;
    const currentIndex = Math.max(0, candidates.findIndex((plan) => plan.destination.id === activeId));
    const next = candidates[(currentIndex + 1) % candidates.length];
    setActiveId(next.destination.id);
  }

  const activeDestination = destinations.find((destination) => destination.id === activeId) ?? null;
  const activePlan = plans?.plans.find((plan) => plan.destination.id === activeId) ?? null;
  const leadPlan = plans?.plans[0] ?? null;
  const mapStatus = useMemo(() => {
    const pieces = [];
    if (universe.status === "live") pieces.push(`${universe.systemCount.toLocaleString()} ${universe.label.toLowerCase()}`);
    if (boatLaunches.status === "live") pieces.push(`${boatLaunches.count.toLocaleString()} launches`);
    return pieces.join(" · ");
  }, [boatLaunches.count, boatLaunches.status, universe.status, universe.systemCount]);

  return (
    <main className="michigan-canvas" aria-label="Explore Michigan outdoors">
      <div className="michigan-canvas-map">
        <MichiganDestinationMap
          activeId={activeId}
          destinations={destinations}
          onActivate={setActiveId}
          trailGeoJson={universe.geojson}
          trailSystems={universe.systems}
          closuresGeoJson={universe.access.closures}
          reroutesGeoJson={universe.access.reroutes}
          closureCount={universe.access.closureCount}
          rerouteCount={universe.access.rerouteCount}
          trailLayerLabel={universe.label}
          boatLaunchGeoJson={boatLaunches.geojson}
          boatLaunchCount={boatLaunches.count}
          userLocation={userLocation}
        />
      </div>

      <header className="canvas-topbar">
        <div className="canvas-brand">
          <span>Michigan Outdoors Now</span>
          <strong>Go find something.</strong>
        </div>

        <form className="canvas-origin" onSubmit={submitOrigin}>
          <input
            ref={originInputRef}
            value={origin}
            onChange={(event) => {
              requestRef.current?.abort();
              setOrigin(event.target.value);
              setOriginCoordinates(undefined);
              setPlans(null);
              setMessage("");
            }}
            placeholder="Start from a city or ZIP"
            aria-label="Starting city or ZIP"
            autoComplete="postal-code"
          />
          <button type="submit" disabled={planning}>{planning ? "Looking" : "Set start"}</button>
          <button type="button" onClick={useLocation} disabled={planning} aria-label="Use my current location">◎</button>
        </form>

        <div className="canvas-links">
          <Link href="/explore">Full atlas</Link>
          <details className="canvas-layer-menu">
            <summary>Layers</summary>
            <div>
              <span className="canvas-menu-label">Official DNR trail networks</span>
              {universeLayerIds.map((layer) => (
                <button
                  type="button"
                  key={layer}
                  aria-pressed={trailLayer === layer}
                  onClick={() => setTrailLayer(layer)}
                >
                  {universeLayerLabels[layer]}
                </button>
              ))}
            </div>
          </details>
          <details>
            <summary>Live</summary>
            <div>
              {specialistTools.filter((tool) => ["beaches", "trout", "birding", "aurora", "freighters"].includes(tool.id)).map((tool) => (
                <a href={tool.url} key={tool.id}>{tool.name}</a>
              ))}
            </div>
          </details>
        </div>
      </header>

      <section className="canvas-pulls" aria-label="Ways to explore">
        <div className="canvas-pulls-label">
          <span>What are you after?</span>
          {mapStatus && <small>{mapStatus}</small>}
        </div>
        <div className="canvas-pulls-rail">
          {pulls.map((option) => (
            <button
              type="button"
              key={option.id}
              aria-pressed={pull.id === option.id}
              title={option.short}
              onClick={() => choosePull(option)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      {message && <p className="canvas-message">{message}</p>}

      {(activeDestination || activePlan) && (
        <aside className="canvas-sheet" aria-live="polite">
          <button type="button" className="canvas-sheet-close" onClick={() => setActiveId("")} aria-label="Close place detail">×</button>

          {activePlan ? (
            <>
              <p className="canvas-sheet-kicker">{pull.label} · {driveTimeLabel(activePlan.driveHours)} away</p>
              <h1>{activePlan.destination.name}</h1>
              <p className="canvas-sheet-area">{activePlan.destination.area} · about {activePlan.distanceMiles} rough miles</p>
              <p className="canvas-sheet-summary">{activePlan.destination.summary}</p>

              <div className="canvas-now">
                <span>Why this one</span>
                <strong>{whyLine(activePlan)}</strong>
                <small>{weatherLine(activePlan)}</small>
              </div>

              <div className="canvas-sheet-actions">
                <Link href={`/places/${activePlan.destination.id}?date=${encodeURIComponent(activePlan.weather?.date ?? plans?.targetDate ?? "")}`}>Open the place</Link>
                <a href={activePlan.mapUrl}>Directions</a>
              </div>

              <div className="canvas-branch">
                {driveHours < 8 && <button type="button" onClick={() => changeRange(2)}>Go farther</button>}
                {driveHours > 1 && <button type="button" onClick={() => changeRange(-2)}>Stay closer</button>}
                {(plans?.plans.length ?? 0) > 1 && <button type="button" onClick={nextIdea}>Show another</button>}
              </div>

              {(plans?.plans.length ?? 0) > 1 && (
                <div className="canvas-other-picks">
                  <span>Also making a case</span>
                  {plans?.plans.filter((plan) => plan.destination.id !== activePlan.destination.id).slice(0, 2).map((plan) => (
                    <button type="button" key={plan.destination.id} onClick={() => setActiveId(plan.destination.id)}>
                      <strong>{plan.destination.name}</strong>
                      <small>{driveTimeLabel(plan.driveHours)} · {plan.destination.area}</small>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : activeDestination ? (
            <>
              <p className="canvas-sheet-kicker">You found this on the map</p>
              <h1>{activeDestination.name}</h1>
              <p className="canvas-sheet-area">{activeDestination.area}</p>
              <p className="canvas-sheet-summary">{activeDestination.summary}</p>
              <div className="canvas-sheet-actions">
                <Link href={`/places/${activeDestination.id}`}>Open the place</Link>
                <button type="button" onClick={() => void run()}>What’s good from my start?</button>
              </div>
            </>
          ) : null}
        </aside>
      )}

      {!activeId && !plans && (
        <div className="canvas-first-use">
          <strong>Drag the map. Tap anything.</strong>
          <span>Or set a start and let current conditions narrow the state.</span>
        </div>
      )}

      {plans && !activeId && leadPlan && (
        <button type="button" className="canvas-return-pick" onClick={() => setActiveId(leadPlan.destination.id)}>
          Return to {leadPlan.destination.name}
        </button>
      )}
    </main>
  );
}
