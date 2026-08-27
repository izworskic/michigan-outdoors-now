"use client";

import { useState } from "react";
import type { DateChoice } from "../lib/types";
import {
  statewideModeLabels,
  type StatewideMode,
  type StatewideResponse,
} from "../lib/statewide";

const dateOptions: Array<{ id: DateChoice; label: string }> = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "weekend", label: "This weekend" },
];

const modeOptions: StatewideMode[] = ["best", "hiking", "scenic", "dark-sky"];

function metric(value: number | null, suffix: string) {
  return value === null ? "N/A" : `${Math.round(value)}${suffix}`;
}

export function StatewideDecisionBoard({ initial }: { initial: StatewideResponse }) {
  const [response, setResponse] = useState(initial);
  const [date, setDate] = useState<DateChoice>("today");
  const [mode, setMode] = useState<StatewideMode>("best");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function refresh(nextDate: DateChoice, nextMode: StatewideMode) {
    setDate(nextDate);
    setMode(nextMode);
    setLoading(true);
    setError("");
    try {
      const request = await fetch(`/api/statewide?date=${nextDate}&mode=${nextMode}`);
      if (!request.ok) throw new Error("Could not load the statewide decision.");
      setResponse((await request.json()) as StatewideResponse);
    } catch {
      setError("Live statewide ranking is unavailable right now. The verified specialist tools below still work.");
    } finally {
      setLoading(false);
    }
  }

  const lead = response.picks[0];
  const alternatives = response.picks.slice(1);

  return (
    <section className="live-board" aria-labelledby="live-board-title">
      <div className="live-board-head">
        <div>
          <span className="live-dot" aria-hidden="true" />
          <p>Live statewide read</p>
          <h2 id="live-board-title">Best Michigan outdoor bets</h2>
        </div>
        <a href="#planner">Personalize from where I am ↓</a>
      </div>

      <div className="decision-controls">
        <div className="decision-control-group" aria-label="Choose day">
          {dateOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={date === option.id}
              onClick={() => refresh(option.id, mode)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="decision-control-group" aria-label="Choose activity">
          {modeOptions.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              onClick={() => refresh(date, option)}
            >
              {statewideModeLabels[option]}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="decision-error" role="status">{error}</p>}

      <div className={`decision-results ${loading ? "is-loading" : ""}`} aria-live="polite">
        {lead ? (
          <>
            <article className="decision-lead">
              <div className="decision-score">
                <span>#1</span>
                <strong>{lead.score}</strong>
                <small>/100</small>
              </div>
              <div className="decision-lead-copy">
                <div className="decision-meta">
                  <span>{lead.activityLabel}</span>
                  <span>{lead.status}</span>
                  <span>{lead.confidence} confidence</span>
                </div>
                <h3>{lead.destination.name}</h3>
                <p className="decision-area">{lead.destination.area} · {lead.destination.setting}</p>
                <p className="decision-why">{lead.why}</p>
                <div className="decision-window">
                  <strong>{lead.bestWindow ? `Best window: ${lead.bestWindow}` : "Best window: check the full-day details"}</strong>
                  <span>{lead.watch}</span>
                </div>
                <div className="decision-metrics">
                  <span><small>High</small>{metric(lead.weather.high, "°")}</span>
                  <span><small>Rain</small>{metric(lead.weather.precipitationProbability, "%")}</span>
                  <span><small>Gust</small>{metric(lead.weather.windGust, " mph")}</span>
                  <span><small>AQI</small>{metric(lead.weather.aqi, "")}</span>
                </div>
                <a className="decision-cta" href={`/places/${lead.destination.id}`}>Open the full decision →</a>
              </div>
            </article>

            <div className="decision-alternatives">
              {alternatives.map((pick) => (
                <a className="decision-alt" href={`/places/${pick.destination.id}`} key={pick.destination.id}>
                  <div>
                    <span>#{pick.rank}</span>
                    <strong>{pick.score}</strong>
                  </div>
                  <h3>{pick.destination.name}</h3>
                  <p>{pick.activityLabel} · {pick.bestWindow ?? pick.status}</p>
                  <small>{pick.why}</small>
                </a>
              ))}
            </div>
          </>
        ) : (
          <div className="decision-empty">
            <h3>Live ranking is unavailable.</h3>
            <p>{response.note}</p>
          </div>
        )}
      </div>

      <p className="decision-disclaimer">
        Weather-fit ranking only. Water, ice, aurora, fish, birding, and shipping decisions use the verified specialist tools below.
      </p>
    </section>
  );
}
