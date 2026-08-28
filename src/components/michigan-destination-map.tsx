"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Marker as MapLibreMarker } from "maplibre-gl";
import { BOAT_LAUNCH_FINDER, type BoatLaunchGeoJson } from "../lib/boat-launches";
import type { UniverseGeoJson, UniverseTrailProperties, UniverseTrailSystem } from "../lib/outdoor-universe";
import type { Destination } from "../lib/types";

type LocationPoint = {
  latitude: number;
  longitude: number;
};

type MichiganDestinationMapProps = {
  activeId: string;
  destinations: Destination[];
  onActivate: (destinationId: string) => void;
  trailGeoJson?: UniverseGeoJson | null;
  trailSystems?: UniverseTrailSystem[];
  closuresGeoJson?: UniverseGeoJson | null;
  reroutesGeoJson?: UniverseGeoJson | null;
  closureCount?: number;
  rerouteCount?: number;
  trailLayerLabel?: string;
  boatLaunchGeoJson?: BoatLaunchGeoJson | null;
  boatLaunchCount?: number;
  userLocation?: LocationPoint;
};

const mapStyle = "https://tiles.openfreemap.org/styles/positron";
const trailSourceId = "official-dnr-trails";
const trailLayerId = "official-dnr-trails-line";
const trailSystemSourceId = "official-dnr-trail-systems";
const trailSystemLayerId = "official-dnr-trail-systems-point";
const closureSourceId = "official-dnr-closures";
const closureLayerId = "official-dnr-closures-line";
const rerouteSourceId = "official-dnr-reroutes";
const rerouteLayerId = "official-dnr-reroutes-line";
const boatLaunchSourceId = "michigan-boat-launches";
const boatLaunchClusterLayerId = "michigan-boat-launch-clusters";
const boatLaunchClusterCountLayerId = "michigan-boat-launch-cluster-count";
const boatLaunchPointLayerId = "michigan-boat-launch-points";

function emptyCollection(): UniverseGeoJson {
  return { type: "FeatureCollection", features: [] };
}

function popupNode(kind: "closure" | "reroute", properties: UniverseTrailProperties) {
  const node = document.createElement("div");
  node.className = "access-popup";

  const eyebrow = document.createElement("span");
  eyebrow.textContent = kind === "closure" ? "Michigan DNR temporary closure" : "Michigan DNR temporary reroute";

  const title = document.createElement("strong");
  title.textContent = properties.TrailNamePrimary || "Trail access update";

  const detail = document.createElement("p");
  detail.textContent =
    properties.PublicComments ||
    (kind === "closure"
      ? "This segment is included in the DNR temporary-closure layer. Verify current status before leaving."
      : "This segment is included in the DNR temporary-reroute layer. Follow current posted routing.");

  node.append(eyebrow, title, detail);
  return node;
}

export function MichiganDestinationMap({
  activeId,
  destinations,
  onActivate,
  trailGeoJson,
  trailSystems = [],
  closuresGeoJson,
  reroutesGeoJson,
  closureCount = 0,
  rerouteCount = 0,
  trailLayerLabel,
  boatLaunchGeoJson,
  boatLaunchCount = 0,
  userLocation,
}: MichiganDestinationMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapApiRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markerByIdRef = useRef(new Map<string, { marker: MapLibreMarker; element: HTMLButtonElement }>());
  const userMarkerRef = useRef<MapLibreMarker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    let loadTimer = 0;
    const markerById = markerByIdRef.current;

    async function startMap() {
      try {
        const mapApi = await import("maplibre-gl");
        if (!mounted || !containerRef.current) return;

        mapApiRef.current = mapApi;
        const map = new mapApi.Map({
          container: containerRef.current,
          style: mapStyle,
          center: [-85.45, 44.7],
          zoom: 5.25,
          minZoom: 4.5,
          maxZoom: 14,
          maxBounds: [[-91.5, 40.3], [-80.3, 49.5]],
          attributionControl: { compact: true },
        });
        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();
        map.addControl(new mapApi.NavigationControl({ showCompass: false }), "bottom-right");
        map.once("load", () => {
          if (!mounted) return;
          window.clearTimeout(loadTimer);
          setMapFailed(false);
          setMapReady(true);
        });
        mapRef.current = map;
        loadTimer = window.setTimeout(() => {
          if (mounted && !map.loaded()) setMapFailed(true);
        }, 12_000);
      } catch {
        if (mounted) setMapFailed(true);
      }
    }

    void startMap();
    return () => {
      mounted = false;
      window.clearTimeout(loadTimer);
      markerById.clear();
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      mapApiRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const mapApi = mapApiRef.current;
    if (!mapReady || !map || !mapApi) return;

    const sources: Array<[string, UniverseGeoJson | null | undefined]> = [
      [trailSourceId, trailGeoJson],
      [closureSourceId, closuresGeoJson],
      [rerouteSourceId, reroutesGeoJson],
    ];
    for (const [sourceId, sourceData] of sources) {
      const data = sourceData ?? emptyCollection();
      const existing = map.getSource(sourceId) as GeoJSONSource | undefined;
      if (existing) existing.setData(data as never);
      else map.addSource(sourceId, { type: "geojson", data: data as never });
    }

    if (!map.getLayer(trailLayerId)) {
      map.addLayer({
        id: trailLayerId,
        type: "line",
        source: trailSourceId,
        paint: {
          "line-color": "#477f91",
          "line-opacity": 0.62,
          "line-width": ["interpolate", ["linear"], ["zoom"], 4.5, 2.4, 8, 4.2, 12, 6.2],
        },
      });
    }

    const trailSystemData = {
      type: "FeatureCollection" as const,
      features: trailSystems
        .filter(
          (system) =>
            typeof system.longitude === "number" &&
            Number.isFinite(system.longitude) &&
            typeof system.latitude === "number" &&
            Number.isFinite(system.latitude),
        )
        .map((system) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [system.longitude as number, system.latitude as number],
          },
          properties: {
            name: system.name,
            type: system.type,
            unit: system.unit ?? "",
            miles: system.miles,
            segments: system.segments,
          },
        })),
    };
    const existingSystemSource = map.getSource(trailSystemSourceId) as GeoJSONSource | undefined;
    if (existingSystemSource) existingSystemSource.setData(trailSystemData as never);
    else map.addSource(trailSystemSourceId, { type: "geojson", data: trailSystemData as never });

    if (!map.getLayer(trailSystemLayerId)) {
      map.addLayer({
        id: trailSystemLayerId,
        type: "circle",
        source: trailSystemSourceId,
        paint: {
          "circle-color": "#315f7a",
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 4.5, 0.72, 8, 0.88],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 4.5, 6, 8, 8, 12, 10],
          "circle-stroke-color": "rgba(255,255,255,.95)",
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 4.5, 1.2, 9, 1.8],
        },
      });
    }

    const launchData = boatLaunchGeoJson ?? { type: "FeatureCollection" as const, features: [] };
    const existingBoatSource = map.getSource(boatLaunchSourceId) as GeoJSONSource | undefined;
    if (existingBoatSource) existingBoatSource.setData(launchData as never);
    else {
      map.addSource(boatLaunchSourceId, {
        type: "geojson",
        data: launchData as never,
        cluster: true,
        clusterMaxZoom: 10,
        clusterRadius: 46,
      });
    }

    if (!map.getLayer(boatLaunchClusterLayerId)) {
      map.addLayer({
        id: boatLaunchClusterLayerId,
        type: "circle",
        source: boatLaunchSourceId,
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#8fb8c6", 25, "#5f93a5", 100, "#315f7a"],
          "circle-opacity": 0.88,
          "circle-radius": ["step", ["get", "point_count"], 13, 25, 17, 100, 22],
          "circle-stroke-color": "rgba(255,255,255,.9)",
          "circle-stroke-width": 1.2,
        },
      });
    }
    if (!map.getLayer(boatLaunchClusterCountLayerId)) {
      map.addLayer({
        id: boatLaunchClusterCountLayerId,
        type: "symbol",
        source: boatLaunchSourceId,
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-size": 10,
        },
        paint: { "text-color": "#132b3a" },
      });
    }
    if (!map.getLayer(boatLaunchPointLayerId)) {
      map.addLayer({
        id: boatLaunchPointLayerId,
        type: "circle",
        source: boatLaunchSourceId,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": "#b96d45",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 6, 6, 10, 8, 13, 10],
          "circle-stroke-color": "rgba(255,255,255,.98)",
          "circle-stroke-width": 1.5,
        },
      });
    }

    if (!map.getLayer(rerouteLayerId)) {
      map.addLayer({
        id: rerouteLayerId,
        type: "line",
        source: rerouteSourceId,
        paint: {
          "line-color": "#a86a45",
          "line-opacity": 0.96,
          "line-width": ["interpolate", ["linear"], ["zoom"], 4.5, 2.2, 9, 4.2, 13, 6],
          "line-dasharray": [1.5, 1.4],
        },
      });
    }
    if (!map.getLayer(closureLayerId)) {
      map.addLayer({
        id: closureLayerId,
        type: "line",
        source: closureSourceId,
        paint: {
          "line-color": "#9b4b43",
          "line-opacity": 0.96,
          "line-width": ["interpolate", ["linear"], ["zoom"], 4.5, 2.8, 9, 5.4, 13, 8],
        },
      });
    }

    const api = mapApi;
    const activeMap = map;

    const trailClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const properties = (feature?.properties ?? {}) as UniverseTrailProperties;
      const node = document.createElement("div");
      node.className = "trail-system-popup";

      const eyebrow = document.createElement("span");
      eyebrow.textContent = trailLayerLabel || "Michigan DNR trail";

      const title = document.createElement("strong");
      title.textContent = properties.Name || properties.TrailNamePrimary || "Mapped DNR trail";

      const detail = document.createElement("p");
      const miles = Number(properties.SegmentLengthMiles ?? 0);
      detail.textContent = [
        properties.TrailType || "",
        properties.PRDTrailUnit || "",
        miles > 0 ? `${miles.toFixed(miles >= 10 ? 0 : 1)} mi mapped segment` : "",
      ].filter(Boolean).join(" · ");

      const note = document.createElement("small");
      note.textContent = "Tap other segments or switch Layers to explore another official DNR trail network.";

      node.append(eyebrow, title, detail, note);
      new api.Popup({ closeButton: true, maxWidth: "340px" })
        .setLngLat(event.lngLat)
        .setDOMContent(node)
        .addTo(activeMap);
    };

    const trailSystemClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const properties = (feature?.properties ?? {}) as {
        name?: string;
        type?: string;
        unit?: string;
        miles?: number | string;
        segments?: number | string;
      };
      const node = document.createElement("div");
      node.className = "trail-system-popup";
      const eyebrow = document.createElement("span");
      eyebrow.textContent = "Michigan DNR trail system";
      const title = document.createElement("strong");
      title.textContent = properties.name || "Mapped trail system";
      const detail = document.createElement("p");
      const miles = Number(properties.miles ?? 0);
      const segments = Number(properties.segments ?? 0);
      detail.textContent = [
        properties.type || "Trail",
        properties.unit || "",
        miles > 0 ? `${miles.toLocaleString()} mapped mi` : "",
        segments > 0 ? `${segments.toLocaleString()} segment${segments === 1 ? "" : "s"}` : "",
      ].filter(Boolean).join(" · ");
      const note = document.createElement("small");
      note.textContent = "Map anchor for the trail network, not a trailhead. Zoom in to follow the mapped route.";
      node.append(eyebrow, title, detail, note);
      new api.Popup({ closeButton: true, maxWidth: "340px" })
        .setLngLat(event.lngLat)
        .setDOMContent(node)
        .addTo(activeMap);
    };


    const boatClusterClick = (event: MapLayerMouseEvent) => {
      activeMap.flyTo({
        center: event.lngLat,
        zoom: Math.min(activeMap.getZoom() + 2, 11),
        duration: 360,
      });
    };

    const boatLaunchClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const properties = (feature?.properties ?? {}) as {
        id?: string;
        name?: string;
        waterbody?: string;
        county?: string;
        launchStatus?: string;
        lanes?: number | string | null;
        trailerParking?: number | string | null;
        piers?: number | string | null;
        carryDown?: boolean | string;
      };
      const node = document.createElement("div");
      node.className = "boat-launch-popup";

      const eyebrow = document.createElement("span");
      eyebrow.textContent = "Public boat access";
      const title = document.createElement("strong");
      title.textContent = properties.name || "Michigan boat launch";

      const detail = document.createElement("p");
      detail.textContent = [
        properties.waterbody || "",
        properties.county ? properties.county + " County" : "",
        properties.launchStatus || "",
      ].filter(Boolean).join(" · ");

      const facts = document.createElement("small");
      const lanes = Number(properties.lanes ?? 0);
      const parking = Number(properties.trailerParking ?? 0);
      const piers = Number(properties.piers ?? 0);
      facts.textContent = [
        lanes > 0 ? lanes + " lane" + (lanes === 1 ? "" : "s") : "",
        parking > 0 ? parking + " trailer spaces" : "",
        piers > 0 ? piers + " pier" + (piers === 1 ? "" : "s") : "",
        properties.carryDown === true || properties.carryDown === "true" ? "carry-down access" : "",
      ].filter(Boolean).join(" · ") || "Facility details vary by source record.";

      const link = document.createElement("a");
      link.href = BOAT_LAUNCH_FINDER;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Open Michigan Boat Launches →";

      node.append(eyebrow, title, detail, facts, link);
      new api.Popup({ closeButton: true, maxWidth: "350px" })
        .setLngLat(event.lngLat)
        .setDOMContent(node)
        .addTo(activeMap);
    };

    function accessClick(kind: "closure" | "reroute") {
      return (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const properties = (feature?.properties ?? {}) as UniverseTrailProperties;
        new api.Popup({ closeButton: true, maxWidth: "340px" })
          .setLngLat(event.lngLat)
          .setDOMContent(popupNode(kind, properties))
          .addTo(activeMap);
      };
    }
    const closureClick = accessClick("closure");
    const rerouteClick = accessClick("reroute");
    const pointerOn = () => { activeMap.getCanvas().style.cursor = "pointer"; };
    const pointerOff = () => { activeMap.getCanvas().style.cursor = ""; };

    activeMap.on("click", trailLayerId, trailClick);
    activeMap.on("click", trailSystemLayerId, trailSystemClick);
    activeMap.on("click", boatLaunchClusterLayerId, boatClusterClick);
    activeMap.on("click", boatLaunchPointLayerId, boatLaunchClick);
    activeMap.on("click", closureLayerId, closureClick);
    activeMap.on("click", rerouteLayerId, rerouteClick);
    activeMap.on("mouseenter", trailLayerId, pointerOn);
    activeMap.on("mouseenter", trailSystemLayerId, pointerOn);
    activeMap.on("mouseenter", boatLaunchClusterLayerId, pointerOn);
    activeMap.on("mouseenter", boatLaunchPointLayerId, pointerOn);
    activeMap.on("mouseenter", closureLayerId, pointerOn);
    activeMap.on("mouseenter", rerouteLayerId, pointerOn);
    activeMap.on("mouseleave", trailLayerId, pointerOff);
    activeMap.on("mouseleave", trailSystemLayerId, pointerOff);
    activeMap.on("mouseleave", boatLaunchClusterLayerId, pointerOff);
    activeMap.on("mouseleave", boatLaunchPointLayerId, pointerOff);
    activeMap.on("mouseleave", closureLayerId, pointerOff);
    activeMap.on("mouseleave", rerouteLayerId, pointerOff);

    return () => {
      activeMap.off("click", trailLayerId, trailClick);
      activeMap.off("click", trailSystemLayerId, trailSystemClick);
      activeMap.off("click", boatLaunchClusterLayerId, boatClusterClick);
      activeMap.off("click", boatLaunchPointLayerId, boatLaunchClick);
      activeMap.off("click", closureLayerId, closureClick);
      activeMap.off("click", rerouteLayerId, rerouteClick);
      activeMap.off("mouseenter", trailLayerId, pointerOn);
      activeMap.off("mouseenter", trailSystemLayerId, pointerOn);
      activeMap.off("mouseenter", boatLaunchClusterLayerId, pointerOn);
      activeMap.off("mouseenter", boatLaunchPointLayerId, pointerOn);
      activeMap.off("mouseenter", closureLayerId, pointerOn);
      activeMap.off("mouseenter", rerouteLayerId, pointerOn);
      activeMap.off("mouseleave", trailLayerId, pointerOff);
      activeMap.off("mouseleave", trailSystemLayerId, pointerOff);
      activeMap.off("mouseleave", boatLaunchClusterLayerId, pointerOff);
      activeMap.off("mouseleave", boatLaunchPointLayerId, pointerOff);
      activeMap.off("mouseleave", closureLayerId, pointerOff);
      activeMap.off("mouseleave", rerouteLayerId, pointerOff);
    };
  }, [mapReady, trailGeoJson, trailSystems, closuresGeoJson, reroutesGeoJson, boatLaunchGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    const mapApi = mapApiRef.current;
    if (!mapReady || !map || !mapApi) return;

    markerByIdRef.current.forEach(({ marker }) => marker.remove());
    markerByIdRef.current.clear();

    const bounds = new mapApi.LngLatBounds();
    destinations.forEach((destination) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "destination-pin destination-pin-decision";
      element.setAttribute("aria-label", `${destination.name}, ${destination.area}. Full trip-planning place.`);
      element.title = `${destination.name} · full trip planning`;
      element.addEventListener("click", () => onActivate(destination.id));

      const marker = new mapApi.Marker({ element, anchor: "center" })
        .setLngLat([destination.longitude, destination.latitude])
        .addTo(map);
      markerByIdRef.current.set(destination.id, { marker, element });
      bounds.extend([destination.longitude, destination.latitude]);
    });

    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 54, maxZoom: 7, duration: 450 });
  }, [destinations, mapReady, onActivate]);

  useEffect(() => {
    markerByIdRef.current.forEach(({ element }, destinationId) => {
      element.dataset.active = String(destinationId === activeId);
    });
    if (!activeId) return;

    const selected = destinations.find((destination) => destination.id === activeId);
    if (selected) {
      mapRef.current?.flyTo({
        center: [selected.longitude, selected.latitude],
        zoom: Math.max(mapRef.current.getZoom(), 7),
        duration: 420,
      });
    }
  }, [activeId, destinations]);

  useEffect(() => {
    const map = mapRef.current;
    const mapApi = mapApiRef.current;
    if (!mapReady || !map || !mapApi) return;

    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    if (!userLocation) return;

    const element = document.createElement("div");
    element.className = "user-location-pin";
    element.setAttribute("aria-label", "Your approximate location");
    const marker = new mapApi.Marker({ element, anchor: "center" })
      .setLngLat([userLocation.longitude, userLocation.latitude])
      .addTo(map);
    userMarkerRef.current = marker;
    map.flyTo({ center: [userLocation.longitude, userLocation.latitude], zoom: 7, duration: 450 });
  }, [mapReady, userLocation]);

  return (
    <div className="destination-map-frame">
      <div ref={containerRef} className="destination-map" aria-label="Michigan outdoor map with full-planning places, statewide DNR trails, public boat launches, temporary closures, and reroutes" />
      <div className="map-legend" aria-label="Map legend">
        <span><i className="map-legend-decision" />Full trip planning</span>
        <span><i className="map-legend-system" />Trail system</span>
        <span><i className="map-legend-trail" />{trailLayerLabel ?? "DNR trail route"}</span>
        {boatLaunchCount > 0 && <span><i className="map-legend-launch" />Boat launch</span>}
        {closureCount > 0 && <span><i className="map-legend-closure" />Closure</span>}
        {rerouteCount > 0 && <span><i className="map-legend-reroute" />Reroute</span>}
      </div>
      {!mapReady && !mapFailed && <div className="map-loading">Loading Michigan…</div>}
      {mapFailed && (
        <div className="map-fallback" role="status">
          <strong>The map could not load.</strong>
          <span>Use Browse to inspect full-planning places and statewide DNR trail systems.</span>
        </div>
      )}
    </div>
  );
}
