"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BoatLaunchResponse } from "../lib/boat-launches";
import type { DiscoveryPlace } from "../lib/discovery";
import type { PlaceDepthPoint, PlaceDepthResponse } from "../lib/place-depth";
import { haversineMiles } from "../lib/planner";
import { trackGrowthEvent } from "../lib/growth-analytics";

const depthGrowthContext = {
  surface: "flagship_semantic" as const,
  pageKey: "home",
};

type FocusPoint = {
  key: string;
  latitude: number;
  longitude: number;
  zoom?: number;
};

type Props = {
  place: DiscoveryPlace;
  discoveryPlaces: DiscoveryPlace[];
  boatLaunches: BoatLaunchResponse;
  onOpenDiscovery: (placeId: string) => void;
  onFocusPoint: (point: FocusPoint) => void;
};

function kindLabel(kind: PlaceDepthPoint["kind"]) {
  if (kind === "trailhead") return "Trailhead";
  if (kind === "launch") return "Mapped water access";
  if (kind === "viewpoint") return "Viewpoint";
  return "Access / parking";
}

function mileLabel(value: number) {
  if (value < 0.15) return "at this place";
  if (value < 1) return `${value.toFixed(1)} mi away`;
  return `${Math.round(value)} mi away`;
}

export function PlaceDepthPanel({
  place,
  discoveryPlaces,
  boatLaunches,
  onOpenDiscovery,
  onFocusPoint,
}: Props) {
  const [depth, setDepth] = useState<PlaceDepthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef(new Map<string, PlaceDepthResponse>());

  useEffect(() => {
    const cached = cacheRef.current.get(place.id);
    const age = cached ? Date.now() - Date.parse(cached.generatedAt) : Number.POSITIVE_INFINITY;
    if (cached && Number.isFinite(age) && age < 60 * 60 * 1000) {
      setDepth(cached);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setDepth(null);
    setLoading(true);

    fetch("/api/place-depth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        latitude: place.latitude,
        longitude: place.longitude,
        placeName: place.name,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Place depth unavailable");
        return (await response.json()) as PlaceDepthResponse;
      })
      .then((payload) => {
        cacheRef.current.set(place.id, payload);
        setDepth(payload);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDepth(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [place.id, place.latitude, place.longitude, place.name]);

  const trailheads = useMemo(
    () => depth?.points.filter((point) => point.kind === "trailhead" || point.kind === "access").slice(0, 5) ?? [],
    [depth],
  );
  const viewpoints = useMemo(
    () => depth?.points.filter((point) => point.kind === "viewpoint").slice(0, 4) ?? [],
    [depth],
  );
  const mappedWaterAccess = useMemo(
    () => depth?.points.filter((point) => point.kind === "launch").slice(0, 3) ?? [],
    [depth],
  );

  const nearbyLaunches = useMemo(() => {
    if (boatLaunches.status !== "live") return [];
    return boatLaunches.geojson.features
      .map((feature) => ({
        feature,
        distanceMiles: haversineMiles(
          place.latitude,
          place.longitude,
          feature.geometry.coordinates[1],
          feature.geometry.coordinates[0],
        ),
      }))
      .filter((item) => item.distanceMiles <= 12)
      .sort((a, b) => a.distanceMiles - b.distanceMiles)
      .slice(0, 4);
  }, [boatLaunches.geojson.features, boatLaunches.status, place.latitude, place.longitude]);

  const companions = useMemo(() => {
    return discoveryPlaces
      .filter((candidate) => candidate.id !== place.id)
      .map((candidate) => ({
        candidate,
        distanceMiles: haversineMiles(
          place.latitude,
          place.longitude,
          candidate.latitude,
          candidate.longitude,
        ),
      }))
      .filter((item) => item.distanceMiles <= 28)
      .sort((a, b) => {
        const aDifferent = a.candidate.category !== place.category ? 1 : 0;
        const bDifferent = b.candidate.category !== place.category ? 1 : 0;
        return bDifferent - aDifferent || a.distanceMiles - b.distanceMiles || b.candidate.score - a.candidate.score;
      })
      .slice(0, 4);
  }, [discoveryPlaces, place.category, place.id, place.latitude, place.longitude]);

  const depthReason = useMemo(() => {
    const parts: string[] = [];
    if (trailheads.length) {
      parts.push(`${trailheads.length} mapped way${trailheads.length === 1 ? "" : "s"} in nearby`);
    }
    if (nearbyLaunches.length) {
      parts.push(`${nearbyLaunches.length} source-qualified public launch${nearbyLaunches.length === 1 ? "" : "es"} within 12 mi`);
    } else if (mappedWaterAccess.length) {
      parts.push(`${mappedWaterAccess.length} mapped water-access lead${mappedWaterAccess.length === 1 ? "" : "s"} nearby`);
    }
    if (viewpoints.length) {
      parts.push(`${viewpoints.length} mapped viewpoint${viewpoints.length === 1 ? "" : "s"}`);
    }
    if (companions.length) {
      parts.push(`${companions.length} plausible second stop${companions.length === 1 ? "" : "s"} within 28 mi`);
    }
    return parts.join(" · ");
  }, [companions.length, mappedWaterAccess.length, nearbyLaunches.length, trailheads.length, viewpoints.length]);

  const hasDepth = trailheads.length || viewpoints.length || nearbyLaunches.length || mappedWaterAccess.length || companions.length;

  function focusDepthPoint(point: PlaceDepthPoint) {
    trackGrowthEvent("outbound_map_opened", depthGrowthContext, {
      kind: point.kind,
      source: "openstreetmap",
    });
    onFocusPoint({
      key: point.id,
      latitude: point.latitude,
      longitude: point.longitude,
      zoom: 12.2,
    });
  }

  return (
    <section className="canvas-place-depth" aria-label="Specific access and nearby stops">
      <div className="canvas-place-depth-head">
        <span>Make the stop specific</span>
        <strong>Where do I actually go?</strong>
        {loading ? (
          <small>Checking trailheads, viewpoints and mapped access around this place…</small>
        ) : depthReason ? (
          <small>{depthReason}</small>
        ) : (
          <small>Use the main place directions while deeper mapped access is unavailable.</small>
        )}
      </div>

      {hasDepth && (
        <div className="canvas-place-depth-groups">
          {trailheads.length > 0 && (
            <div className="canvas-place-depth-group">
              <span>Ways in</span>
              {trailheads.map((point) => (
                <article key={point.id}>
                  <div>
                    <strong>{point.name}</strong>
                    <small>{kindLabel(point.kind)} · {mileLabel(point.distanceMiles)}{point.detail ? ` · ${point.detail}` : ""}</small>
                  </div>
                  <div className="canvas-place-depth-actions">
                    <button type="button" onClick={() => focusDepthPoint(point)}>Map</button>
                    <a href={point.directionsUrl} target="_blank" rel="noopener">Directions</a>
                  </div>
                </article>
              ))}
            </div>
          )}

          {(nearbyLaunches.length > 0 || mappedWaterAccess.length > 0) && (
            <div className="canvas-place-depth-group">
              <span>Launch / water access</span>
              {nearbyLaunches.map(({ feature, distanceMiles }) => (
                <article key={`launch-${feature.properties.id}`}>
                  <div>
                    <strong>{feature.properties.name}</strong>
                    <small>
                      Source-qualified public launch · {mileLabel(distanceMiles)}
                      {feature.properties.waterbody ? ` · ${feature.properties.waterbody}` : ""}
                    </small>
                  </div>
                  <div className="canvas-place-depth-actions">
                    <button
                      type="button"
                      onClick={() => {
                        trackGrowthEvent("outbound_map_opened", depthGrowthContext, {
                          kind: "launch",
                          source: "qualified-launch-layer",
                        });
                        onFocusPoint({
                          key: `launch-${feature.properties.id}`,
                          latitude: feature.geometry.coordinates[1],
                          longitude: feature.geometry.coordinates[0],
                          zoom: 12.2,
                        });
                      }}
                    >
                      Map
                    </button>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${feature.geometry.coordinates[1].toFixed(6)},${feature.geometry.coordinates[0].toFixed(6)}`}
                      target="_blank"
                      rel="noopener"
                    >
                      Directions
                    </a>
                  </div>
                </article>
              ))}
              {mappedWaterAccess
                .filter(() => nearbyLaunches.length === 0)
                .map((point) => (
                  <article key={point.id}>
                    <div>
                      <strong>{point.name}</strong>
                      <small>Mapped water-access lead · {mileLabel(point.distanceMiles)}{point.detail ? ` · ${point.detail}` : ""}</small>
                    </div>
                    <div className="canvas-place-depth-actions">
                      <button type="button" onClick={() => focusDepthPoint(point)}>Map</button>
                      <a href={point.directionsUrl} target="_blank" rel="noopener">Directions</a>
                    </div>
                  </article>
                ))}
            </div>
          )}

          {viewpoints.length > 0 && (
            <div className="canvas-place-depth-group">
              <span>Look from here</span>
              {viewpoints.map((point) => (
                <article key={point.id}>
                  <div>
                    <strong>{point.name}</strong>
                    <small>Mapped viewpoint · {mileLabel(point.distanceMiles)}{point.detail ? ` · ${point.detail}` : ""}</small>
                  </div>
                  <div className="canvas-place-depth-actions">
                    <button type="button" onClick={() => focusDepthPoint(point)}>Map</button>
                    <a href={point.directionsUrl} target="_blank" rel="noopener">Directions</a>
                  </div>
                </article>
              ))}
            </div>
          )}

          {companions.length > 0 && (
            <div className="canvas-place-depth-group">
              <span>Pair it with</span>
              {companions.map(({ candidate, distanceMiles }) => (
                <article key={`companion-${candidate.id}`}>
                  <div>
                    <strong>{candidate.name}</strong>
                    <small>
                      {mileLabel(distanceMiles)} · {candidate.categoryLabel}
                      {candidate.category !== place.category ? " · a different second act" : " · nearby alternative"}
                    </small>
                  </div>
                  <div className="canvas-place-depth-actions">
                    <button
                      type="button"
                      onClick={() => {
                        trackGrowthEvent("semantic_result_opened", depthGrowthContext, {
                          fromCategory: place.category,
                          toCategory: candidate.category,
                        });
                        onOpenDiscovery(candidate.id);
                      }}
                    >
                      Open
                    </button>
                    <a href={candidate.directionsUrl} target="_blank" rel="noopener">Directions</a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {depth?.status === "live" && <p className="canvas-place-depth-source">{depth.sourceNote}</p>}
    </section>
  );
}
