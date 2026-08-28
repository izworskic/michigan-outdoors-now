"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { destinations } from "../data/destinations";
import { specialistTools } from "../data/specialist-tools";
import { BOAT_LAUNCH_FINDER, type BoatLaunchResponse } from "../lib/boat-launches";
import type { DiscoveryResponse } from "../lib/discovery";
import { universeLayerIds, universeLayerLabels, type OutdoorUniverseResponse, type UniverseLayerId } from "../lib/outdoor-universe";
import { haversineMiles } from "../lib/planner";
import type { ActivityId, DateChoice, Plan, PlannerRequest, PlannerResponse, SpecialistSignal } from "../lib/types";
import { MichiganDestinationMap, type MapFocusPoint, type MapViewport } from "./michigan-destination-map";

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
  const [originStatus, setOriginStatus] = useState<"idle" | "resolving" | "resolved" | "error">("idle");
  const [originFeedback, setOriginFeedback] = useState("Choose a Michigan city or ZIP, or use your location.");
  const [pull, setPull] = useState<Pull>(pulls[0]);
  const [driveHours, setDriveHours] = useState(pulls[0].driveHours);
  const [plans, setPlans] = useState<PlannerResponse | null>(null);
  const [wish, setWish] = useState("");
  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [activeDiscoveryId, setActiveDiscoveryId] = useState("");
  const [planning, setPlanning] = useState(false);
  const [message, setMessage] = useState("");
  const [activeId, setActiveId] = useState("");
  const [viewport, setViewport] = useState<MapViewport>({ latitude: 44.7, longitude: -85.45, zoom: 5.25 });
  const viewportRef = useRef<MapViewport>({ latitude: 44.7, longitude: -85.45, zoom: 5.25 });
  const [aroundOpen, setAroundOpen] = useState(false);
  const [focusPoint, setFocusPoint] = useState<MapFocusPoint | null>(null);
  const [trailLayer, setTrailLayer] = useState<UniverseLayerId>("hiking");
  const [trailRequested, setTrailRequested] = useState(false);
  const [universe, setUniverse] = useState<OutdoorUniverseResponse>(() => emptyUniverse("hiking"));
  const [boatLaunches, setBoatLaunches] = useState<BoatLaunchResponse>(() => emptyBoatLaunches());
  const [signalSnapshot, setSignalSnapshot] = useState<{ placeId: string; signals: SpecialistSignal[] } | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const originRequestRef = useRef<AbortController | null>(null);
  const discoveryRequestRef = useRef<AbortController | null>(null);
  const signalCacheRef = useRef(new Map<string, SpecialistSignal[]>());
  const originInputRef = useRef<HTMLInputElement | null>(null);
  const wishInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!trailRequested) return;
    const trailsController = new AbortController();

    fetch(`/api/outdoor-universe?layer=${trailLayer}`, { signal: trailsController.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Trail layer unavailable");
        return response.json() as Promise<OutdoorUniverseResponse>;
      })
      .then(setUniverse)
      .catch(() => undefined);

    return () => trailsController.abort();
  }, [trailLayer, trailRequested]);

  useEffect(() => {
    const launchesController = new AbortController();
    const timer = window.setTimeout(() => {
      fetch("/api/boat-launches", { signal: launchesController.signal })
        .then((response) => {
          if (!response.ok) throw new Error("Boat launches unavailable");
          return response.json() as Promise<BoatLaunchResponse>;
        })
        .then(setBoatLaunches)
        .catch(() => undefined);
    }, 700);

    return () => {
      window.clearTimeout(timer);
      launchesController.abort();
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const cached = signalCacheRef.current.get(activeId);
    if (cached) {
      setSignalSnapshot({ placeId: activeId, signals: cached });
      return;
    }

    setSignalSnapshot(null);
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/conditions/${encodeURIComponent(activeId)}?signals=1`, { signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error("Place intelligence unavailable");
          return response.json() as Promise<{ specialistSignals?: SpecialistSignal[] }>;
        })
        .then((payload) => {
          const signals = Array.isArray(payload.specialistSignals) ? payload.specialistSignals : [];
          signalCacheRef.current.set(activeId, signals);
          setSignalSnapshot({ placeId: activeId, signals });
        })
        .catch(() => undefined);
    }, 120);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeId]);

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
      setDiscovery(null);
      setActiveDiscoveryId("");
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

  function focusWishInput() {
    window.requestAnimationFrame(() => wishInputRef.current?.focus());
  }

  function clearOpenResults() {
    requestRef.current?.abort();
    discoveryRequestRef.current?.abort();
    setPlans(null);
    setDiscovery(null);
    setActiveId("");
    setActiveDiscoveryId("");
    setAroundOpen(false);
  }

  async function resolveTypedOrigin(value = origin.trim()) {
    const candidate = value.trim();
    if (!candidate) {
      setOriginStatus("error");
      setOriginFeedback("Enter a Michigan city or ZIP.");
      setMessage("Enter a Michigan city or ZIP, or use your current location.");
      originInputRef.current?.focus();
      return null;
    }

    originRequestRef.current?.abort();
    const controller = new AbortController();
    originRequestRef.current = controller;
    setOriginStatus("resolving");
    setOriginFeedback(`Finding ${candidate}…`);
    setMessage("");

    try {
      const response = await fetch("/api/origin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ origin: candidate }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.origin) {
        throw new Error(payload.error ?? "I could not match that to a Michigan location.");
      }
      if (originRequestRef.current !== controller) return null;

      const resolved = payload.origin as { name: string; latitude: number; longitude: number };
      const coordinates = { latitude: resolved.latitude, longitude: resolved.longitude };
      clearOpenResults();
      setOrigin(resolved.name);
      setOriginCoordinates(coordinates);
      setUserLocation(coordinates);
      setOriginStatus("resolved");
      setOriginFeedback(`Starting from ${resolved.name}`);
      setFocusPoint({
        key: `origin-${resolved.latitude}-${resolved.longitude}-${Date.now()}`,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        zoom: 7.1,
      });
      return resolved;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return null;
      if (originRequestRef.current !== controller) return null;
      const detail = error instanceof Error ? error.message : "I could not match that to a Michigan location.";
      setOriginCoordinates(undefined);
      setUserLocation(undefined);
      setOriginStatus("error");
      setOriginFeedback(detail);
      setMessage(detail);
      return null;
    } finally {
      if (originRequestRef.current === controller) {
        originRequestRef.current = null;
      }
    }
  }

  function submitOrigin(event: FormEvent) {
    event.preventDefault();
    void resolveTypedOrigin().then((resolved) => {
      if (resolved) focusWishInput();
    });
  }

  async function runDiscovery(queryOverride?: string, driveOverride = driveHours) {
    let chosenOrigin = origin.trim();
    let coordinates = originCoordinates;
    const query = (queryOverride ?? wish).trim();

    if (!chosenOrigin && !coordinates) {
      setMessage("Set a starting point first. Then describe the kind of day you want.");
      originInputRef.current?.focus();
      return;
    }
    if (query.length < 2) {
      setMessage("Describe what sounds good outside. A few words is enough.");
      wishInputRef.current?.focus();
      return;
    }

    if (!coordinates) {
      const resolved = await resolveTypedOrigin(chosenOrigin);
      if (!resolved) return;
      chosenOrigin = resolved.name;
      coordinates = { latitude: resolved.latitude, longitude: resolved.longitude };
    }

    discoveryRequestRef.current?.abort();
    requestRef.current?.abort();
    const controller = new AbortController();
    discoveryRequestRef.current = controller;
    setDiscovering(true);
    setMessage("");

    try {
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          origin: chosenOrigin || "My location",
          originCoordinates: coordinates,
          query,
          maxDriveHours: driveOverride,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !("places" in payload)) {
        throw new Error(payload.error ?? "Could not search Michigan right now.");
      }

      const result = payload as DiscoveryResponse;
      if (discoveryRequestRef.current !== controller) return;
      setDiscovery(result);
      setPlans(null);
      setActiveId("");
      setActiveDiscoveryId("");
      setUserLocation({
        latitude: result.origin.latitude,
        longitude: result.origin.longitude,
      });
      if (!result.places.length) {
        setMessage("Nothing strong matched that search inside this travel range. Try loosening the description or going farther.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (discoveryRequestRef.current !== controller) return;
      setMessage(error instanceof Error ? error.message : "Could not search Michigan right now.");
    } finally {
      if (discoveryRequestRef.current === controller) {
        discoveryRequestRef.current = null;
        setDiscovering(false);
      }
    }
  }

  function submitDiscovery(event: FormEvent) {
    event.preventDefault();
    void runDiscovery();
  }

  const activateDiscovery = useCallback((placeId: string) => {
    setActiveId("");
    setActiveDiscoveryId(placeId);
  }, []);


  function requestTrailLayer(nextLayer: UniverseLayerId) {
    setTrailLayer(nextLayer);
    setTrailRequested(true);
    if (universe.layer !== nextLayer) setUniverse(emptyUniverse(nextLayer));
  }

  const handleViewportChange = useCallback((nextViewport: MapViewport) => {
    viewportRef.current = nextViewport;
    if (nextViewport.zoom >= 6.35) setTrailRequested(true);
    if (aroundOpen) setViewport(nextViewport);
  }, [aroundOpen]);

  function toggleAround() {
    if (!aroundOpen) setViewport(viewportRef.current);
    setAroundOpen((open) => !open);
  }

  function choosePull(nextPull: Pull) {
    setPull(nextPull);
    setDriveHours(nextPull.driveHours);
    if (nextPull.id === "water" || nextPull.id === "river") requestTrailLayer("water");
    if (nextPull.id === "trail") requestTrailLayer("hiking");
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
        clearOpenResults();
        setOrigin("My location");
        setOriginCoordinates(coordinates);
        setUserLocation(coordinates);
        setOriginStatus("resolved");
        setOriginFeedback("Starting from your current location");
        setFocusPoint({
          key: `origin-device-${coordinates.latitude}-${coordinates.longitude}-${Date.now()}`,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          zoom: 7.1,
        });
        setPlanning(false);
        focusWishInput();
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
    if (discovery?.query) {
      void runDiscovery(discovery.query, next);
    } else if (origin.trim() || originCoordinates) {
      void run(pull, next);
    }
  }

  function nextIdea() {
    const candidates = plans?.plans ?? [];
    if (candidates.length < 2) return;
    const currentIndex = Math.max(0, candidates.findIndex((plan) => plan.destination.id === activeId));
    const next = candidates[(currentIndex + 1) % candidates.length];
    setActiveId(next.destination.id);
  }

  const activeDestination = destinations.find((destination) => destination.id === activeId) ?? null;
  const activeDiscovery = activeId ? null : discovery?.places.find((place) => place.id === activeDiscoveryId) ?? null;
  const activePlan = plans?.plans.find((plan) => plan.destination.id === activeId) ?? null;
  const leadPlan = plans?.plans[0] ?? null;
  const visibleSignals = signalSnapshot?.placeId === activeId ? signalSnapshot.signals : [];


  const fromHerePlaces = useMemo(() => {
    if (!activeDestination) return [];
    return destinations
      .filter((destination) => destination.id !== activeDestination.id)
      .map((destination) => ({
        destination,
        distanceMiles: haversineMiles(
          activeDestination.latitude,
          activeDestination.longitude,
          destination.latitude,
          destination.longitude,
        ),
      }))
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, 4);
  }, [activeDestination]);


  const nearbyPlaces = useMemo(
    () => {
      if (!aroundOpen) return [];
      return destinations
        .map((destination) => ({
          destination,
          distanceMiles: haversineMiles(
            viewport.latitude,
            viewport.longitude,
            destination.latitude,
            destination.longitude,
          ),
        }))
        .sort((a, b) => a.distanceMiles - b.distanceMiles)
        .slice(0, 5);
    },
    [aroundOpen, viewport.latitude, viewport.longitude],
  );

  const nearbyTrailSystems = useMemo(
    () => {
      if (!aroundOpen) return [];
      return universe.systems
        .filter(
          (system) =>
            typeof system.latitude === "number" &&
            Number.isFinite(system.latitude) &&
            typeof system.longitude === "number" &&
            Number.isFinite(system.longitude),
        )
        .map((system) => ({
          system,
          distanceMiles: haversineMiles(
            viewport.latitude,
            viewport.longitude,
            system.latitude as number,
            system.longitude as number,
          ),
        }))
        .sort((a, b) => a.distanceMiles - b.distanceMiles)
        .slice(0, 4);
    },
    [aroundOpen, universe.systems, viewport.latitude, viewport.longitude],
  );

  const nearbyLaunches = useMemo(
    () => {
      if (!aroundOpen) return [];
      return boatLaunches.geojson.features
        .map((feature) => ({
          feature,
          distanceMiles: haversineMiles(
            viewport.latitude,
            viewport.longitude,
            feature.geometry.coordinates[1],
            feature.geometry.coordinates[0],
          ),
        }))
        .sort((a, b) => a.distanceMiles - b.distanceMiles)
        .slice(0, 4);
    },
    [aroundOpen, boatLaunches.geojson.features, viewport.latitude, viewport.longitude],
  );

  function focusNearbyPoint(key: string, latitude: number, longitude: number, zoom = 9) {
    setActiveId("");
    setAroundOpen(false);
    setFocusPoint({ key, latitude, longitude, zoom });
  }

  const mapStatus = useMemo(() => {
    const pieces = [];
    if (universe.status === "live") pieces.push(`${universe.systemCount.toLocaleString()} ${universe.label.toLowerCase()}`);
    else if (!trailRequested) pieces.push("trails load as you zoom");
    if (boatLaunches.status === "live") pieces.push(`${boatLaunches.count.toLocaleString()} launches`);
    return pieces.join(" · ");
  }, [boatLaunches.count, boatLaunches.status, trailRequested, universe.label, universe.status, universe.systemCount]);

  return (
    <main className="michigan-canvas" aria-label="Explore Michigan outdoors">
      <div className="michigan-canvas-map">
        <MichiganDestinationMap
          activeId={activeId}
          destinations={destinations}
          onActivate={setActiveId}
          discoveryPlaces={discovery?.places ?? []}
          activeDiscoveryId={activeDiscoveryId}
          onDiscoveryActivate={activateDiscovery}
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
          onViewportChange={handleViewportChange}
          focusPoint={focusPoint}
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
              originRequestRef.current?.abort();
              discoveryRequestRef.current?.abort();
              setOrigin(event.target.value);
              setOriginCoordinates(undefined);
              setUserLocation(undefined);
              setOriginStatus("idle");
              setOriginFeedback("Press Set start to confirm this Michigan location.");
              setPlans(null);
              setDiscovery(null);
              setActiveId("");
              setActiveDiscoveryId("");
              setAroundOpen(false);
              setMessage("");
            }}
            placeholder="Start from a city or ZIP"
            aria-label="Starting city or ZIP"
            autoComplete="postal-code"
          />
          <button type="submit" disabled={planning || originStatus === "resolving"}>
            {originStatus === "resolving" ? "Finding" : originStatus === "resolved" ? "Change" : "Set start"}
          </button>
          <button type="button" onClick={useLocation} disabled={planning || originStatus === "resolving"} aria-label="Use my current location">◎</button>
          <span className={`canvas-origin-status canvas-origin-status-${originStatus}`} role="status" aria-live="polite">
            {originFeedback}
          </span>
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
                  onClick={() => requestTrailLayer(layer)}
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

      <section className="canvas-wish" aria-label="Describe the outdoor day you want">
        <form className="canvas-wish-form" onSubmit={submitDiscovery}>
          <div className="canvas-wish-copy">
            <span>Describe the day</span>
            <strong>What sounds good outside?</strong>
          </div>
          <div className="canvas-wish-input">
            <input
              ref={wishInputRef}
              value={wish}
              onFocus={() => {
                setActiveId("");
                setActiveDiscoveryId("");
              }}
              onChange={(event) => {
                setWish(event.target.value);
                setActiveId("");
                setActiveDiscoveryId("");
                setMessage("");
              }}
              placeholder="Quiet waterfall, short hike, not crowded…"
              aria-label="Describe the Michigan outdoor experience you want"
              maxLength={180}
            />
            <button type="submit" disabled={discovering || originStatus === "resolving"}>
              {discovering ? "Searching…" : originStatus === "resolving" ? "Finding start…" : "Find it"}
            </button>
          </div>
          <div className="canvas-wish-examples" aria-label="Example searches">
            {[
              "Wild shoreline and a short walk",
              "Brook trout water with camping nearby",
              "Quiet overlook away from crowds",
            ].map((example) => (
              <button
                type="button"
                key={example}
                onClick={() => {
                  setWish(example);
                  void runDiscovery(example);
                }}
              >
                {example}
              </button>
            ))}
          </div>
          {discovery && (
            <>
              <div className="canvas-wish-status">
                <span>
                  {discovery.places.length.toLocaleString()} possibilities · {discovery.intent.summary}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setDiscovery(null);
                    setActiveDiscoveryId("");
                  }}
                >
                  Clear
                </button>
              </div>
              {discovery.places.length > 0 && (
                <div className="canvas-wish-results" aria-label="Top outdoor possibilities">
                  {discovery.places.slice(0, 3).map((place) => (
                    <button type="button" key={place.id} onClick={() => setActiveDiscoveryId(place.id)}>
                      <strong>{place.name}</strong>
                      <small>{driveTimeLabel(place.driveHours)} · {place.categoryLabel}</small>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </form>
      </section>

      {!activeId && !activeDiscoveryId && (
        <>
          <button
            type="button"
            className="canvas-around-toggle"
            aria-expanded={aroundOpen}
            onClick={toggleAround}
          >
            <strong>Around here</strong>
            <span>Drag the map. Tap anything. Or see what is nearest.</span>
          </button>

          {aroundOpen && (
            <aside className="canvas-around-panel" aria-label="Outdoor places around the current map">
              <div className="canvas-around-head">
                <div>
                  <span>Around this map</span>
                  <strong>What is nearby?</strong>
                </div>
                <button type="button" onClick={() => setAroundOpen(false)} aria-label="Close around here">×</button>
              </div>

              <section>
                <span className="canvas-around-label">Places with full planning</span>
                <div className="canvas-around-list">
                  {nearbyPlaces.map(({ destination, distanceMiles }) => (
                    <button
                      type="button"
                      key={destination.id}
                      onClick={() => {
                        setAroundOpen(false);
                        setActiveId(destination.id);
                      }}
                    >
                      <strong>{destination.name}</strong>
                      <small>~{Math.round(distanceMiles)} mi from map center · {destination.area}</small>
                    </button>
                  ))}
                </div>
              </section>

              {nearbyTrailSystems.length > 0 && (
                <section>
                  <span className="canvas-around-label">{universe.label}</span>
                  <div className="canvas-around-list canvas-around-list-compact">
                    {nearbyTrailSystems.map(({ system, distanceMiles }) => (
                      <button
                        type="button"
                        key={`${system.name}-${system.latitude}-${system.longitude}`}
                        onClick={() =>
                          focusNearbyPoint(
                            `trail-${system.name}-${system.latitude}-${system.longitude}`,
                            system.latitude as number,
                            system.longitude as number,
                            9,
                          )
                        }
                      >
                        <strong>{system.name}</strong>
                        <small>
                          ~{Math.round(distanceMiles)} mi · {system.miles > 0 ? `${Math.round(system.miles)} mapped mi` : system.type}
                        </small>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {nearbyLaunches.length > 0 && (
                <section>
                  <span className="canvas-around-label">Public boat access</span>
                  <div className="canvas-around-list canvas-around-list-compact">
                    {nearbyLaunches.map(({ feature, distanceMiles }) => (
                      <button
                        type="button"
                        key={feature.properties.id}
                        onClick={() =>
                          focusNearbyPoint(
                            `launch-${feature.properties.id}`,
                            feature.geometry.coordinates[1],
                            feature.geometry.coordinates[0],
                            10,
                          )
                        }
                      >
                        <strong>{feature.properties.name}</strong>
                        <small>
                          ~{Math.round(distanceMiles)} mi
                          {feature.properties.waterbody ? ` · ${feature.properties.waterbody}` : ""}
                        </small>
                      </button>
                    ))}
                  </div>
                  <a className="canvas-around-all" href={BOAT_LAUNCH_FINDER}>Open all Michigan boat launches →</a>
                </section>
              )}
            </aside>
          )}
        </>
      )}

      {message && <p className="canvas-message">{message}</p>}

      {(activeDiscovery || activeDestination || activePlan) && (
        <aside className="canvas-sheet" aria-live="polite">
          <button type="button" className="canvas-sheet-close" onClick={() => { setActiveId(""); setActiveDiscoveryId(""); }} aria-label="Close place detail">×</button>

          {activeDiscovery ? (
            <>
              <p className="canvas-sheet-kicker">Found from your description · {driveTimeLabel(activeDiscovery.driveHours)} away</p>
              <h1>{activeDiscovery.name}</h1>
              <p className="canvas-sheet-area">{activeDiscovery.area} · about {activeDiscovery.distanceMiles} rough miles</p>
              <p className="canvas-sheet-summary">{activeDiscovery.why}</p>

              <div className="canvas-now">
                <span>{activeDiscovery.categoryLabel}</span>
                <strong>{discovery?.intent.summary}</strong>
                <small>{activeDiscovery.source === "OpenStreetMap" ? "Live mapped place from OpenStreetMap contributors." : "Curated Michigan Outdoors Now destination."}</small>
              </div>

              <div className="canvas-sheet-actions">
                {activeDiscovery.curatedPlaceId ? (
                  <Link href={`/places/${activeDiscovery.curatedPlaceId}`}>Open the place</Link>
                ) : activeDiscovery.website ? (
                  <a href={activeDiscovery.website} target="_blank" rel="noopener">Place website</a>
                ) : (
                  <a href={activeDiscovery.sourceUrl} target="_blank" rel="noopener">Map details</a>
                )}
                <a href={activeDiscovery.directionsUrl} target="_blank" rel="noopener">Directions</a>
              </div>

              <div className="canvas-branch">
                {driveHours < 8 && <button type="button" onClick={() => changeRange(1)}>Go farther</button>}
                {driveHours > 1 && <button type="button" onClick={() => changeRange(-1)}>Stay closer</button>}
                {(discovery?.places.length ?? 0) > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const candidates = discovery?.places ?? [];
                      const currentIndex = Math.max(0, candidates.findIndex((place) => place.id === activeDiscovery.id));
                      const next = candidates[(currentIndex + 1) % candidates.length];
                      if (next) setActiveDiscoveryId(next.id);
                    }}
                  >
                    Show another
                  </button>
                )}
              </div>

              {(discovery?.places.length ?? 0) > 1 && (
                <div className="canvas-other-picks">
                  <span>Keep wandering</span>
                  {discovery?.places
                    .filter((place) => place.id !== activeDiscovery.id)
                    .slice(0, 4)
                    .map((place) => (
                      <button type="button" key={place.id} onClick={() => setActiveDiscoveryId(place.id)}>
                        <strong>{place.name}</strong>
                        <small>{driveTimeLabel(place.driveHours)} · {place.categoryLabel}</small>
                      </button>
                    ))}
                </div>
              )}

              <p className="canvas-discovery-source">{discovery?.sourceNote}</p>
            </>
          ) : activePlan ? (
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

          {visibleSignals.length > 0 && (
            <div className="canvas-live-intelligence">
              <div className="canvas-live-intelligence-head">
                <span>Live intelligence</span>
                <strong>Other Michigan tools are adding context here.</strong>
              </div>

              <div className="canvas-live-intelligence-list">
                {visibleSignals.map((signal) => (
                  <article key={signal.id}>
                    <div className="canvas-signal-meta">
                      <span>{signal.label}</span>
                      {signal.kind === "live" && <small>Live</small>}
                    </div>
                    <strong>{signal.headline}</strong>
                    <p>{signal.detail}</p>
                    <div className="canvas-signal-links">
                      <a href={signal.toolUrl} target="_blank" rel="noopener">{signal.toolLabel} →</a>
                      <a href={signal.sourceUrl} target="_blank" rel="noopener">Source: {signal.sourceLabel}</a>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {activeDestination && fromHerePlaces.length > 0 && (
            <div className="canvas-from-here">
              <div className="canvas-from-here-head">
                <span>Keep wandering from here</span>
                <strong>Turn this into a second stop.</strong>
              </div>

              <div className="canvas-from-here-list">
                {fromHerePlaces.map(({ destination, distanceMiles }) => (
                  <button
                    type="button"
                    key={destination.id}
                    onClick={() => setActiveId(destination.id)}
                  >
                    <strong>{destination.name}</strong>
                    <small>~{Math.round(distanceMiles)} mi away · {destination.area}</small>
                  </button>
                ))}
              </div>

              <a
                className="canvas-overnight"
                href="https://www.michigan.gov/recsearch/locator"
                target="_blank"
                rel="noopener"
              >
                <span>Stay out</span>
                <strong>Find a Michigan DNR campground for the night →</strong>
              </a>
            </div>
          )}
        </aside>
      )}

      {plans && !activeId && leadPlan && (
        <button type="button" className="canvas-return-pick" onClick={() => setActiveId(leadPlan.destination.id)}>
          Return to {leadPlan.destination.name}
        </button>
      )}

      {discovery && !activeDiscoveryId && discovery.places[0] && (
        <button type="button" className="canvas-return-pick" onClick={() => setActiveDiscoveryId(discovery.places[0].id)}>
          Return to {discovery.places[0].name}
        </button>
      )}

    </main>
  );
}
