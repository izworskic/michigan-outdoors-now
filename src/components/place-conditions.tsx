"use client";

import { useEffect, useState } from "react";
import type { WeatherSnapshot } from "../lib/types";

type ConditionsPayload = {
  targetDate: string;
  generatedAt: string;
  conditionsStatus: "live" | "estimated";
  weather: WeatherSnapshot | null;
};

type PlaceConditionsProps = {
  placeId: string;
  placeName: string;
  waterSensitive: boolean;
  darkSky: boolean;
};

function metric(value: number | null | undefined, suffix = "") {
  return value === null || value === undefined ? "—" : `${Math.round(value)}${suffix}`;
}

function conditionsNote(
  weather: WeatherSnapshot,
  waterSensitive: boolean,
  darkSky: boolean,
) {
  const notes: string[] = [];
  if ((weather.precipitationProbability ?? 0) >= 60) notes.push("Keep a rain backup ready");
  if ((weather.windGust ?? 0) >= 28) notes.push("Expect exposed areas to feel gusty");
  if (waterSensitive && (weather.windGust ?? 0) >= 25) notes.push("Check waves and the marine forecast before water activity");
  if (darkSky && (weather.cloudCover ?? 0) >= 60) notes.push("Clouds may limit night-sky viewing");
  if ((weather.aqi ?? 0) > 100) notes.push("Air quality may affect sensitive groups");
  return notes.length ? `${notes.join(". ")}.` : "The broad signals look workable, but local conditions and official alerts still decide the day.";
}

export function PlaceConditions({
  placeId,
  placeName,
  waterSensitive,
  darkSky,
}: PlaceConditionsProps) {
  const [payload, setPayload] = useState<ConditionsPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/conditions/${encodeURIComponent(placeId)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Conditions unavailable");
        return (await response.json()) as ConditionsPayload;
      })
      .then(setPayload)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      });
    return () => controller.abort();
  }, [placeId]);

  return (
    <section className="place-conditions" aria-labelledby="place-conditions-title">
      <div className="place-conditions-heading">
        <div>
          <p className="eyebrow">Today at a glance</p>
          <h2 id="place-conditions-title">Planning signals for {placeName}</h2>
        </div>
        <span>{payload?.conditionsStatus === "live" ? "Live forecast" : "Planning check"}</span>
      </div>

      {!payload && !failed && <p className="conditions-loading" aria-live="polite">Checking today’s forecast and air quality…</p>}
      {failed && (
        <div className="conditions-fallback">
          <strong>Live conditions are temporarily unavailable.</strong>
          <p>Use the official destination page and a local weather or marine source before leaving.</p>
        </div>
      )}
      {payload && !payload.weather && (
        <div className="conditions-fallback">
          <strong>No live snapshot was returned.</strong>
          <p>The destination information below still works; verify today’s conditions separately.</p>
        </div>
      )}
      {payload?.weather && (
        <>
          <div className="condition-metrics">
            <div><span>High / low</span><strong>{metric(payload.weather.high, "°")} / {metric(payload.weather.low, "°")}</strong></div>
            <div><span>Rain chance</span><strong>{metric(payload.weather.precipitationProbability, "%")}</strong></div>
            <div><span>Peak gusts</span><strong>{metric(payload.weather.windGust, " mph")}</strong></div>
            <div><span>Air quality</span><strong>{metric(payload.weather.aqi, " AQI")}</strong></div>
            {darkSky && <div><span>Cloud cover</span><strong>{metric(payload.weather.cloudCover, "%")}</strong></div>}
          </div>
          <p className="conditions-advice">{conditionsNote(payload.weather, waterSensitive, darkSky)}</p>
          <p className="conditions-updated">Forecast date {payload.targetDate} · Conditions are context, never a safety rating.</p>
        </>
      )}
    </section>
  );
}
