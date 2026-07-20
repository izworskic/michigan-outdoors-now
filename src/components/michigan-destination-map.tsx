"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";
import type { Destination } from "../lib/types";

type LocationPoint = {
  latitude: number;
  longitude: number;
};

type MichiganDestinationMapProps = {
  activeId: string;
  destinations: Destination[];
  onActivate: (destinationId: string) => void;
  userLocation?: LocationPoint;
};

const mapStyle = "https://tiles.openfreemap.org/styles/positron";

export function MichiganDestinationMap({
  activeId,
  destinations,
  onActivate,
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
          maxZoom: 13,
          maxBounds: [[-91.5, 40.3], [-80.3, 49.5]],
          attributionControl: { compact: true },
        });
        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();
        map.addControl(new mapApi.NavigationControl({ showCompass: false }), "top-right");
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

    markerByIdRef.current.forEach(({ marker }) => marker.remove());
    markerByIdRef.current.clear();

    const bounds = new mapApi.LngLatBounds();
    destinations.forEach((destination, index) => {
      const element = document.createElement("button");
      element.type = "button";
      element.className = "destination-pin";
      element.textContent = String(index + 1);
      element.setAttribute("aria-label", `${destination.name}, ${destination.area}`);
      element.title = destination.name;
      element.addEventListener("click", () => onActivate(destination.id));

      const marker = new mapApi.Marker({ element, anchor: "center" })
        .setLngLat([destination.longitude, destination.latitude])
        .addTo(map);
      markerByIdRef.current.set(destination.id, { marker, element });
      bounds.extend([destination.longitude, destination.latitude]);
    });

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 48, maxZoom: 7, duration: 500 });
    }
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
        duration: 450,
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
    map.flyTo({ center: [userLocation.longitude, userLocation.latitude], zoom: 6.6, duration: 500 });
  }, [mapReady, userLocation]);

  return (
    <div className="destination-map-frame">
      <div ref={containerRef} className="destination-map" aria-label="Zoomable map of matching Michigan outdoor destinations" />
      {!mapReady && !mapFailed && <div className="map-loading">Loading the Michigan map…</div>}
      {mapFailed && (
        <div className="map-fallback" role="status">
          <strong>The map could not load.</strong>
          <span>Switch to List to keep browsing every place.</span>
        </div>
      )}
    </div>
  );
}
