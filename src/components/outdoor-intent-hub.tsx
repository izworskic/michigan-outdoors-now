"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { specialistTools } from "../data/specialist-tools";
import type { StatewideMode } from "../lib/statewide";
import type { ActivityId, DateChoice, Plan, PlannerRequest, PlannerResponse } from "../lib/types";

type IntentId = "today" | "weekend" | "place" | "activity";

type PlaceOption = {
  id: string;
  name: string;
  area: string;
  summary: string;
  activities: ActivityId[];
};

type RunPlanOverrides = {
  origin?: string;
  originCoordinates?: PlannerRequest["originCoordinates"];
  date?: DateChoice;
  mode?: StatewideMode;
  driveHours?: number;
};

const intents: Array<{ id: IntentId; eyebrow: string; title: string; detail: string }> = [
  { id: "today", eyebrow: "Right now", title: "I want to get outside today", detail: "Find the strongest options inside the distance I would actually travel." },
  { id: "weekend", eyebrow: "Plan ahead", title: "Help me plan this weekend", detail: "Find something worth the drive, plus a backup." },
  { id: "place", eyebrow: "I have an idea", title: "I already know the place", detail: "Check the place I am considering before I commit." },
  { id: "activity", eyebrow: "Start with the activity", title: "I know what I want to do", detail: "Hike, beach, fish, bird, paddle, watch ships, or chase dark skies." },
];

const genericActivities: Array<{ id: StatewideMode; label: string; detail: string }> = [
  { id: "best", label: "Best overall", detail: "Strongest general outdoor options." },
  { id: "hiking", label: "Hiking", detail: "Comfortable weather and a useful daylight window." },
  { id: "scenic", label: "Scenic day", detail: "Overlooks, waterfalls, drives, and photography." },
  { id: "dark-sky", label: "Dark sky", detail: "Cloud cover and weather that support a night outside." },
];

const driveChoices = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const specialistOrder = ["beaches", "buoys", "trout", "birding", "aurora", "freighters"] as const;

const michiganLandscapes = [
  {
    label: "Great Lakes shore",
    title: "Wind changes the whole day.",
    detail: "The same forecast can mean calm water on one shoreline and rough surf on another. Lake-facing direction matters.",
    href: "https://chrisizworski.com/great-lakes-beaches/",
  },
  {
    label: "Dunes + west coast",
    title: "Exposure is part of the plan.",
    detail: "Sun, heat, sand, stairs, bluff wind, and sunset timing can matter as much as the headline temperature.",
    href: "/ideas/hiking-day-trips",
  },
  {
    label: "River country",
    title: "Rain upstream matters later.",
    detail: "For paddling and trout water, recent rain, flow, water temperature, and access can matter more than today's sky.",
    href: "https://michigantroutreport.com/",
  },
  {
    label: "Inland lakes",
    title: "Morning can be a different lake.",
    detail: "Wind often builds through the day. A lake that is glass at 8 a.m. may be a poor paddle by noon.",
    href: "/ideas/paddling-day-trips",
  },
  {
    label: "Northwoods + U.P.",
    title: "Distance changes the stakes.",
    detail: "Longer drives, thinner services, fast-changing weather, and patchier cell coverage make backup plans more valuable.",
    href: "/explore",
  },
  {
    label: "Night sky",
    title: "Dark is not enough.",
    detail: "Cloud cover, moonlight, haze, aurora activity, and how far north you are all shape whether the night is worth the drive.",
    href: "https://chrisizworski.com/northern-lights-michigan/",
  },
] as const;

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

function driveTimeLabel(hours: number) {
  const minutes = Math.round(hours * 60);
  if (minutes < 60) return `${minutes} min`;
  const wholeHours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${wholeHours} hr ${remainder} min` : `${wholeHours} hr`;
}

function planWeatherLine(plan: Plan) {
  if (!plan.weather) return "Live weather was unavailable for this result; verify conditions before leaving.";
  const pieces: string[] = [];
  if (plan.weather.high !== null) pieces.push(`${Math.round(plan.weather.high)}° high`);
  if (plan.weather.precipitationProbability !== null) pieces.push(`${Math.round(plan.weather.precipitationProbability)}% rain`);
  if (plan.weather.windGust !== null) pieces.push(`gusts ${Math.round(plan.weather.windGust)} mph`);
  if (plan.weather.aqi !== null) pieces.push(`AQI ${Math.round(plan.weather.aqi)}`);
  return pieces.join(" · ");
}

function planWhy(plan: Plan) {
  const useful = plan.reasons.filter((reason) => !reason.startsWith("About "));
  return useful.slice(0, 2).join(" ") || plan.destination.summary;
}

function planWatch(plan: Plan) {
  return plan.cautions[0] ??
    "No major weather caution surfaced in the available inputs. Check official access and alerts before leaving.";
}

export function OutdoorIntentHub({ places }: { places: PlaceOption[] }) {
  const [intent, setIntent] = useState<IntentId>("today");
  const [date, setDate] = useState<DateChoice>("today");
  const [mode, setMode] = useState<StatewideMode>("best");
  const [placeQuery, setPlaceQuery] = useState("");
  const [origin, setOrigin] = useState("");
  const [originCoordinates, setOriginCoordinates] = useState<PlannerRequest["originCoordinates"]>();
  const [driveHours, setDriveHours] = useState(2);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState("");
  const [plans, setPlans] = useState<PlannerResponse | null>(null);
  const planRequestRef = useRef<AbortController | null>(null);

  const matchingPlaces = useMemo(() => {
    const q = placeQuery.trim().toLowerCase();
    if (!q) return places.slice(0, 8);
    return places
      .filter((place) => `${place.name} ${place.area}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [placeQuery, places]);

  function selectedActivities(nextMode: StatewideMode): ActivityId[] {
    if (nextMode === "hiking") return ["hiking"];
    if (nextMode === "scenic") return ["scenic"];
    if (nextMode === "dark-sky") return ["dark-sky"];
    return ["hiking", "scenic"];
  }

  async function runPlan(overrides: RunPlanOverrides = {}) {
    const chosenOrigin = (overrides.origin ?? origin).trim();
    const coordinates = overrides.originCoordinates ?? originCoordinates;
    const chosenDate = overrides.date ?? date;
    const chosenMode = overrides.mode ?? mode;
    const chosenDriveHours = overrides.driveHours ?? driveHours;

    if (!chosenOrigin) {
      setPlanError("Tell us where you are starting in Michigan, or use your location.");
      return;
    }

    planRequestRef.current?.abort();
    const controller = new AbortController();
    planRequestRef.current = controller;
    setPlanning(true);
    setPlanError("");
    try {
      const response = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          origin: chosenOrigin,
          ...(coordinates ? { originCoordinates: coordinates } : {}),
          date: chosenDate,
          maxDriveHours: chosenDriveHours,
          activities: selectedActivities(chosenMode),
          kids: false,
          dog: false,
          accessible: false,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !("plans" in payload)) {
        throw new Error(payload.error ?? "Could not build this plan.");
      }
      if (planRequestRef.current !== controller) return;
      setPlans(payload as PlannerResponse);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (planRequestRef.current !== controller) return;
      setPlans(null);
      setPlanError(error instanceof Error ? error.message : "Could not build this plan.");
    } finally {
      if (planRequestRef.current === controller) {
        planRequestRef.current = null;
        setPlanning(false);
      }
    }
  }

  function chooseIntent(next: IntentId) {
    setIntent(next);
    setPlanError("");
    if (next !== "today" && next !== "weekend") {
      planRequestRef.current?.abort();
      planRequestRef.current = null;
      setPlanning(false);
      setPlans(null);
      return;
    }

    const nextDate: DateChoice = next === "weekend" ? "weekend" : "today";
    setDate(nextDate);
    if (plans && (origin.trim() || originCoordinates)) {
      void runPlan({ date: nextDate });
    } else {
      setPlans(null);
    }
  }

  function chooseMode(nextMode: StatewideMode) {
    setMode(nextMode);
    if (intent !== "today" && intent !== "weekend") {
      setIntent("today");
      setDate("today");
    }
    if (plans && (origin.trim() || originCoordinates)) {
      void runPlan({ mode: nextMode, date: intent === "weekend" ? "weekend" : "today" });
    }
  }

  function chooseDriveHours(hours: number) {
    setDriveHours(hours);
    if (plans && (origin.trim() || originCoordinates)) {
      void runPlan({ driveHours: hours });
    }
  }

  function useLocation() {
    setPlanError("");
    if (!navigator.geolocation) {
      setPlanError("Location is unavailable in this browser. Type a Michigan city or ZIP instead.");
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
        void runPlan({ origin: "My location", originCoordinates: coordinates });
      },
      () => {
        setPlanning(false);
        setPlanError("Location was not available. Type a Michigan city or ZIP instead.");
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 600_000 },
    );
  }

  const lead = plans?.plans[0] ?? null;
  const alternatives = plans?.plans.slice(1, 3) ?? [];
  const activeDateLabel = date === "weekend" ? "this weekend" : "today";
  const modeLabel = genericActivities.find((item) => item.id === mode)?.label ?? "Best overall";

  return (
    <section className="persona-home" aria-labelledby="persona-home-title">
      <div className="persona-hero">
        <div className="persona-hero-copy">
          <p className="persona-kicker">Michigan Outdoors Now</p>
          <h1 id="persona-home-title">What kind of Michigan day are you trying to have?</h1>
          <p>
            Tell us what you are trying to do, where you are starting, and how far you would actually travel.
            We’ll narrow the options to your real trip range.
          </p>
        </div>

        <div className="persona-intent-grid" aria-label="Choose how you want to plan">
          {intents.map((item) => (
            <button
              key={item.id}
              type="button"
              className="persona-intent-card"
              data-active={intent === item.id}
              aria-pressed={intent === item.id}
              onClick={() => chooseIntent(item.id)}
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
          <section className="persona-trip-scope" aria-labelledby="trip-scope-title">
            <div className="persona-trip-scope-copy">
              <p className="persona-section-kicker">Set your real trip range</p>
              <h2 id="trip-scope-title">Where are you starting, and how far would you go?</h2>
              <p>
                We only rank places inside your maximum one-way drive. Pick 4 hours and the search includes
                everything from nearby through 4 hours away.
              </p>
            </div>

            <div className="persona-trip-controls">
              <label className="persona-origin-field">
                <span>Starting city or ZIP</span>
                <div>
                  <input
                    value={origin}
                    onChange={(event) => {
                      planRequestRef.current?.abort();
                      planRequestRef.current = null;
                      setPlanning(false);
                      setOrigin(event.target.value);
                      setOriginCoordinates(undefined);
                      setPlans(null);
                    }}
                    placeholder="Bay City, 48706, Marquette…"
                    autoComplete="postal-code"
                  />
                  <button type="button" onClick={useLocation} disabled={planning}>
                    Use my location
                  </button>
                </div>
              </label>

              <fieldset className="persona-drive-field">
                <legend>Maximum one-way drive</legend>
                <div>
                  {driveChoices.map((hours) => (
                    <button
                      type="button"
                      key={hours}
                      aria-pressed={driveHours === hours}
                      onClick={() => chooseDriveHours(hours)}
                    >
                      Up to {hours} {hours === 1 ? "hour" : "hours"}
                    </button>
                  ))}
                </div>
                <small>
                  This is a radius, not a target. <strong>Up to 8 hours means anything from nearby through 8 hours away.</strong>
                </small>
              </fieldset>

              <div className="persona-scope-activity">
                <span>What sounds good?</span>
                <div className="persona-mode-chips" aria-label="Choose the kind of outing">
                  {genericActivities.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      aria-pressed={mode === item.id}
                      onClick={() => chooseMode(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                className="persona-build-button"
                onClick={() => void runPlan()}
                disabled={planning}
              >
                {planning ? "Finding your options…" : `Find my best options within ${driveHours} hours`}
              </button>
            </div>
          </section>

          {planError && <p className="persona-error">{planError}</p>}

          {!plans && !planning && !planError && (
            <div className="persona-awaiting-plan">
              <span>Next</span>
              <strong>Set your starting point and travel limit.</strong>
              <p>Then we’ll compare the strongest {modeLabel.toLowerCase()} options inside that entire range.</p>
            </div>
          )}

          {plans && (
            <div className="persona-live-answer">
              {lead ? (
                <>
                  <div className="persona-answer-head">
                    <div>
                      <p>{intent === "weekend" ? "Worth planning around" : "Best inside your range"}</p>
                      <h2>Your strongest option {activeDateLabel}.</h2>
                    </div>
                    <p className="persona-range-summary">
                      Starting from <strong>{plans.origin.name}</strong> · searching everything up to{" "}
                      <strong>{driveHours} {driveHours === 1 ? "hour" : "hours"}</strong> away
                    </p>
                  </div>

                  <article className="persona-lead-card">
                    <div className="persona-lead-rating">
                      <span>{scoreLabel(lead.score)}</span>
                      <strong>{lead.score}</strong>
                      <small>{displayStatus(lead.decisionStatus)} · {lead.confidence} confidence</small>
                    </div>
                    <div className="persona-lead-main">
                      <p className="persona-answer-label">
                        {driveTimeLabel(lead.driveHours)} from your start · {modeLabel}
                        {date === "weekend" && lead.weather?.date
                          ? ` · best on ${new Intl.DateTimeFormat("en-US", {
                              weekday: "long",
                              month: "short",
                              day: "numeric",
                              timeZone: "UTC",
                            }).format(new Date(`${lead.weather.date}T12:00:00Z`))}`
                          : ""}
                      </p>
                      <h3>{lead.destination.name}</h3>
                      <p className="persona-place-meta">{lead.destination.area} · {lead.distanceMiles} rough miles</p>

                      <div className="persona-decision-grid">
                        <div>
                          <span>Go when</span>
                          <strong>{lead.bestWindow ?? "Check the hourly detail"}</strong>
                        </div>
                        <div>
                          <span>Why it works</span>
                          <strong>{planWhy(lead)}</strong>
                        </div>
                        <div className="persona-watch">
                          <span>Know before you go</span>
                          <strong>{planWatch(lead)}</strong>
                        </div>
                      </div>

                      <p className="persona-weather-line">{planWeatherLine(lead)}</p>
                      <div className="persona-actions">
                        <Link href={`/places/${lead.destination.id}?date=${encodeURIComponent(lead.weather?.date ?? plans.targetDate)}`}>See the full plan →</Link>
                        <a href={lead.mapUrl}>Open directions</a>
                        <Link href="/explore">Browse the Michigan map</Link>
                      </div>
                    </div>
                  </article>

                  {alternatives.length > 0 && (
                    <div className="persona-alternatives">
                      <p>Good backups inside your range</p>
                      <div>
                        {alternatives.map((plan) => (
                          <Link
                            href={`/places/${plan.destination.id}?date=${encodeURIComponent(plan.weather?.date ?? plans.targetDate)}`}
                            key={plan.destination.id}
                          >
                            <span>{driveTimeLabel(plan.driveHours)} away · {plan.score}/100</span>
                            <strong>{plan.destination.name}</strong>
                            <small>{plan.bestWindow ? `Best window: ${plan.bestWindow}` : planWhy(plan)}</small>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="persona-empty">
                  <h3>No strong match showed up inside your {driveHours}-hour range.</h3>
                  <p>Try a wider travel limit, another activity, or check a specific place.</p>
                </div>
              )}
            </div>
          )}
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
              <button type="button" key={item.id} onClick={() => chooseMode(item.id)}>
                <span>Find the best near me</span>
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


      <section className="persona-landscapes" aria-labelledby="michigan-landscape-title">
        <div className="persona-landscape-intro">
          <p className="persona-section-kicker">Read Michigan before you pick a pin</p>
          <h2 id="michigan-landscape-title">The state changes under you as you travel.</h2>
          <p>
            Michigan is not one outdoor forecast. Shoreline, dunes, rivers, inland lakes, northwoods,
            and the U.P. all reward different timing and different data. Use these lenses to understand
            why a place rises or falls in the recommendations.
          </p>
          <Link href="/explore">Explore the statewide atlas →</Link>
        </div>
        <div className="persona-landscape-grid">
          {michiganLandscapes.map((item) => (
            <a href={item.href} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.title}</strong>
              <small>{item.detail}</small>
              <b>Go deeper →</b>
            </a>
          ))}
        </div>
      </section>

      <section className="persona-proof" aria-labelledby="persona-proof-title">
        <div className="persona-proof-head">
          <p className="persona-section-kicker">What this actually does for you</p>
          <h2 id="persona-proof-title">Less checking six tabs. More confidence in the plan.</h2>
          <p>
            The point is not to show you more data. It is to compare the places you would genuinely travel to,
            then turn the right conditions into a practical choice.
          </p>
        </div>
        <div className="persona-proof-grid">
          <article>
            <span>1</span>
            <h3>It respects your travel limit.</h3>
            <p>An eight-hour limit means every useful option from nearby through eight hours away can compete for the recommendation.</p>
          </article>
          <article>
            <span>2</span>
            <h3>It tells you when.</h3>
            <p>A good morning and a bad afternoon should not become one vague daily score. We look for the useful window.</p>
          </article>
          <article>
            <span>3</span>
            <h3>It changes the data by activity.</h3>
            <p>Hiking cares about rain, heat and air. Beaches need waves and swim risk. Trout need river conditions. Dark skies need clouds.</p>
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
