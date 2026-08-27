"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { specialistTools } from "../data/specialist-tools";
import type { StatewideMode, StatewideResponse } from "../lib/statewide";
import type { ActivityId, DateChoice, PlannerResponse } from "../lib/types";

type IntentId = "today" | "weekend" | "place" | "activity";

type PlaceOption = {
  id: string;
  name: string;
  area: string;
  summary: string;
  activities: ActivityId[];
};

const intents: Array<{ id: IntentId; eyebrow: string; title: string; detail: string }> = [
  { id: "today", eyebrow: "Right now", title: "I want to get outside today", detail: "Show me the strongest options and the best time to go." },
  { id: "weekend", eyebrow: "Plan ahead", title: "Help me plan this weekend", detail: "Show me what is worth the drive, plus a backup." },
  { id: "place", eyebrow: "I have an idea", title: "I already know the place", detail: "Check the place I am considering before I commit." },
  { id: "activity", eyebrow: "Start with the activity", title: "I know what I want to do", detail: "Hike, beach, fish, bird, paddle, watch ships, or chase dark skies." },
];

const genericActivities: Array<{ id: StatewideMode; label: string; detail: string }> = [
  { id: "best", label: "Best overall", detail: "Give me the strongest general outdoor option." },
  { id: "hiking", label: "Hiking", detail: "Comfortable weather and a useful daylight window." },
  { id: "scenic", label: "Scenic day", detail: "Good weather for overlooks, waterfalls, drives, and photography." },
  { id: "dark-sky", label: "Dark sky", detail: "Cloud cover and weather that support a night outside." },
];

const specialistOrder = ["beaches", "buoys", "trout", "birding", "aurora", "freighters"] as const;

function displayStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function scoreLabel(score: number) {
  if (score >= 90) return "Excellent fit";
  if (score >= 80) return "Strong fit";
  if (score >= 70) return "Good option";
  if (score >= 60) return "Mixed";
  return "Weak fit";
}

function weatherLine(response: StatewideResponse) {
  const lead = response.picks[0];
  if (!lead) return "";
  const pieces: string[] = [];
  if (lead.weather.high !== null) pieces.push(`${Math.round(lead.weather.high)}° high`);
  if (lead.weather.precipitationProbability !== null) pieces.push(`${Math.round(lead.weather.precipitationProbability)}% rain`);
  if (lead.weather.windGust !== null) pieces.push(`gusts ${Math.round(lead.weather.windGust)} mph`);
  if (lead.weather.aqi !== null) pieces.push(`AQI ${Math.round(lead.weather.aqi)}`);
  return pieces.join(" · ");
}

export function OutdoorIntentHub({
  initialToday,
  places,
}: {
  initialToday: StatewideResponse;
  places: PlaceOption[];
}) {
  const [intent, setIntent] = useState<IntentId>("today");
  const [statewide, setStatewide] = useState(initialToday);
  const [date, setDate] = useState<DateChoice>("today");
  const [mode, setMode] = useState<StatewideMode>("best");
  const [loading, setLoading] = useState(false);
  const [stateError, setStateError] = useState("");
  const [placeQuery, setPlaceQuery] = useState("");
  const [localOpen, setLocalOpen] = useState(false);
  const [origin, setOrigin] = useState("");
  const [driveHours, setDriveHours] = useState(2);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [localPlans, setLocalPlans] = useState<PlannerResponse | null>(null);

  const matchingPlaces = useMemo(() => {
    const q = placeQuery.trim().toLowerCase();
    if (!q) return places.slice(0, 8);
    return places
      .filter((place) => `${place.name} ${place.area}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [placeQuery, places]);

  async function refreshStatewide(nextDate: DateChoice, nextMode: StatewideMode) {
    setDate(nextDate);
    setMode(nextMode);
    setLoading(true);
    setStateError("");
    setLocalPlans(null);
    try {
      const response = await fetch(`/api/statewide?date=${nextDate}&mode=${nextMode}`);
      if (!response.ok) throw new Error("Could not load conditions.");
      setStatewide((await response.json()) as StatewideResponse);
    } catch {
      setStateError("Live statewide conditions are temporarily unavailable. Try a place check or one of the specialized live tools.");
    } finally {
      setLoading(false);
    }
  }

  async function chooseIntent(next: IntentId) {
    setIntent(next);
    setStateError("");
    setLocalPlans(null);
    if (next === "today") await refreshStatewide("today", mode);
    if (next === "weekend") await refreshStatewide("weekend", mode);
  }

  async function chooseMode(nextMode: StatewideMode) {
    setIntent(date === "weekend" ? "weekend" : "today");
    await refreshStatewide(date, nextMode);
  }

  function useLocation() {
    setLocalError("");
    if (!navigator.geolocation) {
      setLocalError("Location is unavailable in this browser. Type a Michigan city or ZIP instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setOrigin("My location");
        void runLocal({
          origin: "My location",
          originCoordinates: {
            latitude: Number(coords.latitude.toFixed(5)),
            longitude: Number(coords.longitude.toFixed(5)),
          },
        });
      },
      () => setLocalError("Location was not available. Type a Michigan city or ZIP instead."),
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 600_000 },
    );
  }

  async function runLocal(
    override?: { origin: string; originCoordinates?: { latitude: number; longitude: number } },
  ) {
    const chosenOrigin = override?.origin ?? origin.trim();
    if (!chosenOrigin) {
      setLocalError("Enter a Michigan city or ZIP code.");
      return;
    }
    setLocalLoading(true);
    setLocalError("");
    setLocalPlans(null);
    try {
      const selectedActivities: ActivityId[] =
        mode === "hiking" ? ["hiking"] :
        mode === "scenic" ? ["scenic"] :
        mode === "dark-sky" ? ["dark-sky"] :
        ["hiking", "scenic"];

      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: chosenOrigin,
          originCoordinates: override?.originCoordinates,
          date,
          maxDriveHours: driveHours,
          activities: selectedActivities,
          kids: false,
          dog: false,
          accessible: false,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Could not personalize this.");
      setLocalPlans(payload as PlannerResponse);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Could not personalize this.");
    } finally {
      setLocalLoading(false);
    }
  }

  const lead = statewide.picks[0];
  const alternatives = statewide.picks.slice(1, 4);
  const activeDateLabel = date === "weekend" ? "this weekend" : date;

  return (
    <section className="persona-home" aria-labelledby="persona-home-title">
      <div className="persona-hero">
        <div className="persona-hero-copy">
          <p className="persona-kicker">Michigan Outdoors Now</p>
          <h1 id="persona-home-title">What kind of Michigan day are you trying to have?</h1>
          <p>
            Pick the situation that sounds like you. We’ll help narrow the state to a place worth going,
            the best time to be there, and anything that could spoil the plan.
          </p>
        </div>

        <div className="persona-intent-grid" aria-label="Choose how you want to plan">
          {intents.map((item) => (
            <button
              key={item.id}
              type="button"
              className="persona-intent-card"
              data-active={intent === item.id}
              onClick={() => void chooseIntent(item.id)}
            >
              <span>{item.eyebrow}</span>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
            </button>
          ))}
        </div>
      </div>

      {(intent === "today" || intent === "weekend") && (
        <section className="persona-answer" aria-live="polite">
          <div className="persona-answer-head">
            <div>
              <p>{intent === "weekend" ? "Worth planning around" : "Best bet right now"}</p>
              <h2>{intent === "weekend" ? "Start with the weekend answer." : "Start with the answer."}</h2>
            </div>
            <div className="persona-mode-chips" aria-label="Refine the kind of outing">
              {genericActivities.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={mode === item.id}
                  onClick={() => void chooseMode(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {stateError && <p className="persona-error">{stateError}</p>}

          <div className={`persona-live-answer ${loading ? "is-loading" : ""}`}>
            {lead ? (
              <>
                <article className="persona-lead-card">
                  <div className="persona-lead-rating">
                    <span>{scoreLabel(lead.score)}</span>
                    <strong>{lead.score}</strong>
                    <small>{displayStatus(lead.status)} · {lead.confidence} confidence</small>
                  </div>
                  <div className="persona-lead-main">
                    <p className="persona-answer-label">For {activeDateLabel}</p>
                    <h3>{lead.destination.name}</h3>
                    <p className="persona-place-meta">{lead.destination.area} · {lead.activityLabel}</p>

                    <div className="persona-decision-grid">
                      <div>
                        <span>Go when</span>
                        <strong>{lead.bestWindow ?? "Check the hourly detail"}</strong>
                      </div>
                      <div>
                        <span>Why it works</span>
                        <strong>{lead.why}</strong>
                      </div>
                      <div className="persona-watch">
                        <span>Know before you go</span>
                        <strong>{lead.watch}</strong>
                      </div>
                    </div>

                    <p className="persona-weather-line">{weatherLine(statewide)}</p>
                    <div className="persona-actions">
                      <Link href={`/places/${lead.destination.id}`}>See the full plan →</Link>
                      <button type="button" onClick={() => setLocalOpen((value) => !value)}>
                        {localOpen ? "Hide closer options" : "Show me closer options"}
                      </button>
                      <Link href="/explore">Browse the Michigan map</Link>
                    </div>
                  </div>
                </article>

                {alternatives.length > 0 && (
                  <div className="persona-alternatives">
                    <p>Good backups</p>
                    <div>
                      {alternatives.map((pick) => (
                        <Link href={`/places/${pick.destination.id}`} key={pick.destination.id}>
                          <span>{pick.activityLabel} · {pick.score}/100</span>
                          <strong>{pick.destination.name}</strong>
                          <small>{pick.bestWindow ?? pick.why}</small>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {localOpen && (
                  <section className="persona-local">
                    <div>
                      <p>Make this useful from where you are</p>
                      <h3>How far are you actually willing to drive?</h3>
                    </div>
                    <div className="persona-local-form">
                      <label>
                        <span>Starting city or ZIP</span>
                        <input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Bay City, 48706, Marquette…" />
                      </label>
                      <label>
                        <span>Maximum drive</span>
                        <select value={driveHours} onChange={(event) => setDriveHours(Number(event.target.value))}>
                          <option value={1}>About 1 hour</option>
                          <option value={2}>About 2 hours</option>
                          <option value={3}>About 3 hours</option>
                          <option value={5}>Up to 5 hours</option>
                        </select>
                      </label>
                      <button type="button" onClick={() => void runLocal()} disabled={localLoading}>
                        {localLoading ? "Finding options…" : "Find my best options"}
                      </button>
                      <button type="button" className="persona-location-button" onClick={useLocation} disabled={localLoading}>
                        Use my location
                      </button>
                    </div>
                    {localError && <p className="persona-error">{localError}</p>}
                    {localPlans && (
                      <div className="persona-local-results">
                        {localPlans.plans.length ? localPlans.plans.map((plan) => (
                          <Link href={`/places/${plan.destination.id}`} key={plan.destination.id}>
                            <div>
                              <span>{plan.driveHours} hr drive · {plan.score}/100</span>
                              <strong>{plan.destination.name}</strong>
                              <small>{plan.bestWindow ? `Best window: ${plan.bestWindow}` : plan.destination.summary}</small>
                            </div>
                            <p>{plan.cautions[0] ?? plan.reasons[0]}</p>
                          </Link>
                        )) : <p>No strong matches inside that drive window. Increase the drive time or try a different outing.</p>}
                      </div>
                    )}
                  </section>
                )}
              </>
            ) : (
              <div className="persona-empty">
                <h3>No live statewide answer is available right now.</h3>
                <p>Check a specific place, browse the map, or use one of the specialized tools below.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {intent === "place" && (
        <section className="persona-place-search">
          <div>
            <p className="persona-section-kicker">Check the plan before you leave</p>
            <h2>Where are you thinking about going?</h2>
            <p>Search a place. We’ll take you straight to its conditions, best windows, access notes, and useful live data.</p>
          </div>
          <label>
            <span>Place name</span>
            <input
              type="search"
              value={placeQuery}
              onChange={(event) => setPlaceQuery(event.target.value)}
              placeholder="Pictured Rocks, Torch Lake, Tahquamenon…"
              autoFocus
            />
          </label>
          <div className="persona-place-results">
            {matchingPlaces.map((place) => (
              <Link href={`/places/${place.id}`} key={place.id}>
                <span>{place.area}</span>
                <strong>{place.name}</strong>
                <small>{place.summary}</small>
                <b>Check this place →</b>
              </Link>
            ))}
          </div>
        </section>
      )}

      {intent === "activity" && (
        <section className="persona-activity-panel">
          <div>
            <p className="persona-section-kicker">Start with what sounds fun</p>
            <h2>What do you want to do?</h2>
            <p>Different activities need different data. We won’t judge a beach day, trout stream, aurora night, and hike with the same weather score.</p>
          </div>

          <div className="persona-activity-grid">
            {genericActivities.slice(1).map((item) => (
              <button type="button" key={item.id} onClick={() => void chooseMode(item.id)}>
                <span>Find the best</span>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </button>
            ))}

            {specialistOrder.map((toolId) => {
              const tool = specialistTools.find((candidate) => candidate.id === toolId);
              if (!tool) return null;
              return (
                <a href={tool.url} key={tool.id}>
                  <span>Live specialist</span>
                  <strong>{tool.name}</strong>
                  <small>{tool.question}</small>
                  <b>Open tool →</b>
                </a>
              );
            })}
          </div>
        </section>
      )}

      <section className="persona-proof" aria-labelledby="persona-proof-title">
        <div className="persona-proof-head">
          <p className="persona-section-kicker">What this actually does for you</p>
          <h2 id="persona-proof-title">Less checking six tabs. More confidence in the plan.</h2>
          <p>
            The point is not to show you more data. It is to combine the right signals for the outing you care about
            and turn them into a practical choice.
          </p>
        </div>
        <div className="persona-proof-grid">
          <article>
            <span>1</span>
            <h3>It tells you when.</h3>
            <p>A good morning and a bad afternoon should not become one vague daily score. We look for the useful window.</p>
          </article>
          <article>
            <span>2</span>
            <h3>It changes the data by activity.</h3>
            <p>Hiking cares about rain, heat and air. Beaches need waves and swim risk. Trout need river conditions. Dark skies need clouds.</p>
          </article>
          <article>
            <span>3</span>
            <h3>It tells you what could wreck the day.</h3>
            <p>Closures, bad air, wind, storms, rough water, and missing data should change the recommendation—not hide behind a pretty score.</p>
          </article>
        </div>
      </section>

      <section className="persona-coverage">
        <div>
          <p className="persona-section-kicker">Useful today</p>
          <h2>One front door, several deeper tools.</h2>
        </div>
        <div className="persona-coverage-list">
          {specialistTools.filter((tool) => tool.group !== "planning").map((tool) => (
            <a href={tool.url} key={tool.id}>
              <span>{tool.timing}</span>
              <strong>{tool.name}</strong>
              <small>{tool.signals.join(" · ")}</small>
            </a>
          ))}
        </div>
      </section>
    </section>
  );
}
