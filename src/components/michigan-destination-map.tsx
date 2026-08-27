"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent, Marker as MapLibreMarker } from "maplibre-gl";
import type { UniverseGeoJson, UniverseTrailProperties } from "../lib/outdoor-universe";
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
  closuresGeoJson?: UniverseGeoJson | null;
  reroutesGeoJson?: UniverseGeoJson | null;
  closureCount?: number;
  rerouteCount?: number;
  trailLayerLabel?: string;
  userLocation?: LocationPoint;
};

const mapStyle = "https://tiles.openfreemap.org/styles/positron";
const trailSourceId = "official-dnr-trails";
const trailLayerId = "official-dnr-trails-line";
const closureSourceId = "official-dnr-closures";
const closureLayerId = "official-dnr-closures-line";
const rerouteSourceId = "official-dnr-reroutes";
const rerouteLayerId = "official-dnr-reroutes-line";

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
  closuresGeoJson,
  reroutesGeoJson,
  closureCount = 0,
  rerouteCount = 0,
  trailLayerLabel,
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
          "line-color": "#26766c",
          "line-opacity": 0.7,
          "line-width": ["interpolate", ["linear"], ["zoom"], 4.5, 1.1, 8, 2, 12, 3.6],
        },
      });
    }
    if (!map.getLayer(rerouteLayerId)) {
      map.addLayer({
        id: rerouteLayerId,
        type: "line",
        source: rerouteSourceId,
        paint: {
          "line-color": "#b46620",
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
          "line-color": "#9c3328",
          "line-opacity": 0.96,
          "line-width": ["interpolate", ["linear"], ["zoom"], 4.5, 2.8, 9, 5.4, 13, 8],
        },
      });
    }

    function accessClick(kind: "closure" | "reroute") {
      return (event: MapLayerMouseEvent) => {
        const feature = event.features?.[0];
        const properties = (feature?.properties ?? {}) as UniverseTrailProperties;
        new mapApi.Popup({ closeButton: true, maxWidth: "340px" })
          .setLngLat(event.lngLat)
          .setDOMContent(popupNode(kind, properties))
          .addTo(map);
      };
    }
    const closureClick = accessClick("closure");
    const rerouteClick = accessClick("reroute");
    const pointerOn = () => { map.getCanvas().style.cursor = "pointer"; };
    const pointerOff = () => { map.getCanvas().style.cursor = ""; };

    map.on("click", closureLayerId, closureClick);
    map.on("click", rerouteLayerId, rerouteClick);
    map.on("mouseenter", closureLayerId, pointerOn);
    map.on("mouseenter", rerouteLayerId, pointerOn);
    map.on("mouseleave", closureLayerId, pointerOff);
    map.on("mouseleave", rerouteLayerId, pointerOff);

    return () => {
      map.off("click", closureLayerId, closureClick);
      map.off("click", rerouteLayerId, rerouteClick);
      map.off("mouseenter", closureLayerId, pointerOn);
      map.off("mouseenter", rerouteLayerId, pointerOn);
      map.off("mouseleave", closureLayerId, pointerOff);
      map.off("mouseleave", rerouteLayerId, pointerOff);
    };
  }, [mapReady, trailGeoJson, closuresGeoJson, reroutesGeoJson]);

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
      element.setAttribute("aria-label", `${destination.name}, ${destination.area}. Decision-ready place.`);
      element.title = `${destination.name} · decision-ready`;
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
      <div ref={containerRef} className="destination-map" aria-label="Michigan outdoor map with decision-ready places, official DNR trails, temporary closures, and reroutes" />
      <div className="map-legend" aria-label="Map legend">
        <span><i className="map-legend-decision" />Decision ready</span>
        <span><i className="map-legend-trail" />{trailLayerLabel ?? "DNR trail"}</span>
        {closureCount > 0 && <span><i className="map-legend-closure" />Closure</span>}
        {rerouteCount > 0 && <span><i className="map-legend-reroute" />Reroute</span>}
      </div>
      {!mapReady && !mapFailed && <div className="map-loading">Loading Michigan…</div>}
      {mapFailed && (
        <div className="map-fallback" role="status">
          <strong>The map could not load.</strong>
          <span>Use Browse to inspect decision-ready places and DNR trail systems.</span>
        </div>
      )}
    </div>
  );
}
