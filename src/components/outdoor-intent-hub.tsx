"use client";

import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";
import { specialistTools } from "../data/specialist-tools";
import type { ActivityId, DateChoice, Plan, PlannerRequest, PlannerResponse } from "../lib/types";

type PlaceOption = {
  id: string;
  name: string;
  area: string;
  summary: string;
  activities: ActivityId[];
};

type AdventureId =
  | "close"
  | "water"
  | "north"
  | "quiet"
  | "sunset"
  | "river"
  | "big"
  | "dark"
  | "weekend"
  | "surprise";

type Adventure = {
  id: AdventureId;
  eyebrow: string;
  title: string;
  detail: string;
  driveHours: number;
  date: DateChoice;
  activities: ActivityId[];
};

type RunPlanOverrides = {
  origin?: string;
  originCoordinates?: PlannerRequest["originCoordinates"];
  date?: DateChoice;
  driveHours?: number;
  activities?: ActivityId[];
};

const adventures: Adventure[] = [
  {
    id: "close",
    eyebrow: "Easy escape",
    title: "Keep it close",
    detail: "Something good without giving half the day to the windshield.",
    driveHours: 1,
    date: "today",
    activities: ["hiking", "scenic", "birding"],
  },
  {
    id: "water",
    eyebrow: "Blue on the map",
    title: "Find water",
    detail: "A shoreline, beach, lake, or paddle that fits the day.",
    driveHours: 3,
    date: "today",
    activities: ["paddling", "beaches", "scenic"],
  },
  {
    id: "north",
    eyebrow: "Change the landscape",
    title: "Head north",
    detail: "Let the road get quieter and the woods get bigger.",
    driveHours: 5,
    date: "today",
    activities: ["hiking", "scenic", "birding"],
  },
  {
    id: "quiet",
    eyebrow: "Less people",
    title: "Disappear for a while",
    detail: "Woods, birds, distance, and places that feel removed from the day.",
    driveHours: 4,
    date: "today",
    activities: ["hiking", "birding", "scenic"],
  },
  {
    id: "sunset",
    eyebrow: "Use the last light",
    title: "Chase sunset",
    detail: "Go where the evening is part of the reason to make the drive.",
    driveHours: 3,
    date: "today",
    activities: ["scenic", "beaches"],
  },
  {
    id: "river",
    eyebrow: "Follow moving water",
    title: "Give me a river",
    detail: "Trout water, paddling, forest roads, and a reason to linger.",
    driveHours: 3,
    date: "today",
    activities: ["fishing", "paddling", "scenic"],
  },
  {
    id: "big",
    eyebrow: "No half measures",
    title: "Make it a big day",
    detail: "Open the radius. Show me something worth a serious drive.",
    driveHours: 8,
    date: "today",
    activities: ["hiking", "scenic"],
  },
  {
    id: "dark",
    eyebrow: "After sunset",
    title: "Wait for dark",
    detail: "Big sky, low clouds, quiet roads, and a night worth staying out for.",
    driveHours: 4,
    date: "today",
    activities: ["dark-sky", "scenic"],
  },
  {
    id: "weekend",
    eyebrow: "Go farther",
    title: "Make a weekend of it",
    detail: "Let both days compete and find something worth building the trip around.",
    driveHours: 8,
    date: "weekend",
    activities: ["hiking", "scenic", "birding"],
  },
  {
    id: "surprise",
    eyebrow: "No plan",
    title: "Surprise me",
    detail: "Give Michigan room to make the case for somewhere I was not thinking about.",
    driveHours: 6,
    date: "today",
    activities: ["hiking", "scenic", "birding"],
  },
];

const michiganLandscapes = [
  {
    label: "Great Lakes shore",
    title: "Wind changes the whole day.",
    detail: "The same forecast can mean calm water on one shoreline and rough surf on another.",
    href: "https://chrisizworski.com/great-lakes-beaches/",
  },
  {
    label: "River country",
    title: "Rain upstream matters later.",
    detail: "For paddling and trout water, flow and water temperature can matter more than today's sky.",
    href: "https://michigantroutreport.com/",
  },
  {
    label: "Northwoods + U.P.",
    title: "Distance changes the stakes.",
    detail: "Long drives, thinner services, quick weather changes, and less cell coverage reward a backup plan.",
    href: "/explore",
  },
  {
    label: "Night sky",
    title: "Dark is not enough.",
    detail: "Clouds, moonlight, haze, aurora activity, and latitude shape whether the night is worth the drive.",
    href: "https://chrisizworski.com/northern-lights-michigan/",
  },
] as const;

function scoreLabel(score: number) {
  if (score >= 90) return "Exceptional fit";
  if (score >= 80) return "Strong pull";
  if (score >= 70) return "Worth a look";
  if (score >= 60) return "Could work";
  return "A stretch";
}

function driveTimeLabel(hours: number) {
  const minutes = Math.round(hours * 60);
  if (minutes < 60) return `${minutes} min`;
  const wholeHours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${wholeHours} hr ${remainder} min` : `${wholeHours} hr`;
}

function planWeatherLine(plan: Plan) {
  if (!plan.weather) return "Live weather is limited for this one. Check conditions before leaving.";
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
  return plan.cautions[0] ?? "Nothing major surfaced, but check official access and alerts before leaving.";
}

export function OutdoorIntentHub({ places }: { places: PlaceOption[] }) {
  const [origin, setOrigin] = useState("");
  const [originCoordinates, setOriginCoordinates] = useState<PlannerRequest["originCoordinates"]>();
  const [selectedAdventure, setSelectedAdventure] = useState<Adventure>(adventures[9]);
  const [driveHours, setDriveHours] = useState(selectedAdventure.driveHours);
  const [date, setDate] = useState<DateChoice>(selectedAdventure.date);
  const [activities, setActivities] = useState<ActivityId[]>(selectedAdventure.activities);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState("");
  const [plans, setPlans] = useState<PlannerResponse | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const planRequestRef = useRef<AbortController | null>(null);
  const originInputRef = useRef<HTMLInputElement | null>(null);

  const matchingPlaces = useMemo(() => {
    const q = placeQuery.trim().toLowerCase();
    if (!q) return [];
    return places
      .filter((place) => `${place.name} ${place.area}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [placeQuery, places]);

  const rangeBands = useMemo(() => {
    const options = plans?.rangeOptions ?? [];
    return Array.from({ length: driveHours }, (_, index) => {
      const upper = index + 1;
      const lower = index;
      const bandOptions = options.filter((option) => {
        if (upper === 1) return option.driveHours <= 1.05;
        return option.driveHours > lower + 0.05 && option.driveHours <= upper + 0.05;
      });
      return {
        upper,
        label: upper === 1 ? "Close to home" : `${lower}–${upper} hours`,
        options: bandOptions,
      };
    }).filter((band) => band.options.length > 0);
  }, [driveHours, plans]);

  async function runPlan(overrides: RunPlanOverrides = {}) {
    const chosenOrigin = (overrides.origin ?? origin).trim();
    const coordinates = overrides.originCoordinates ?? originCoordinates;
    const chosenDate = overrides.date ?? date;
    const chosenDriveHours = overrides.driveHours ?? driveHours;
    const chosenActivities = overrides.activities ?? activities;

    if (!chosenOrigin) {
      setPlanError(`“${selectedAdventure.title}” sounds good. Tell us where you're starting and we'll take it from there.`);
      originInputRef.current?.focus();
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
          activities: chosenActivities,
          kids: false,
          dog: false,
          accessible: false,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !("plans" in payload)) {
        throw new Error(payload.error ?? "Could not build this adventure.");
      }
      if (planRequestRef.current !== controller) return;
      setPlans(payload as PlannerResponse);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (planRequestRef.current !== controller) return;
      setPlans(null);
      setPlanError(error instanceof Error ? error.message : "Could not build this adventure.");
    } finally {
      if (planRequestRef.current === controller) {
        planRequestRef.current = null;
        setPlanning(false);
      }
    }
  }

  function chooseAdventure(adventure: Adventure) {
    setSelectedAdventure(adventure);
    setDriveHours(adventure.driveHours);
    setDate(adventure.date);
    setActivities(adventure.activities);
    setPlanError("");

    if (origin.trim() || originCoordinates) {
      void runPlan({
        driveHours: adventure.driveHours,
        date: adventure.date,
        activities: adventure.activities,
      });
    } else {
      setPlans(null);
      originInputRef.current?.focus();
    }
  }

  function submitOrigin(event: FormEvent) {
    event.preventDefault();
    void runPlan();
  }

  function useLocation() {
    setPlanError("");
    if (!navigator.geolocation) {
      setPlanError("Location is unavailable here. Type a Michigan city or ZIP instead.");
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
        void runPlan({
          origin: "My location",
          originCoordinates: coordinates,
        });
      },
      () => {
        setPlanning(false);
        setPlanError("Location was not available. Type a Michigan city or ZIP instead.");
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 600_000 },
    );
  }

  function goFarther() {
    const nextDrive = Math.min(8, driveHours + 2);
    setDriveHours(nextDrive);
    void runPlan({ driveHours: nextDrive });
  }

  function comeCloser() {
    const nextDrive = Math.max(1, driveHours - 2);
    setDriveHours(nextDrive);
    void runPlan({ driveHours: nextDrive });
  }

  const lead = plans?.plans[0] ?? null;
  const alternatives = plans?.plans.slice(1, 3) ?? [];

  return (
    <section className="adventure-home" aria-labelledby="adventure-title">
      <header className="adventure-hero">
        <div className="adventure-hero-copy">
          <p className="persona-kicker">Michigan Outdoors Now</p>
          <h1 id="adventure-title">Michigan is big. Pick a pull.</h1>
          <p>
            Start where you are, then follow whatever sounds good. Water. North. Quiet. Sunset.
            A river. A ridiculous drive. Change your mind whenever you want.
          </p>

          <form className="adventure-origin" onSubmit={submitOrigin}>
            <label htmlFor="adventure-origin-input">Starting from</label>
            <div>
              <input
                id="adventure-origin-input"
                ref={originInputRef}
                value={origin}
                onChange={(event) => {
                  planRequestRef.current?.abort();
                  planRequestRef.current = null;
                  setPlanning(false);
                  setOrigin(event.target.value);
                  setOriginCoordinates(undefined);
                  setPlans(null);
                  setPlanError("");
                }}
                placeholder="Bay City, Marquette, 48706…"
                autoComplete="postal-code"
              />
              <button type="submit" disabled={planning}>{planning ? "Looking…" : "Go"}</button>
            </div>
            <button type="button" className="adventure-location-link" onClick={useLocation} disabled={planning}>
              Use my current location
            </button>
          </form>
        </div>

        <div className="adventure-current-pull" aria-live="polite">
          <span>Current pull</span>
          <strong>{selectedAdventure.title}</strong>
          <small>
            {selectedAdventure.date === "weekend" ? "This weekend" : "Today"} · up to {driveHours}h one way
          </small>
        </div>
      </header>

      <section className="adventure-chooser" id="adventure-deck" aria-labelledby="choose-adventure-title">
        <div className="adventure-chooser-head">
          <div>
            <p className="persona-section-kicker">Choose your adventure</p>
            <h2 id="choose-adventure-title">What sounds good?</h2>
          </div>
          <p>No setup wizard. Pick a feeling. We’ll do the narrowing.</p>
        </div>

        <div className="adventure-deck">
          {adventures.map((adventure) => (
            <button
              type="button"
              key={adventure.id}
              data-adventure={adventure.id}
              aria-pressed={selectedAdventure.id === adventure.id}
              onClick={() => chooseAdventure(adventure)}
            >
              <span>{adventure.eyebrow}</span>
              <strong>{adventure.title}</strong>
              <small>{adventure.detail}</small>
              <b>{adventure.date === "weekend" ? "weekend" : `up to ${adventure.driveHours}h`} →</b>
            </button>
          ))}
        </div>

        {planError && <p className="adventure-nudge">{planError}</p>}
      </section>

      {plans && (
        <section className="adventure-results" aria-live="polite">
          {lead ? (
            <>
              <div className="adventure-result-head">
                <div>
                  <p className="persona-section-kicker">{selectedAdventure.title}</p>
                  <h2>This one is pulling ahead.</h2>
                </div>
                <p>
                  From <strong>{plans.origin.name}</strong> · looking up to <strong>{driveHours}h</strong> away
                </p>
              </div>

              <article className="adventure-lead">
                <div className="adventure-lead-story">
                  <p>{scoreLabel(lead.score)} · {driveTimeLabel(lead.driveHours)} away</p>
                  <h3>{lead.destination.name}</h3>
                  <span>{lead.destination.area} · about {lead.distanceMiles} rough miles</span>
                  <p className="adventure-lead-summary">{lead.destination.summary}</p>
                  <p className="adventure-weather">{planWeatherLine(lead)}</p>
                </div>

                <div className="adventure-lead-reasons">
                  <div>
                    <span>Why now</span>
                    <strong>{planWhy(lead)}</strong>
                  </div>
                  <div>
                    <span>Best window</span>
                    <strong>{lead.bestWindow ?? "Check the hourly detail"}</strong>
                  </div>
                  <div>
                    <span>One thing to watch</span>
                    <strong>{planWatch(lead)}</strong>
                  </div>
                </div>

                <div className="adventure-actions">
                  <Link href={`/places/${lead.destination.id}?date=${encodeURIComponent(lead.weather?.date ?? plans.targetDate)}`}>
                    Go deeper
                  </Link>
                  <a href={lead.mapUrl}>Directions</a>
                  {driveHours < 8 && (
                    <button type="button" onClick={goFarther}>What if we kept driving?</button>
                  )}
                  {driveHours > 1 && (
                    <button type="button" onClick={comeCloser}>Bring it closer</button>
                  )}
                  <a href="#adventure-deck">Change the vibe</a>
                </div>
              </article>

              {alternatives.length > 0 && (
                <section className="adventure-wander">
                  <div>
                    <p className="persona-section-kicker">Keep wandering</p>
                    <h3>Two other ways the day could go.</h3>
                  </div>
                  <div className="adventure-wander-grid">
                    {alternatives.map((plan) => (
                      <Link
                        href={`/places/${plan.destination.id}?date=${encodeURIComponent(plan.weather?.date ?? plans.targetDate)}`}
                        key={plan.destination.id}
                      >
                        <span>{driveTimeLabel(plan.driveHours)} away</span>
                        <strong>{plan.destination.name}</strong>
                        <small>{plan.destination.area}</small>
                        <p>{planWhy(plan)}</p>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {(plans.rangeOptions?.length ?? 0) > 0 && (
                <details className="adventure-all">
                  <summary>
                    Wander through all {plans.rangeOptions.length} matches inside {driveHours}h
                  </summary>
                  <div className="persona-range-bands">
                    {rangeBands.map((band) => (
                      <section key={band.upper} className="persona-range-band" aria-label={band.label}>
                        <header>
                          <strong>{band.label}</strong>
                          <span>{band.options.length} place{band.options.length === 1 ? "" : "s"}</span>
                        </header>
                        <div>
                          {band.options.map((option) => (
                            <Link
                              key={option.destination.id}
                              href={`/places/${option.destination.id}?date=${encodeURIComponent(option.forecastDate ?? plans.targetDate)}`}
                            >
                              <span>{option.destination.area}</span>
                              <strong>{option.destination.name}</strong>
                              <small>{driveTimeLabel(option.driveHours)} · about {option.distanceMiles} rough miles</small>
                            </Link>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </details>
              )}
            </>
          ) : (
            <div className="adventure-empty">
              <h2>Nothing is making a strong case yet.</h2>
              <p>Pick another pull or let the radius open up.</p>
              {driveHours < 8 && <button type="button" onClick={goFarther}>Open the road farther</button>}
            </div>
          )}
        </section>
      )}

      <section className="adventure-free-roam" aria-labelledby="free-roam-title">
        <div className="adventure-free-roam-head">
          <div>
            <p className="persona-section-kicker">Ignore the suggestions</p>
            <h2 id="free-roam-title">Roam your own way.</h2>
          </div>
          <div className="adventure-free-links">
            <Link href="/explore">Open the Michigan atlas</Link>
            <a href="#place-search">I already have a place</a>
          </div>
        </div>

        <div className="adventure-signal-grid">
          {specialistTools.filter((tool) => ["beaches", "trout", "birding", "aurora", "freighters", "weekend"].includes(tool.id)).map((tool) => (
            <a href={tool.url} key={tool.id}>
              <span>{tool.timing}</span>
              <strong>{tool.name}</strong>
              <small>{tool.question}</small>
            </a>
          ))}
        </div>
      </section>

      <section className="adventure-place-search" id="place-search">
        <div>
          <p className="persona-section-kicker">Already thinking about somewhere?</p>
          <h2>Just check the place.</h2>
        </div>
        <label>
          <span>Place name</span>
          <input
            type="search"
            value={placeQuery}
            onChange={(event) => setPlaceQuery(event.target.value)}
            placeholder="Pictured Rocks, Tahquamenon, Torch Lake…"
          />
        </label>
        {matchingPlaces.length > 0 && (
          <div className="adventure-place-results">
            {matchingPlaces.map((place) => (
              <Link href={`/places/${place.id}`} key={place.id}>
                <span>{place.area}</span>
                <strong>{place.name}</strong>
                <small>{place.summary}</small>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="persona-landscapes" aria-labelledby="michigan-landscape-title">
        <div className="persona-landscape-intro">
          <p className="persona-section-kicker">Read Michigan</p>
          <h2 id="michigan-landscape-title">The state changes under you as you travel.</h2>
          <p>
            Shoreline, rivers, northwoods, and night sky all reward different timing. Sometimes the best
            adventure is understanding what kind of Michigan you are driving into.
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
    </section>
  );
}
