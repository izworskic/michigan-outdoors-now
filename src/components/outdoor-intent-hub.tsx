"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { destinations } from "../data/destinations";
import { specialistTools } from "../data/specialist-tools";
import { selectTrailProfileForDiscovery, trailProfiles, type TrailProfile } from "../data/trail-profiles";
import { BOAT_LAUNCH_FINDER, type BoatLaunchResponse } from "../lib/boat-launches";
import type { DayPlanResponse } from "../lib/day-plan";
import type { DiscoveryPlace, DiscoveryResponse } from "../lib/discovery";
import type { PlaceIntelligence } from "../lib/place-intelligence";
import type { TrailGeometryResult } from "../lib/trail-geometry";
import { deriveTrailLiveSignal, trailEntryPointDirectionsUrl, trailheadDirectionsUrl } from "../lib/trail-live";
import { universeLayerIds, universeLayerLabels, type OutdoorUniverseResponse, type UniverseLayerId } from "../lib/outdoor-universe";
import { haversineMiles } from "../lib/planner";
import { estimateHikeTimeRange, formatHikeTimeRange, trailRouteKindLabel } from "../lib/trail-planning";
import { trackGrowthEvent, type GrowthContext } from "../lib/growth-analytics";
import {
  readMyOutdoorsProfile,
  recordRecentPlace,
  removeRememberedPlace,
  saveRememberedPlace,
  writeMyOutdoorsProfile,
  type MyOutdoorsProfile,
} from "../lib/my-outdoors";
import type { ActivityId, DateChoice, Plan, PlannerRequest, PlannerResponse, SpecialistSignal } from "../lib/types";
import { MichiganDestinationMap, type MapFocusPoint, type MapViewport } from "./michigan-destination-map";
import { MyOutdoorsDrawer } from "./my-outdoors-drawer";

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

const semanticGrowthContext: GrowthContext = {
  surface: "flagship_semantic",
  pageKey: "home",
};


function pullForProfile(profile: MyOutdoorsProfile) {
  if (profile.tripShape === "weekend") {
    return pulls.find((candidate) => candidate.id === "weekend") ?? pulls[0];
  }

  const first = profile.favoriteActivities[0];
  const id: PullId =
    first === "fishing" ? "river" :
    first === "paddling" || first === "beaches" ? "water" :
    first === "dark-sky" ? "dark" :
    first === "hiking" ? "trail" :
    profile.tripShape === "full-day" && profile.maxDriveHours >= 5 ? "long" :
    "best";
  return pulls.find((candidate) => candidate.id === id) ?? pulls[0];
}


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

function discoveryDriveLabel(place: DiscoveryPlace) {
  const prefix = place.travelSource === "routed" ? "" : "~";
  return `${prefix}${driveTimeLabel(place.driveHours)} drive`;
}

function displayTrailValue(value: string | null | undefined) {
  if (!value) return null;
  return value.replaceAll("_", " ");
}

function placeWeatherLine(intelligence: PlaceIntelligence | null) {
  const weather = intelligence?.weather;
  if (!weather) return null;
  const parts: string[] = [];
  if (weather.temperature !== null) parts.push(`${Math.round(weather.temperature)}° now`);
  if (weather.high !== null) parts.push(`high ${Math.round(weather.high)}°`);
  if (weather.precipitationProbability !== null) {
    parts.push(`${Math.round(weather.precipitationProbability)}% rain`);
  }
  if (weather.windGust !== null) parts.push(`gusts ${Math.round(weather.windGust)} mph`);
  if (weather.aqi !== null) parts.push(`AQI ${Math.round(weather.aqi)}`);
  return parts.join(" · ");
}

type DecisionArgument = {
  headline: string;
  evidence: string;
  tradeoff: string;
  alternative: DiscoveryPlace | null;
};

function firstUsefulSentence(text: string) {
  const trimmed = text.trim();
  const boundary = trimmed.search(/[.!?](?:\s|$)/);
  return boundary >= 0 ? trimmed.slice(0, boundary + 1) : trimmed;
}

function buildDecisionArgument(
  place: DiscoveryPlace,
  places: DiscoveryPlace[],
): DecisionArgument {
  const alternative =
    places
      .filter((candidate) => candidate.id !== place.id)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.driveHours - b.driveHours ||
          a.name.localeCompare(b.name),
      )[0] ?? null;

  if (!alternative) {
    return {
      headline: `Pick ${place.name} if this is the kind of day you described.`,
      evidence: firstUsefulSentence(place.why),
      tradeoff: place.curatedPlaceId
        ? "It has deeper planning coverage in Michigan Outdoors Now."
        : "It is still a mapped lead, so verify route specifics before committing.",
      alternative: null,
    };
  }

  const driveDeltaMinutes = Math.round((place.driveHours - alternative.driveHours) * 60);
  const matchAdvantage = place.score >= alternative.score + 4;
  const depthAdvantage = Boolean(place.curatedPlaceId && !alternative.curatedPlaceId);

  let tradeoff: string;
  if (driveDeltaMinutes >= 10) {
    tradeoff = `${place.name} costs about ${driveDeltaMinutes} more drive minutes than ${alternative.name}. Choose ${alternative.name} if minimizing windshield time matters more.`;
  } else if (driveDeltaMinutes <= -10) {
    tradeoff = `${place.name} saves about ${Math.abs(driveDeltaMinutes)} drive minutes versus ${alternative.name}; ${alternative.name} is the alternative if its specific setting matters more.`;
  } else {
    tradeoff = `Drive time is essentially a wash with ${alternative.name}; choose between them on the experience and confidence data.`;
  }

  return {
    headline:
      matchAdvantage || depthAdvantage
        ? `Pick ${place.name} if you want the stronger current case.`
        : `Pick ${place.name} if its specific character matters more than the alternative.`,
    evidence: [
      firstUsefulSentence(place.why),
      matchAdvantage ? "It matches the request more strongly in the current result set." : "",
      depthAdvantage ? "It also has deeper planning coverage than the alternative." : "",
    ].filter(Boolean).join(" "),
    tradeoff,
    alternative,
  };
}

function arrivalTimeLabel(place: DiscoveryPlace) {
  const minutes = place.driveMinutes ?? Math.max(1, Math.round(place.driveHours * 60));
  return new Date(Date.now() + minutes * 60_000).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function checkedAgeLabel(generatedAt: string | undefined) {
  if (!generatedAt) return "not refreshed yet";
  const ageMinutes = Math.max(0, Math.round((Date.now() - Date.parse(generatedAt)) / 60_000));
  if (!Number.isFinite(ageMinutes) || ageMinutes <= 1) return "checked just now";
  if (ageMinutes < 60) return `checked ${ageMinutes} min ago`;
  return `checked ${Math.round(ageMinutes / 60)} hr ago`;
}

function confidenceUnknowns(
  place: DiscoveryPlace,
  intelligence: PlaceIntelligence | null,
  trailProfile: TrailProfile | null,
) {
  const unknowns: string[] = [];
  if (place.travelSource !== "routed") unknowns.push("road-routed drive time");
  if (!intelligence?.weather) unknowns.push("fresh point weather");
  if (!intelligence?.trailTruth?.distanceMiles && !trailProfile?.distanceMiles) {
    unknowns.push("selected-route mileage");
  }
  if (!intelligence?.trailTruth?.difficulty && !trailProfile?.difficulty) {
    unknowns.push("route difficulty");
  }
  if (!intelligence?.trailTruth?.ascentFeet) unknowns.push("route ascent");
  return unknowns;
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
  const [kids, setKids] = useState(false);
  const [dog, setDog] = useState(false);
  const [accessible, setAccessible] = useState(false);
  const [savedPlaceIds, setSavedPlaceIds] = useState<string[]>([]);
  const [plans, setPlans] = useState<PlannerResponse | null>(null);
  const [wish, setWish] = useState("");
  const [discovery, setDiscovery] = useState<DiscoveryResponse | null>(null);
  const [discoveryRange, setDiscoveryRange] = useState<{ minDriveHours: number; maxDriveHours: number } | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [activeDiscoveryId, setActiveDiscoveryId] = useState("");
  const [comparisonPlaces, setComparisonPlaces] = useState<DiscoveryPlace[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [dismissedDiscoveryIds, setDismissedDiscoveryIds] = useState<string[]>([]);
  const [departureOpen, setDepartureOpen] = useState(false);
  const [dayPlan, setDayPlan] = useState<DayPlanResponse | null>(null);
  const [dayPlanOpen, setDayPlanOpen] = useState(false);
  const [dayPlanning, setDayPlanning] = useState(false);
  const [placeIntelligence, setPlaceIntelligence] = useState<PlaceIntelligence | null>(null);
  const [placeIntelligenceLoading, setPlaceIntelligenceLoading] = useState(false);
  const [selectedTrailProfileId, setSelectedTrailProfileId] = useState("");
  const [trailProfilesExpanded, setTrailProfilesExpanded] = useState(false);
  const [trailGeometry, setTrailGeometry] = useState<TrailGeometryResult | null>(null);
  const [trailGeometryLoading, setTrailGeometryLoading] = useState(false);
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
  const placeIntelligenceCacheRef = useRef(new Map<string, PlaceIntelligence>());
  const placeIntelligenceRequestRef = useRef<AbortController | null>(null);
  const trailGeometryRequestRef = useRef<AbortController | null>(null);
  const originInputRef = useRef<HTMLInputElement | null>(null);
  const wishInputRef = useRef<HTMLInputElement | null>(null);
  const resultDockRef = useRef<HTMLElement | null>(null);
  const resultCardRefs = useRef(new Map<string, HTMLButtonElement>());
  const myOutdoorsLoadedRef = useRef(false);

  useEffect(() => {
    if (myOutdoorsLoadedRef.current) return;
    myOutdoorsLoadedRef.current = true;
    const profile = readMyOutdoorsProfile();
    const timer = window.setTimeout(() => {
      setDriveHours(profile.maxDriveHours);
      setPull(pullForProfile(profile));
      setKids(profile.kids);
      setDog(profile.dog);
      setAccessible(profile.accessible);
      setSavedPlaceIds(profile.savedPlaces.map((place) => place.id));
      if (profile.homeOrigin) {
        setOrigin(profile.homeOrigin);
        setOriginCoordinates(undefined);
        setOriginStatus("idle");
        setOriginFeedback("Remembered from My Outdoors. Set start to refresh the exact map point.");
      }
      if (profile.homeOrigin || profile.savedPlaces.length || profile.recentPlaces.length) {
        trackGrowthEvent("my_outdoors_loaded", { surface: "homepage_planner", pageKey: "home" }, {
          hasHomeOrigin: Boolean(profile.homeOrigin),
          savedPlaceCount: profile.savedPlaces.length,
          recentPlaceCount: profile.recentPlaces.length,
          tripShape: profile.tripShape,
        });
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
    if (!discovery?.places.length) return;

    // A mobile keyboard can leave the bottom result dock outside the visual
    // viewport even though the result count at the top has updated.
    // End text entry and move focus to the actual returned result surface.
    wishInputRef.current?.blur();
    const timer = window.setTimeout(() => {
      resultDockRef.current?.focus({ preventScroll: true });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [discovery?.generatedAt, discovery?.places.length]);

  useEffect(() => {
    if (!activeDiscoveryId) return;
    const card = resultCardRefs.current.get(activeDiscoveryId);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeDiscoveryId]);

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


  useEffect(() => {
    if (!activeId) return;
    const destination = destinations.find((candidate) => candidate.id === activeId);
    if (!destination) return;
    writeMyOutdoorsProfile(
      recordRecentPlace(readMyOutdoorsProfile(), {
        id: destination.id,
        name: destination.name,
        area: destination.area,
        path: `/places/${destination.id}`,
      }),
    );
    trackGrowthEvent("my_outdoors_place_remembered", semanticGrowthContext, {
      source: "canvas_curated",
    });
  }, [activeId]);

  useEffect(() => {
    if (!activeDiscoveryId) return;
    const place = discovery?.places.find((candidate) => candidate.id === activeDiscoveryId);
    if (!place) return;
    const memoryId = place.curatedPlaceId ?? place.id;
    const path = place.curatedPlaceId
      ? `/places/${place.curatedPlaceId}`
      : place.website ?? place.sourceUrl;
    writeMyOutdoorsProfile(
      recordRecentPlace(readMyOutdoorsProfile(), {
        id: memoryId,
        name: place.name,
        area: place.area,
        path,
      }),
    );
    trackGrowthEvent("my_outdoors_place_remembered", semanticGrowthContext, {
      source: place.curatedPlaceId ? "canvas_discovery_curated" : "canvas_discovery_live",
    });
  }, [activeDiscoveryId, discovery?.places]);

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
          kids,
          dog,
          accessible,
        }),
      });

      const payload = await response.json();
      if (!response.ok || !("plans" in payload)) throw new Error(payload.error ?? "Could not compare places.");

      const result = payload as PlannerResponse;
      if (requestRef.current !== controller) return;
      setDiscovery(null);
      setDiscoveryRange(null);
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
  }, [accessible, dog, driveHours, kids, origin, originCoordinates, pull]);

  function focusWishInput() {
    window.requestAnimationFrame(() => wishInputRef.current?.focus());
  }

  function clearOpenResults() {
    requestRef.current?.abort();
    discoveryRequestRef.current?.abort();
    placeIntelligenceRequestRef.current?.abort();
    trailGeometryRequestRef.current?.abort();
    setPlaceIntelligence(null);
    setPlaceIntelligenceLoading(false);
    setSelectedTrailProfileId("");
    setTrailProfilesExpanded(false);
    setTrailGeometry(null);
    setTrailGeometryLoading(false);
    setPlans(null);
    setDiscovery(null);
    setDiscoveryRange(null);
    setActiveId("");
    setActiveDiscoveryId("");
    setComparisonPlaces([]);
    setCompareOpen(false);
    setDepartureOpen(false);
    setDayPlan(null);
    setDayPlanOpen(false);
    setDayPlanning(false);
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

  async function runDiscovery(
    queryOverride?: string,
    driveOverride = driveHours,
    minDriveOverride = 0,
    surpriseMode = false,
  ) {
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
    setCompareOpen(false);
    setDepartureOpen(false);
    setMessage("");
    trackGrowthEvent("semantic_search_started", semanticGrowthContext, {
      mode: surpriseMode ? "surprise" : "search",
      driveHours: driveOverride,
      hasMinimumBand: minDriveOverride > 0,
      queryLength: query.length,
    });

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
          ...(minDriveOverride > 0 ? { minDriveHours: minDriveOverride } : {}),
          preferences: { kids, dog, accessible },
          ...(surpriseMode ? { surpriseMode: true, excludePlaceIds: dismissedDiscoveryIds } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !("places" in payload)) {
        throw new Error(payload.error ?? "Could not search Michigan right now.");
      }

      const result = payload as DiscoveryResponse;
      if (discoveryRequestRef.current !== controller) return;
      setDiscovery(result);
      setDiscoveryRange(
        minDriveOverride > 0
          ? { minDriveHours: minDriveOverride, maxDriveHours: driveOverride }
          : null,
      );
      setPlans(null);
      setActiveId("");
      setActiveDiscoveryId("");
      setUserLocation({
        latitude: result.origin.latitude,
        longitude: result.origin.longitude,
      });
      trackGrowthEvent("semantic_search_completed", semanticGrowthContext, {
        mode: surpriseMode ? "surprise" : "search",
        resultCount: result.places.length,
        routedCount: result.places.filter((place) => place.travelSource === "routed").length,
        driveHours: driveOverride,
        hasMinimumBand: minDriveOverride > 0,
      });
      if (!result.places.length) {
        setMessage(
          minDriveOverride > 0
            ? `Nothing strong matched between ${minDriveOverride} and ${driveOverride} hours. Try the next band or return to the full range.`
            : "Nothing strong matched that search inside this travel range. Try loosening the description or going farther.",
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (discoveryRequestRef.current !== controller) return;
      trackGrowthEvent("semantic_search_failed", semanticGrowthContext, {
        mode: surpriseMode ? "surprise" : "search",
        driveHours: driveOverride,
      });
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

  function surpriseMe() {
    trackGrowthEvent("surprise_me_used", semanticGrowthContext, { driveHours });
    void runDiscovery(
      "wild quiet overlooked outdoor place worth discovering",
      driveHours,
      0,
      true,
    );
  }

  function dismissDiscoveryPlace(place: DiscoveryPlace) {
    trackGrowthEvent("surprise_rejected", semanticGrowthContext, {
      category: place.category,
      curated: Boolean(place.curatedPlaceId),
    });
    setDismissedDiscoveryIds((current) =>
      current.includes(place.id) ? current : [...current, place.id].slice(-50),
    );
    setComparisonPlaces((current) => current.filter((candidate) => candidate.id !== place.id));
    if (activeDiscoveryId === place.id) {
      placeIntelligenceRequestRef.current?.abort();
      setPlaceIntelligence(null);
      setPlaceIntelligenceLoading(false);
      setActiveDiscoveryId("");
    }
    setDiscovery((current) => {
      if (!current) return current;
      return {
        ...current,
        places: current.places.filter((candidate) => candidate.id !== place.id),
      };
    });
    setMessage("Got it. I’ll keep that one out of this session’s surprise picks.");
  }

  const loadPlaceIntelligence = useCallback((place: DiscoveryPlace) => {
    placeIntelligenceRequestRef.current?.abort();

    const cached = placeIntelligenceCacheRef.current.get(place.id);
    const cacheAgeMs = cached ? Date.now() - Date.parse(cached.generatedAt) : Number.POSITIVE_INFINITY;
    if (cached && Number.isFinite(cacheAgeMs) && cacheAgeMs < 15 * 60 * 1000) {
      setPlaceIntelligence(cached);
      setPlaceIntelligenceLoading(false);
      return;
    }
    if (cached) placeIntelligenceCacheRef.current.delete(place.id);

    const controller = new AbortController();
    placeIntelligenceRequestRef.current = controller;
    setPlaceIntelligence(null);
    setPlaceIntelligenceLoading(true);

    fetch("/api/place-intelligence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        latitude: place.latitude,
        longitude: place.longitude,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Field intelligence unavailable");
        return (await response.json()) as PlaceIntelligence;
      })
      .then((payload) => {
        if (placeIntelligenceRequestRef.current !== controller) return;
        placeIntelligenceCacheRef.current.set(place.id, payload);
        setPlaceIntelligence(payload);
      })
      .catch(() => undefined)
      .finally(() => {
        if (placeIntelligenceRequestRef.current === controller) {
          placeIntelligenceRequestRef.current = null;
          setPlaceIntelligenceLoading(false);
        }
      });
  }, []);

  const activateDiscovery = useCallback((placeId: string) => {
    const place = discovery?.places.find((candidate) => candidate.id === placeId);
    trailGeometryRequestRef.current?.abort();
    setSelectedTrailProfileId("");
    setTrailProfilesExpanded(false);
    setTrailGeometry(null);
    setTrailGeometryLoading(false);
    setActiveId("");
    setActiveDiscoveryId(placeId);
    if (place) {
      const rank = Math.max(1, (discovery?.places.findIndex((candidate) => candidate.id === place.id) ?? 0) + 1);
      const matchedTrailProfile = selectTrailProfileForDiscovery({
        destinationId: place.curatedPlaceId,
        query: discovery?.query,
        traits: discovery?.intent.traits,
      });
      trackGrowthEvent("semantic_result_opened", semanticGrowthContext, {
        rank,
        category: place.category,
        curated: Boolean(place.curatedPlaceId),
        travelSource: place.travelSource ?? "estimated",
        trailTruthProfile: Boolean(matchedTrailProfile),
      });
      loadPlaceIntelligence(place);
      setFocusPoint({
        key: `discovery-${place.id}-${Date.now()}`,
        latitude: place.latitude,
        longitude: place.longitude,
        zoom: 8.2,
      });
    }
  }, [discovery?.intent.traits, discovery?.places, discovery?.query, loadPlaceIntelligence]);


  function moveDiscoverySelection(delta: number) {
    const places = discovery?.places ?? [];
    if (!places.length) return;
    const currentIndex = Math.max(0, places.findIndex((place) => place.id === activeDiscoveryId));
    const nextIndex = (currentIndex + delta + places.length) % places.length;
    activateDiscovery(places[nextIndex].id);
  }


  function toggleSavedCanvasPlace(place: {
    id: string;
    name: string;
    area: string;
    path: string;
    kind: "curated" | "discovery";
  }) {
    const current = readMyOutdoorsProfile();
    const alreadySaved = current.savedPlaces.some((item) => item.id === place.id);
    const next = writeMyOutdoorsProfile(
      alreadySaved
        ? removeRememberedPlace(current, place.id)
        : saveRememberedPlace(current, place),
    );
    setSavedPlaceIds(next.savedPlaces.map((item) => item.id));
    trackGrowthEvent(alreadySaved ? "my_outdoors_place_unsaved" : "my_outdoors_place_saved", semanticGrowthContext, {
      source: place.kind,
    });
  }

  function discoveryMemoryPlace(place: DiscoveryPlace) {
    const id = place.curatedPlaceId ?? place.id;
    return {
      id,
      name: place.name,
      area: place.area,
      path: place.curatedPlaceId
        ? `/places/${place.curatedPlaceId}`
        : place.website ?? place.sourceUrl,
      kind: place.curatedPlaceId ? "curated" as const : "discovery" as const,
    };
  }

  function toggleComparison(place: DiscoveryPlace) {
    const alreadyKept = comparisonPlaces.some((candidate) => candidate.id === place.id);
    if (alreadyKept) {
      const next = comparisonPlaces.filter((candidate) => candidate.id !== place.id);
      setDayPlan(null);
      setDayPlanOpen(false);
      trackGrowthEvent("place_unkept", semanticGrowthContext, {
        keptCount: next.length,
        category: place.category,
      });
      setComparisonPlaces(next);
      if (!next.length) setCompareOpen(false);
      return;
    }

    if (comparisonPlaces.length >= 3) {
      setMessage("Keep up to three places at a time so the comparison stays useful.");
      return;
    }

    const nextPlaces = [...comparisonPlaces, place];
    setDayPlan(null);
    setDayPlanOpen(false);
    trackGrowthEvent("place_kept", semanticGrowthContext, {
      keptCount: nextPlaces.length,
      category: place.category,
      curated: Boolean(place.curatedPlaceId),
    });
    setComparisonPlaces(nextPlaces);
    setMessage("");
  }

  function openComparison() {
    if (!comparisonPlaces.length) return;
    trackGrowthEvent("comparison_opened", semanticGrowthContext, {
      comparedCount: comparisonPlaces.length,
    });
    setDepartureOpen(false);
    setActiveDiscoveryId("");
    setCompareOpen(true);
  }

  async function buildMyDay() {
    if (!discovery || comparisonPlaces.length < 2) {
      setMessage("Keep two or three places before building a day.");
      return;
    }

    setDayPlanning(true);
    setMessage("");

    try {
      const response = await fetch("/api/day-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: discovery.origin,
          places: comparisonPlaces.map((place) => ({
            id: place.id,
            name: place.name,
            area: place.area,
            latitude: place.latitude,
            longitude: place.longitude,
            category: place.categoryLabel,
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !("stops" in payload)) {
        throw new Error(payload.error ?? "Could not build the day.");
      }

      const result = payload as DayPlanResponse;
      setDayPlan(result);
      setCompareOpen(false);
      setDayPlanOpen(true);
      trackGrowthEvent("day_plan_built", semanticGrowthContext, {
        stopCount: result.stops.length,
        routeSource: result.source,
        totalDriveMinutes: result.totalDriveMinutes,
      });
      trackGrowthEvent("day_plan_opened", semanticGrowthContext, {
        stopCount: result.stops.length,
        routeSource: result.source,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not build the day.");
    } finally {
      setDayPlanning(false);
    }
  }

  function openDeparture() {
    if (!activeDiscoveryId) return;
    const place = discovery?.places.find((candidate) => candidate.id === activeDiscoveryId);
    trackGrowthEvent("departure_mode_opened", semanticGrowthContext, {
      category: place?.category ?? "unknown",
      curated: Boolean(place?.curatedPlaceId),
      travelSource: place?.travelSource ?? "estimated",
    });
    setCompareOpen(false);
    setAroundOpen(false);
    setDepartureOpen(true);
  }

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


  function applyMyOutdoors(profile: MyOutdoorsProfile) {
    requestRef.current?.abort();
    discoveryRequestRef.current?.abort();
    clearOpenResults();
    setPull(pullForProfile(profile));
    setDriveHours(profile.maxDriveHours);
    setKids(profile.kids);
    setDog(profile.dog);
    setAccessible(profile.accessible);
    setSavedPlaceIds(profile.savedPlaces.map((place) => place.id));
    if (profile.homeOrigin) {
      setOrigin(profile.homeOrigin);
      setOriginCoordinates(undefined);
      setUserLocation(undefined);
      setOriginStatus("idle");
      setOriginFeedback("Using your remembered starting point. It will be resolved when you search.");
    }
    setMessage("Your My Outdoors setup is loaded.");
    focusWishInput();
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
    const previousMax = driveHours;
    const next = Math.max(1, Math.min(8, driveHours + delta));
    if (next === driveHours) return;
    setDriveHours(next);
    if (discovery?.query) {
      setActiveDiscoveryId("");
      void runDiscovery(discovery.query, next, delta > 0 ? previousMax : 0);
    } else if (origin.trim() || originCoordinates) {
      void run(pull, next);
    }
  }

  function restoreInclusiveDiscovery() {
    if (!discovery?.query) return;
    setActiveDiscoveryId("");
    setDiscoveryRange(null);
    void runDiscovery(discovery.query, driveHours, 0);
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
  const activeTrailProfiles = activeDiscovery?.curatedPlaceId
    ? trailProfiles.filter((profile) => profile.destinationId === activeDiscovery.curatedPlaceId)
    : [];
  const suggestedTrailProfile = activeDiscovery
    ? selectTrailProfileForDiscovery({
        destinationId: activeDiscovery.curatedPlaceId,
        query: discovery?.query,
        traits: discovery?.intent.traits,
      })
    : null;
  const activeTrailProfile =
    activeTrailProfiles.find((profile) => profile.id === selectedTrailProfileId) ??
    suggestedTrailProfile;
  const orderedTrailProfiles = activeTrailProfile
    ? [
        activeTrailProfile,
        ...activeTrailProfiles.filter((profile) => profile.id !== activeTrailProfile.id),
      ]
    : activeTrailProfiles;
  const visibleTrailProfiles = trailProfilesExpanded
    ? orderedTrailProfiles
    : orderedTrailProfiles.slice(0, 6);
  const activeTrailTime = activeTrailProfile
    ? formatHikeTimeRange(estimateHikeTimeRange(activeTrailProfile.distanceMiles, activeTrailProfile.difficulty))
    : null;
  const activeTrailLive = activeTrailProfile && activeDiscovery
    ? deriveTrailLiveSignal(
        activeTrailProfile,
        placeIntelligence,
        activeDiscovery.driveMinutes ?? Math.round(activeDiscovery.driveHours * 60),
      )
    : null;
  const activeTrailheadAction = activeTrailProfile
    ? trailheadDirectionsUrl(activeTrailProfile, trailGeometry)
    : null;
  const decisionArgument = activeDiscovery
    ? buildDecisionArgument(activeDiscovery, discovery?.places ?? [])
    : null;
  const activeUnknowns = activeDiscovery
    ? confidenceUnknowns(activeDiscovery, placeIntelligence, activeTrailProfile)
    : [];
  const leadPlan = plans?.plans[0] ?? null;
  const visibleSignals = signalSnapshot?.placeId === activeId ? signalSnapshot.signals : [];

  useEffect(() => {
    trailGeometryRequestRef.current?.abort();
    if (!activeDiscovery || !activeTrailProfile) return;

    const controller = new AbortController();
    trailGeometryRequestRef.current = controller;
    const timer = window.setTimeout(() => {
      if (controller.signal.aborted) return;
      setTrailGeometry(null);
      setTrailGeometryLoading(true);

      fetch("/api/trail-geometry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          profileId: activeTrailProfile.id,
          latitude: activeDiscovery.latitude,
          longitude: activeDiscovery.longitude,
        }),
      })
        .then(async (response) => {
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error ?? "Trail geometry unavailable");
          return payload as TrailGeometryResult;
        })
        .then((payload) => {
          if (trailGeometryRequestRef.current !== controller) return;
          setTrailGeometry(payload);
          trackGrowthEvent("trail_truth_geometry_resolved", semanticGrowthContext, {
            profileId: activeTrailProfile.id,
            geometryStatus: payload.status,
            segmentCount: payload.segmentCount,
          });
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          if (trailGeometryRequestRef.current !== controller) return;
          setTrailGeometry(null);
        })
        .finally(() => {
          if (trailGeometryRequestRef.current === controller) {
            trailGeometryRequestRef.current = null;
            setTrailGeometryLoading(false);
          }
        });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeDiscovery, activeTrailProfile]);


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
    <main
      className={`michigan-canvas ${discovery?.places.length ? "has-discovery-results" : ""} ${activeDiscovery ? "has-active-discovery" : ""} ${departureOpen && activeDiscovery ? "has-departure" : ""}`}
      aria-label="Explore Michigan outdoors"
    >
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
          selectedTrailGeoJson={trailGeometry?.geojson ?? null}
          selectedTrailLabel={activeTrailProfile?.name}
          selectedTrailStatus={trailGeometry?.status}
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

        <div className="canvas-query-stack">
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
              setComparisonPlaces([]);
              setCompareOpen(false);
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
              <button
                type="button"
                className="canvas-surprise-trigger"
                onClick={surpriseMe}
                disabled={discovering || originStatus === "resolving"}
              >
                Surprise me · something I probably don’t know
              </button>
            </div>
            {discovery && (
              <>
                <div className="canvas-wish-status">
                  <span>
                    {discovery.places.length.toLocaleString()} possibilities · {discovery.intent.summary}
                  </span>
                  <div className="canvas-wish-status-actions">
                    {discovery.places.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          wishInputRef.current?.blur();
                          resultDockRef.current?.focus({ preventScroll: true });
                        }}
                      >
                        See results
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setDiscovery(null);
                        setDiscoveryRange(null);
                        setActiveDiscoveryId("");
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </>
            )}
          </form>
        </section>
        {message && <p className="canvas-message canvas-message-inline">{message}</p>}
        </div>

        <div className="canvas-links">
          <MyOutdoorsDrawer currentOrigin={origin} currentDriveHours={driveHours} onApply={applyMyOutdoors} />
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

      {discovery && discovery.places.length > 0 ? (
        <section
          ref={resultDockRef}
          className="canvas-result-dock"
          aria-label="Outdoor search results"
          tabIndex={-1}
        >
          <div className="canvas-result-dock-head">
            <div>
              <span>
                {discovery.mode === "surprise"
                  ? "Less-obvious Michigan"
                  : discoveryRange
                    ? "Farther-out results"
                    : `${discovery.places.length} matches`}
              </span>
              <strong>
                {discovery.mode === "surprise"
                  ? `Within ${driveHours} hr · picked for fit + novelty, not fame`
                  : discoveryRange
                    ? `${discoveryRange.minDriveHours}–${discoveryRange.maxDriveHours} hr · ${discovery.query}`
                    : `Up to ${driveHours} hr · ${discovery.query}`}
              </strong>
            </div>
            <div className="canvas-result-dock-actions">
              {comparisonPlaces.length > 0 && (
                <button type="button" onClick={openComparison}>
                  Compare {comparisonPlaces.length}
                </button>
              )}
              {discoveryRange && (
                <button type="button" onClick={restoreInclusiveDiscovery} disabled={discovering}>
                  Show all within {driveHours} hr
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setDiscovery(null);
                  setDiscoveryRange(null);
                  setActiveDiscoveryId("");
                }}
              >
                Clear
              </button>
            </div>
          </div>
          <div className="canvas-result-rail">
            {discovery.places.map((place, index) => {
              const kept = comparisonPlaces.some((candidate) => candidate.id === place.id);
              const trailProfile = selectTrailProfileForDiscovery({
                destinationId: place.curatedPlaceId,
                query: discovery.query,
                traits: discovery.intent.traits,
              });
              const trailTime = trailProfile
                ? formatHikeTimeRange(estimateHikeTimeRange(trailProfile.distanceMiles, trailProfile.difficulty))
                : null;
              return (
                <article
                  key={place.id}
                  className={`canvas-result-card ${place.id === activeDiscoveryId ? "is-active" : ""} ${kept ? "is-kept" : ""}`}
                >
                  <button
                    type="button"
                    ref={(node) => {
                      if (node) resultCardRefs.current.set(place.id, node);
                      else resultCardRefs.current.delete(place.id);
                    }}
                    className="canvas-result-card-main"
                    aria-pressed={place.id === activeDiscoveryId}
                    onClick={() => {
                      setCompareOpen(false);
                      activateDiscovery(place.id);
                    }}
                  >
                    <span className="canvas-result-rank">{String(index + 1).padStart(2, "0")}</span>
                    <strong>{place.name}</strong>
                    <span className="canvas-result-area">{place.area}</span>
                    <div className="canvas-result-facts">
                      <b>{discoveryDriveLabel(place)}</b>
                      <small>{place.travelSource === "routed" ? "Routed · " : "Estimate · "}{place.categoryLabel}</small>
                    </div>
                    {trailProfile && (
                      <div className="canvas-result-trail-truth">
                        <span>Trail Truth</span>
                        <strong>{trailProfile.name}</strong>
                        <small>
                          {[
                            `${trailProfile.distanceMiles} mi`,
                            trailRouteKindLabel(trailProfile.routeKind),
                            trailProfile.difficulty,
                            trailTime ? `${trailTime} hike estimate` : null,
                          ].filter(Boolean).join(" · ")}
                        </small>
                      </div>
                    )}
                    <p>{place.why}</p>
                  </button>
                  <div className="canvas-result-card-footer">
                    <span className={place.curatedPlaceId ? "is-deep" : "is-lead"}>
                      {place.curatedPlaceId ? "Full guide" : "Mapped lead"}
                    </span>
                    <div className="canvas-result-card-footer-actions">
                      {discovery.mode === "surprise" && (
                        <button
                          type="button"
                          className="canvas-result-dismiss"
                          onClick={() => dismissDiscoveryPlace(place)}
                        >
                          Not for me
                        </button>
                      )}
                      <button
                        type="button"
                        className="canvas-result-keep"
                        aria-pressed={kept}
                        onClick={() => toggleComparison(place)}
                      >
                        {kept ? "Kept" : "Keep to compare"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
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
      )}

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


      {departureOpen && activeDiscovery && (
        <aside className="canvas-departure" aria-label="Ready to leave" aria-live="polite">
          <div className="canvas-departure-head">
            <div>
              <span>Decision made</span>
              <strong>Get out the door.</strong>
            </div>
            <button type="button" onClick={() => setDepartureOpen(false)} aria-label="Back to place detail">×</button>
          </div>

          <div className="canvas-departure-place">
            <p>{activeDiscovery.area}</p>
            <h1>{activeDiscovery.name}</h1>
            <strong>
              {discoveryDriveLabel(activeDiscovery)}
              {" · "}
              arrive around {arrivalTimeLabel(activeDiscovery)} if you leave now
            </strong>
          </div>

          {placeIntelligence?.access.closureCount ? (
            <div className="canvas-departure-warning">
              <span>Check before leaving</span>
              <strong>
                {placeIntelligence.access.closureCount} nearby DNR closure item
                {placeIntelligence.access.closureCount === 1 ? "" : "s"}
              </strong>
              <small>{placeIntelligence.access.notes[0]}</small>
            </div>
          ) : null}

          {placeIntelligence?.goSignal && (
            <div className={`canvas-go-signal is-${placeIntelligence.goSignal.status}`}>
              <span>Current case</span>
              <strong>{placeIntelligence.goSignal.headline}</strong>
              {placeIntelligence.goSignal.cautions.length > 0 && (
                <small>{placeIntelligence.goSignal.cautions.join(" ")}</small>
              )}
            </div>
          )}

          <div className="canvas-departure-grid">
            <article>
              <span>Weather</span>
              <strong>{placeWeatherLine(placeIntelligence) ?? "Fresh weather still checking"}</strong>
            </article>
            <article>
              <span>Trail</span>
              <strong>
                {placeIntelligence?.trailTruth?.routeName ??
                  placeIntelligence?.trailSystems[0]?.name ??
                  "Exact route still needs choosing"}
              </strong>
              <small>
                {placeIntelligence?.trailTruth?.distanceMiles
                  ? `${placeIntelligence.trailTruth.distanceMiles} mi ${placeIntelligence.trailTruth.distanceSource === "osm-tag" ? "tagged route" : "mapped relation"}`
                  : placeIntelligence?.trailSystems[0]?.nearbyMappedMiles
                    ? `${placeIntelligence.trailSystems[0].nearbyMappedMiles} DNR mapped mi nearby`
                    : "Mileage not verified"}
              </small>
            </article>
            <article>
              <span>Terrain</span>
              <strong>
                {placeIntelligence?.trailTruth?.ascentFeet
                  ? `${placeIntelligence.trailTruth.ascentFeet} ft ${placeIntelligence.trailTruth.ascentSource === "osm-tag" ? "tagged" : "sampled"} ascent`
                  : placeIntelligence?.elevation
                    ? `~${placeIntelligence.elevation.rangeFeet} ft nearby elevation span`
                    : "Profile not verified"}
              </strong>
            </article>
            <article>
              <span>Access</span>
              <strong>
                {placeIntelligence?.access.rerouteCount
                  ? `${placeIntelligence.access.rerouteCount} nearby DNR reroute${placeIntelligence.access.rerouteCount === 1 ? "" : "s"}`
                  : "No nearby DNR reroute returned"}
              </strong>
            </article>
          </div>

          <div className="canvas-departure-actions">
            <a
              href={activeDiscovery.directionsUrl}
              target="_blank"
              rel="noopener"
              onClick={() => trackGrowthEvent("directions_opened", semanticGrowthContext, {
                phase: "departure",
                category: activeDiscovery.category,
              })}
            >
              Start directions
            </a>
            {activeDiscovery.curatedPlaceId ? (
              <Link href={`/places/${activeDiscovery.curatedPlaceId}`}>Open full guide</Link>
            ) : activeDiscovery.website ? (
              <a href={activeDiscovery.website} target="_blank" rel="noopener">Place website</a>
            ) : (
              <a href={activeDiscovery.sourceUrl} target="_blank" rel="noopener">Map source</a>
            )}
            <button type="button" onClick={() => setDepartureOpen(false)}>Back to decision</button>
          </div>

          <details className="canvas-departure-proof">
            <summary>Source truth</summary>
            <p>
              {activeDiscovery.travelSource === "routed" ? "Road travel is routed through OSRM. " : "Drive time is still a planning estimate. "}
              Weather, recent rain, daylight and AQI use Open-Meteo. Trail/access changes use Michigan DNR. Trail Truth uses an OpenStreetMap hiking relation when one resolves; geometry-derived mileage and sampled ascent remain explicitly estimated.
              {activeUnknowns.length ? ` Still unknown: ${activeUnknowns.join(", ")}.` : ""}
            </p>
          </details>
        </aside>
      )}

      {dayPlanOpen && dayPlan && (
        <aside className="canvas-day-plan" aria-label="Built day plan" aria-live="polite">
          <div className="canvas-day-plan-head">
            <div>
              <span>Build my day</span>
              <strong>{dayPlan.source === "routed" ? "A routed order for the places you kept." : "A fallback order while routing is unavailable."}</strong>
            </div>
            <button type="button" onClick={() => setDayPlanOpen(false)} aria-label="Close day plan">×</button>
          </div>

          <div className="canvas-day-plan-summary">
            <strong>{driveTimeLabel(dayPlan.totalDriveMinutes / 60)} total driving</strong>
            <span>{dayPlan.totalDriveMiles} {dayPlan.source === "routed" ? "road" : "rough"} mi · {dayPlan.stops.length} stops</span>
          </div>

          <ol className="canvas-day-plan-stops">
            {dayPlan.stops.map((stop) => {
              const leg = dayPlan.legs.find((candidate) => candidate.toId === stop.id);
              const sourcePlace = comparisonPlaces.find((candidate) => candidate.id === stop.id);
              return (
                <li key={stop.id}>
                  <div className="canvas-day-plan-leg">
                    <span>{stop.order === 1 ? "From your start" : "From previous stop"}</span>
                    <strong>
                      {leg ? `${driveTimeLabel(leg.driveMinutes / 60)} · ${leg.distanceMiles} mi` : "Travel unavailable"}
                    </strong>
                  </div>
                  <div className="canvas-day-plan-stop-copy">
                    <span>{stop.arrivalLabel}–{stop.leaveLabel} · ~{stop.suggestedMinutes} min there</span>
                    <h2>{stop.name}</h2>
                    <p>{stop.area}</p>
                  </div>
                  <div className="canvas-day-plan-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setDayPlanOpen(false);
                        activateDiscovery(stop.id);
                      }}
                    >
                      Open this stop
                    </button>
                    {sourcePlace && (
                      <a href={sourcePlace.directionsUrl} target="_blank" rel="noopener">Directions</a>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>

          <p className="canvas-day-plan-note">{dayPlan.note}</p>
          <div className="canvas-day-plan-footer">
            <button type="button" onClick={() => setDayPlanOpen(false)}>Back to the map</button>
            <button type="button" onClick={() => setCompareOpen(true)}>Reorder the choices</button>
          </div>
        </aside>
      )}

      {compareOpen && comparisonPlaces.length > 0 && (
        <aside className="canvas-compare" aria-label="Compare outdoor possibilities" aria-live="polite">
          <div className="canvas-compare-head">
            <div>
              <span>Decision board</span>
              <strong>Compare before you commit.</strong>
            </div>
            <button type="button" onClick={() => setCompareOpen(false)} aria-label="Close comparison">×</button>
          </div>
          {comparisonPlaces.length >= 2 && (
            <div className="canvas-compare-build">
              <button type="button" onClick={() => void buildMyDay()} disabled={dayPlanning}>
                {dayPlanning ? "Routing the day…" : "Build my day"}
              </button>
              <small>Order two or three kept places to reduce driving from your starting point.</small>
            </div>
          )}
          <div className="canvas-compare-grid">
            {comparisonPlaces.map((place) => (
              <article key={place.id}>
                <div className="canvas-compare-meta">
                  <span>{place.curatedPlaceId ? "Full guide" : "Mapped lead"}</span>
                  <small>{place.categoryLabel}</small>
                </div>
                <h2>{place.name}</h2>
                <p className="canvas-compare-area">{place.area}</p>
                <strong className="canvas-compare-drive">{discoveryDriveLabel(place)}</strong>
                <small className="canvas-compare-travel-source">
                  {place.travelSource === "routed" ? "Routed road travel" : "Planning estimate"}
                </small>
                <p>{place.why}</p>
                <div className="canvas-compare-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setCompareOpen(false);
                      activateDiscovery(place.id);
                    }}
                  >
                    View on map
                  </button>
                  <a href={place.directionsUrl} target="_blank" rel="noopener">Directions</a>
                  <button type="button" onClick={() => toggleComparison(place)}>Remove</button>
                </div>
              </article>
            ))}
          </div>
          <p className="canvas-compare-note">
            Drive times are routed where the routing service answered inside the fast budget; otherwise they remain planning estimates. “Full guide” means Michigan Outdoors Now has a curated place page; “Mapped lead” means the place came from live map data and route length, access, and current conditions still need verification.
          </p>
        </aside>
      )}

      {(activeDiscovery || activeDestination || activePlan) && (
        <aside className={`canvas-sheet ${activeDiscovery ? "canvas-sheet-discovery" : ""}`} aria-live="polite">
          <button
            type="button"
            className="canvas-sheet-close"
            onClick={() => {
              placeIntelligenceRequestRef.current?.abort();
              trailGeometryRequestRef.current?.abort();
              setPlaceIntelligence(null);
              setPlaceIntelligenceLoading(false);
              setSelectedTrailProfileId("");
              setTrailGeometry(null);
              setTrailGeometryLoading(false);
              setDepartureOpen(false);
              setActiveId("");
              setActiveDiscoveryId("");
            }}
            aria-label="Close place detail"
          >
            ×
          </button>

          {activeDiscovery ? (
            <>
              <div className="canvas-detail-nav" aria-label="Navigate search results">
                <button type="button" onClick={() => moveDiscoverySelection(-1)}>‹ Previous</button>
                <span>
                  {Math.max(1, (discovery?.places.findIndex((place) => place.id === activeDiscovery.id) ?? 0) + 1)}
                  {" of "}
                  {discovery?.places.length ?? 0}
                </span>
                <button type="button" onClick={() => moveDiscoverySelection(1)}>Next ›</button>
              </div>
              <p className="canvas-sheet-kicker">
                Found from your description · {discoveryDriveLabel(activeDiscovery)}
                {activeDiscovery.travelSource === "routed" ? " · routed" : " · estimated"}
              </p>
              <h1>{activeDiscovery.name}</h1>
              <p className="canvas-sheet-area">
                {activeDiscovery.area} · {activeDiscovery.travelSource === "routed" ? "" : "about "}{activeDiscovery.distanceMiles} {activeDiscovery.travelSource === "routed" ? "road" : "rough"} miles
              </p>
              <p className="canvas-sheet-summary">{activeDiscovery.why}</p>

              {decisionArgument && (
                <details
                  className="canvas-decision-argument"
                  onToggle={(event) => {
                    if (event.currentTarget.open) {
                      trackGrowthEvent("decision_argument_opened", semanticGrowthContext, {
                        category: activeDiscovery.category,
                      });
                    }
                  }}
                >
                  <summary>Why this one over the others?</summary>
                  <div>
                    <strong>{decisionArgument.headline}</strong>
                    <p>{decisionArgument.evidence}</p>
                    <small>{decisionArgument.tradeoff}</small>
                    {decisionArgument.alternative && (
                      <button
                        type="button"
                        onClick={() => activateDiscovery(decisionArgument.alternative!.id)}
                      >
                        Show {decisionArgument.alternative.name} instead
                      </button>
                    )}
                  </div>
                </details>
              )}

              <div className="canvas-now">
                <span>{activeDiscovery.categoryLabel}</span>
                <strong>{discovery?.intent.summary}</strong>
                <small>{activeDiscovery.source === "OpenStreetMap" ? "Live mapped place from OpenStreetMap contributors." : "Curated Michigan Outdoors Now destination."}</small>
              </div>
              {activeTrailProfiles.length > 1 && (
                <section className="canvas-trail-chooser" aria-label="Choose a trail">
                  <div className="canvas-trail-chooser-head">
                    <span>Pick your hike</span>
                    <strong>{activeTrailProfiles.length} verified routes here</strong>
                    <small>Changing the route updates Trail Truth Live, daylight fit and the highlighted map line.</small>
                  </div>
                  <div className="canvas-trail-chooser-list">
                    {visibleTrailProfiles.map((profile) => {
                      const selected = profile.id === activeTrailProfile?.id;
                      const time = formatHikeTimeRange(
                        estimateHikeTimeRange(profile.distanceMiles, profile.difficulty),
                      );
                      return (
                        <button
                          type="button"
                          key={profile.id}
                          className={selected ? "is-selected" : ""}
                          aria-pressed={selected}
                          onClick={() => {
                            setSelectedTrailProfileId(profile.id);
                            trackGrowthEvent("trail_truth_route_selected", semanticGrowthContext, {
                              profileId: profile.id,
                              destinationId: activeDiscovery.curatedPlaceId ?? "unknown",
                              distanceMiles: profile.distanceMiles,
                              difficulty: profile.difficulty,
                            });
                          }}
                        >
                          <span>{profile.name}</span>
                          <strong>
                            {profile.distanceMiles} mi · {trailRouteKindLabel(profile.routeKind)}
                          </strong>
                          <small>{profile.difficulty}{time ? ` · ${time}` : ""}</small>
                        </button>
                      );
                    })}
                  </div>
                  {activeTrailProfiles.length > 6 && (
                    <button
                      type="button"
                      className="canvas-trail-chooser-more"
                      aria-expanded={trailProfilesExpanded}
                      onClick={() => setTrailProfilesExpanded((value) => !value)}
                    >
                      {trailProfilesExpanded
                        ? "Show the best few"
                        : `Show all ${activeTrailProfiles.length} verified routes`}
                    </button>
                  )}
                </section>
              )}

              <section className="canvas-field-intelligence" aria-label="Current trip confidence">
                <div className="canvas-field-intelligence-head">
                  <span>Trip confidence</span>
                  <strong>What we know before you leave.</strong>
                  {placeIntelligenceLoading && <small>Checking weather, trail data and access…</small>}
                </div>

                {placeIntelligence && (
                  <div className={`canvas-go-signal is-${placeIntelligence.goSignal.status}`}>
                    <span>Should I go?</span>
                    <strong>{placeIntelligence.goSignal.headline}</strong>
                    {placeIntelligence.goSignal.reasons.length > 0 && (
                      <p>{placeIntelligence.goSignal.reasons.join(" ")}</p>
                    )}
                    {placeIntelligence.goSignal.cautions.length > 0 && (
                      <small>{placeIntelligence.goSignal.cautions.join(" ")}</small>
                    )}
                  </div>
                )}
                {activeTrailProfile && activeTrailLive && (
                  <div className={`canvas-trail-live is-${activeTrailLive.status}`}>
                    <span>Trail Truth Live · {activeTrailProfile.name}</span>
                    <strong>{activeTrailLive.headline}</strong>
                    {activeTrailLive.reasons.length > 0 && (
                      <p>{activeTrailLive.reasons.slice(0, 3).join(" ")}</p>
                    )}
                    {activeTrailLive.cautions.length > 0 && (
                      <small>{activeTrailLive.cautions.slice(0, 3).join(" ")}</small>
                    )}
                  </div>
                )}

                {placeIntelligence && (
                  <div className="canvas-field-intelligence-grid">
                    <article>
                      <span>Drive</span>
                      <strong>{discoveryDriveLabel(activeDiscovery)}</strong>
                      <small>{activeDiscovery.travelSource === "routed" ? "Road-routed via OSRM" : "Fallback planning estimate"}</small>
                    </article>

                    <article>
                      <span>Weather now</span>
                      <strong>{placeWeatherLine(placeIntelligence) ?? "No fresh weather returned"}</strong>
                      <small>Open-Meteo weather + air quality</small>
                    </article>

                    <article>
                      <span>Trail Truth</span>
                      {activeTrailProfile ? (
                        <>
                          <strong>{activeTrailProfile.name}</strong>
                          <small>
                            {[
                              `${activeTrailProfile.distanceMiles} mi official route`,
                              trailRouteKindLabel(activeTrailProfile.routeKind),
                              activeTrailProfile.difficulty,
                              activeTrailTime ? `${activeTrailTime} hike estimate` : null,
                              activeTrailProfile.sourceLabel,
                            ].filter(Boolean).join(" · ")}
                          </small>
                        </>
                      ) : placeIntelligence.trailTruth ? (
                        <>
                          <strong>
                            {placeIntelligence.trailTruth.routeName ?? "Mapped hiking relation"}
                          </strong>
                          <small>
                            {[
                              placeIntelligence.trailTruth.distanceMiles
                                ? `${placeIntelligence.trailTruth.distanceMiles} mi ${placeIntelligence.trailTruth.distanceSource === "osm-tag" ? "tagged route" : "mapped relation"}`
                                : null,
                              placeIntelligence.trailTruth.routeKind !== "unknown"
                                ? placeIntelligence.trailTruth.routeKind
                                : null,
                              formatHikeTimeRange(
                                estimateHikeTimeRange(
                                  placeIntelligence.trailTruth.distanceMiles,
                                  placeIntelligence.trailTruth.difficulty,
                                ),
                              )
                                ? `${formatHikeTimeRange(
                                    estimateHikeTimeRange(
                                      placeIntelligence.trailTruth.distanceMiles,
                                      placeIntelligence.trailTruth.difficulty,
                                    ),
                                  )} hike estimate`
                                : null,
                              `${placeIntelligence.trailTruth.confidence} confidence`,
                            ].filter(Boolean).join(" · ")}
                          </small>
                        </>
                      ) : placeIntelligence.trailSystems[0] ? (
                        <>
                          <strong>{placeIntelligence.trailSystems[0].name}</strong>
                          <small>
                            No selected OSM route resolved. DNR shows {placeIntelligence.trailSystems[0].nearbyMappedMiles} mapped mi in the nearby trail window.
                          </small>
                        </>
                      ) : (
                        <>
                          <strong>No route-specific trail truth returned</strong>
                          <small>Nearby source coverage may be incomplete; verify the official map before choosing a route.</small>
                        </>
                      )}
                    </article>

                    {activeTrailProfile && (
                      <article className={/older DNR|older .*description/i.test(activeTrailProfile.sourceNote) ? "has-caution" : ""}>
                        <span>
                          {/older DNR|older .*description/i.test(activeTrailProfile.sourceNote)
                            ? "Source drift"
                            : "Official route source"}
                        </span>
                        <strong>
                          {/older DNR|older .*description/i.test(activeTrailProfile.sourceNote)
                            ? "Current land-manager mileage wins"
                            : activeTrailProfile.sourceLabel}
                        </strong>
                        <small>{activeTrailProfile.sourceNote}</small>
                        <a
                          className="canvas-trailhead-link"
                          href={activeTrailProfile.sourceUrl}
                          target="_blank"
                          rel="noopener"
                        >
                          Open current route source →
                        </a>
                      </article>
                    )}

                    <article>
                      <span>Route profile</span>
                      <strong>
                        {placeIntelligence.trailTruth?.ascentFeet
                          ? `${placeIntelligence.trailTruth.ascentFeet} ft ${placeIntelligence.trailTruth.ascentSource === "osm-tag" ? "tagged" : "sampled"} ascent`
                          : placeIntelligence.elevation
                            ? `~${placeIntelligence.elevation.rangeFeet} ft nearby elevation span`
                            : "Route ascent not verified"}
                      </strong>
                      <small>
                        {[
                          placeIntelligence.trailTruth?.difficultyLabel,
                          displayTrailValue(placeIntelligence.trailTruth?.surface),
                          displayTrailValue(placeIntelligence.trailTruth?.trailVisibility),
                          placeIntelligence.trailTruth?.footAccess
                            ? `foot access: ${displayTrailValue(placeIntelligence.trailTruth.footAccess)}`
                            : null,
                        ].filter(Boolean).join(" · ") || "Difficulty/surface tags not available on the selected relation"}
                      </small>
                    </article>
                    {activeTrailProfile && (
                      <article className={activeTrailLive?.daylight.status === "insufficient" ? "has-caution" : ""}>
                        <span>Finish before dark?</span>
                        <strong>
                          {activeTrailLive?.daylight.status === "comfortable"
                            ? "Comfortable daylight margin"
                            : activeTrailLive?.daylight.status === "tight"
                              ? "Tight daylight margin"
                              : activeTrailLive?.daylight.status === "insufficient"
                                ? "Not a comfortable day-hike window"
                                : "Daylight margin unavailable"}
                        </strong>
                        <small>
                          {activeTrailLive?.daylight.headline}
                          {activeDiscovery ? ` Expected arrival around ${arrivalTimeLabel(activeDiscovery)}.` : ""}
                        </small>
                      </article>
                    )}

                    {activeTrailProfile && (
                      <article className={trailGeometry?.status === "mapped" ? "has-caution" : ""}>
                        <span>Route on map</span>
                        <strong>
                          {trailGeometryLoading
                            ? "Resolving route geometry…"
                            : trailGeometry?.status === "official"
                              ? "Official route geometry highlighted"
                              : trailGeometry?.status === "mapped"
                                ? "Mapped fallback highlighted"
                                : "Route geometry not resolved"}
                        </strong>
                        <small>
                          {trailGeometry
                            ? `${trailGeometry.sourceLabel} · ${trailGeometry.segmentCount} mapped segment${trailGeometry.segmentCount === 1 ? "" : "s"}`
                            : "Published Trail Truth mileage remains available even when geometry is not."}
                        </small>
                      </article>
                    )}

                    <article className={placeIntelligence.access.closureCount > 0 ? "has-caution" : ""}>
                      <span>Access</span>
                      <strong>
                        {placeIntelligence.access.closureCount > 0
                          ? `${placeIntelligence.access.closureCount} DNR closure item${placeIntelligence.access.closureCount === 1 ? "" : "s"} nearby`
                          : placeIntelligence.access.rerouteCount > 0
                            ? `${placeIntelligence.access.rerouteCount} DNR reroute${placeIntelligence.access.rerouteCount === 1 ? "" : "s"} nearby`
                            : "No nearby DNR closure/reroute returned"}
                      </strong>
                      <small>
                        {placeIntelligence.access.notes[0] ??
                          activeTrailProfile?.access?.parking ??
                          "Official DNR access-change layer checked within about 5 miles."}
                      </small>
                    </article>

                    {activeTrailProfile && (activeTrailProfile.access || activeTrailheadAction) && (
                      <article>
                        <span>Trailhead / route start</span>
                        <strong>
                          {activeTrailProfile.access?.trailhead ??
                            (activeTrailheadAction?.source === "official-geometry"
                              ? "Official mapped route start"
                              : activeTrailheadAction?.source === "mapped-fallback"
                                ? "Mapped route start — verify before departure"
                                : "Official access details available")}
                        </strong>
                        <small>
                          {[
                            activeTrailProfile.access?.toilets,
                            activeTrailProfile.access?.drinkingWater,
                            activeTrailProfile.access?.dogs,
                          ].filter(Boolean).join(" · ") ||
                            activeTrailProfile.access?.notes?.[0] ||
                            (activeTrailheadAction?.source === "official-geometry"
                              ? "Navigation uses the resolved land-manager trail geometry."
                              : activeTrailheadAction?.source === "mapped-fallback"
                                ? "Navigation uses a mapped fallback, not an official trailhead record."
                                : "Check the official route source before departure.")}
                        </small>
                        {activeTrailheadAction && (
                          <a
                            className="canvas-trailhead-link"
                            href={activeTrailheadAction.url}
                            target="_blank"
                            rel="noopener"
                            onClick={() =>
                              trackGrowthEvent("trailhead_directions_opened", semanticGrowthContext, {
                                profileId: activeTrailProfile.id,
                                destinationId: activeDiscovery.curatedPlaceId ?? "unknown",
                                navigationSource: activeTrailheadAction.source,
                              })
                            }
                          >
                            {activeTrailheadAction.label} →
                          </a>
                        )}
                        {activeTrailProfile.access?.entryPoints && activeTrailProfile.access.entryPoints.length > 1 && (
                          <div className="canvas-entry-points">
                            <span>Official ways in</span>
                            <div className="canvas-entry-point-list">
                              {activeTrailProfile.access.entryPoints.slice(0, 7).map((entryPoint, index) => (
                                <a
                                  key={`${activeTrailProfile.id}-entry-${index}`}
                                  href={trailEntryPointDirectionsUrl(activeTrailProfile, entryPoint)}
                                  target="_blank"
                                  rel="noopener"
                                  onClick={() =>
                                    trackGrowthEvent("trailhead_directions_opened", semanticGrowthContext, {
                                      profileId: activeTrailProfile.id,
                                      destinationId: activeDiscovery.curatedPlaceId ?? "unknown",
                                      navigationSource: "verified-entry-point",
                                      entryPointIndex: index,
                                    })
                                  }
                                >
                                  <strong>{entryPoint.name}</strong>
                                  {entryPoint.note && <small>{entryPoint.note}</small>}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        {activeTrailProfile.routeKind === "point-to-point" && (
                          <small className="canvas-point-to-point-warning">
                            Point-to-point route: plan the return, shuttle, or second vehicle before starting.
                          </small>
                        )}
                      </article>
                    )}
                  </div>
                )}

                {placeIntelligence && (
                  <p className="canvas-field-confidence-note">{placeIntelligence.confidenceNote}</p>
                )}

                <details
                  className="canvas-proof-ledger"
                  onToggle={(event) => {
                    if (event.currentTarget.open) {
                      trackGrowthEvent("proof_ledger_opened", semanticGrowthContext, {
                        category: activeDiscovery.category,
                      });
                    }
                  }}
                >
                  <summary>Why should I trust this?</summary>
                  <div className="canvas-proof-ledger-grid">
                    <span>Drive</span>
                    <strong>
                      {activeDiscovery.travelSource === "routed"
                        ? "OSRM road route"
                        : "Michigan Outdoors Now planning estimate"}
                    </strong>

                    <span>Weather</span>
                    <strong>{placeIntelligence?.weather ? "Open-Meteo point forecast + AQI" : "Not returned yet"}</strong>

                    <span>Trails / access</span>
                    <strong>
                      {placeIntelligence
                        ? "Michigan DNR nearby trail, closure and reroute layers"
                        : "Checking official Michigan DNR layers"}
                    </strong>

                    <span>Route geometry</span>
                    <strong>
                      {trailGeometry?.status === "official"
                        ? `${trailGeometry.sourceLabel} · official highlighted centerline`
                        : trailGeometry?.status === "mapped"
                          ? `${trailGeometry.sourceLabel} · mapped fallback, not official`
                          : activeTrailProfile
                            ? `${activeTrailProfile.sourceLabel} route profile · geometry unresolved`
                            : placeIntelligence?.trailTruth
                              ? `OpenStreetMap hiking relation ${placeIntelligence.trailTruth.relationId ?? ""} · ${placeIntelligence.trailTruth.confidence} confidence`
                              : "No selected route geometry"}
                    </strong>

                    <span>Freshness</span>
                    <strong>{checkedAgeLabel(placeIntelligence?.generatedAt ?? discovery?.generatedAt)}</strong>

                    <span>Still unknown</span>
                    <strong>{activeUnknowns.length ? activeUnknowns.join(" · ") : "No major field left unknown in the current data set"}</strong>
                  </div>
                </details>
              </section>

              <div className="canvas-sheet-actions">
                <button type="button" className="canvas-commit-action" onClick={openDeparture}>
                  Get me out of here
                </button>
                <button
                  type="button"
                  aria-pressed={comparisonPlaces.some((place) => place.id === activeDiscovery.id)}
                  onClick={() => toggleComparison(activeDiscovery)}
                >
                  {comparisonPlaces.some((place) => place.id === activeDiscovery.id) ? "Kept for compare" : "Keep to compare"}
                </button>
                <button
                  type="button"
                  aria-pressed={savedPlaceIds.includes(activeDiscovery.curatedPlaceId ?? activeDiscovery.id)}
                  onClick={() => toggleSavedCanvasPlace(discoveryMemoryPlace(activeDiscovery))}
                >
                  {savedPlaceIds.includes(activeDiscovery.curatedPlaceId ?? activeDiscovery.id) ? "Saved for later" : "Save for later"}
                </button>
                {activeDiscovery.curatedPlaceId ? (
                  <Link href={`/places/${activeDiscovery.curatedPlaceId}`}>Open the place</Link>
                ) : activeDiscovery.website ? (
                  <a href={activeDiscovery.website} target="_blank" rel="noopener">Place website</a>
                ) : (
                  <a href={activeDiscovery.sourceUrl} target="_blank" rel="noopener">Map details</a>
                )}
                <a
                  href={activeDiscovery.directionsUrl}
                  target="_blank"
                  rel="noopener"
                  onClick={() => trackGrowthEvent("directions_opened", semanticGrowthContext, {
                    phase: "detail",
                    category: activeDiscovery.category,
                  })}
                >
                  Directions
                </a>
              </div>

              <div className="canvas-branch">
                {driveHours < 8 && <button type="button" onClick={() => changeRange(1)}>Go farther</button>}
                {driveHours > 1 && <button type="button" onClick={() => changeRange(-1)}>Stay closer</button>}
              </div>

              <p className="canvas-discovery-source">{discovery?.sourceNote}</p>
            </>
          ) : activePlan ? (
            <>
              <p className="canvas-sheet-kicker">{pull.label} · {activePlan.travelSource === "routed" ? "" : "~"}{driveTimeLabel(activePlan.driveHours)} away</p>
              <h1>{activePlan.destination.name}</h1>
              <p className="canvas-sheet-area">{activePlan.destination.area} · {activePlan.travelSource === "routed" ? "" : "about "}{activePlan.distanceMiles} {activePlan.travelSource === "routed" ? "road" : "rough"} miles</p>
              <p className="canvas-sheet-summary">{activePlan.destination.summary}</p>

              <div className="canvas-now">
                <span>Why this one</span>
                <strong>{whyLine(activePlan)}</strong>
                <small>{weatherLine(activePlan)}</small>
              </div>

              <div className="canvas-sheet-actions">
                <Link href={`/places/${activePlan.destination.id}?date=${encodeURIComponent(activePlan.weather?.date ?? plans?.targetDate ?? "")}`}>Open the place</Link>
                <button
                  type="button"
                  aria-pressed={savedPlaceIds.includes(activePlan.destination.id)}
                  onClick={() => toggleSavedCanvasPlace({
                    id: activePlan.destination.id,
                    name: activePlan.destination.name,
                    area: activePlan.destination.area,
                    path: `/places/${activePlan.destination.id}`,
                    kind: "curated",
                  })}
                >
                  {savedPlaceIds.includes(activePlan.destination.id) ? "Saved for later" : "Save for later"}
                </button>
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
                <button
                  type="button"
                  aria-pressed={savedPlaceIds.includes(activeDestination.id)}
                  onClick={() => toggleSavedCanvasPlace({
                    id: activeDestination.id,
                    name: activeDestination.name,
                    area: activeDestination.area,
                    path: `/places/${activeDestination.id}`,
                    kind: "curated",
                  })}
                >
                  {savedPlaceIds.includes(activeDestination.id) ? "Saved for later" : "Save for later"}
                </button>
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

    </main>
  );
}
