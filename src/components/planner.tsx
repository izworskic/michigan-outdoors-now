"use client";

import { track } from "@vercel/analytics";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { origins } from "../data/origins";
import { activityLabels, formatDriveTime } from "../lib/planner";
import { parsePlannerFragment, serializePlannerFragment } from "../lib/planner-share";
import {
  activityIds,
  type ActivityId,
  type DateChoice,
  type PlannerRequest,
  type PlannerResponse,
} from "../lib/types";
import { ResultComparison } from "./result-comparison";
import { TripDecision } from "./trip-decision";

const dateOptions: Array<{ value: DateChoice; label: string; detail: string }> = [
  { value: "today", label: "Today", detail: "Go soon" },
  { value: "tomorrow", label: "Tomorrow", detail: "One day out" },
  { value: "weekend", label: "This weekend", detail: "Saturday plan" },
];

const presets: Array<{
  id: string;
  label: string;
  detail: string;
  date: DateChoice;
  maxDriveHours: number;
  activities: ActivityId[];
  kids?: boolean;
}> = [
  { id: "family", label: "Easy family day", detail: "Nearby trails + views", date: "weekend", maxDriveHours: 1, activities: ["hiking", "scenic"], kids: true },
  { id: "shore", label: "Great Lakes shore", detail: "Beach + scenery", date: "tomorrow", maxDriveHours: 2, activities: ["beaches", "scenic"] },
  { id: "wildlife", label: "Wildlife + birds", detail: "Birding + walking", date: "weekend", maxDriveHours: 2, activities: ["birding", "hiking"] },
  { id: "stars", label: "Dark-sky night", detail: "Low-cloud options", date: "weekend", maxDriveHours: 3, activities: ["dark-sky", "scenic"] },
  { id: "ships", label: "Shipwatching", detail: "Freighters + shoreline", date: "today", maxDriveHours: 2, activities: ["freighters", "scenic"] },
];

type PlannerProps = {
  defaultOrigin?: string;
  compactIntro?: boolean;
  initialDate?: DateChoice;
  initialMaxDriveHours?: number;
  initialActivities?: ActivityId[];
  initialKids?: boolean;
  initialDog?: boolean;
  initialAccessible?: boolean;
};

function safeTrack(name: string, properties?: Record<string, string | number | boolean>) {
  try {
    track(name, properties);
  } catch {
    // Analytics must never interfere with trip planning.
  }
}

export function Planner({
  defaultOrigin = "Bay City",
  compactIntro = false,
  initialDate = "weekend",
  initialMaxDriveHours = 2,
  initialActivities = ["hiking", "scenic"],
  initialKids = false,
  initialDog = false,
  initialAccessible = false,
}: PlannerProps) {
  const [origin, setOrigin] = useState(defaultOrigin);
  const [date, setDate] = useState<DateChoice>(initialDate);
  const [maxDriveHours, setMaxDriveHours] = useState(initialMaxDriveHours);
  const [activities, setActivities] = useState<ActivityId[]>(() => [...initialActivities]);
  const [kids, setKids] = useState(initialKids);
  const [dog, setDog] = useState(initialDog);
  const [accessible, setAccessible] = useState(initialAccessible);
  const [activePreset, setActivePreset] = useState("");
  const [response, setResponse] = useState<PlannerResponse | null>(null);
  const [primaryId, setPrimaryId] = useState("");
  const [backupId, setBackupId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [setupStatus, setSetupStatus] = useState("");
  const [shareStatus, setShareStatus] = useState("");

  const plannerRequest = useMemo<PlannerRequest>(() => ({
    origin,
    date,
    maxDriveHours,
    activities,
    kids,
    dog,
    accessible,
  }), [origin, date, maxDriveHours, activities, kids, dog, accessible]);

  const primary = response?.plans.find((plan) => plan.destination.id === primaryId) ?? null;
  const backup = response?.plans.find((plan) => plan.destination.id === backupId) ?? null;

  useEffect(() => {
    const shared = parsePlannerFragment(window.location.hash);
    if (!shared) return;

    const timer = window.setTimeout(() => {
      setOrigin(shared.origin);
      setDate(shared.date);
      setMaxDriveHours(shared.maxDriveHours);
      setActivities(shared.activities);
      setKids(shared.kids);
      setDog(shared.dog);
      setAccessible(shared.accessible);
      setSetupStatus("Shared setup loaded. Review it, then build the plan with current conditions.");
      safeTrack("shared_setup_loaded", { activityCount: shared.activities.length });
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function applyPreset(preset: (typeof presets)[number]) {
    setDate(preset.date);
    setMaxDriveHours(preset.maxDriveHours);
    setActivities(preset.activities);
    setKids(Boolean(preset.kids));
    setDog(false);
    setAccessible(false);
    setActivePreset(preset.id);
    setSetupStatus(`${preset.label} setup applied. Change anything you like.`);
    safeTrack("planner_preset_selected", { preset: preset.id });
  }

  function toggleActivity(activity: ActivityId) {
    setActivePreset("");
    setActivities((current) =>
      current.includes(activity)
        ? current.filter((item) => item !== activity)
        : [...current, activity],
    );
  }

  function choosePrimary(destinationId: string) {
    if (destinationId === primaryId) return;
    setPrimaryId(destinationId);
    if (destinationId === backupId) setBackupId(primaryId);
    safeTrack("trip_primary_changed");
  }

  function chooseBackup(destinationId: string) {
    if (destinationId === primaryId) return;
    setBackupId(destinationId);
    safeTrack("trip_backup_changed");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activities.length) {
      setError("Choose at least one activity so the planner knows what a useful day means to you.");
      return;
    }

    setLoading(true);
    setError("");
    setResponse(null);
    setShareStatus("");

    try {
      const request = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(plannerRequest),
      });
      const payload = (await request.json()) as PlannerResponse | { error?: string };
      if (!request.ok || !("plans" in payload)) {
        throw new Error("error" in payload && payload.error ? payload.error : "The planner could not finish.");
      }
      setResponse(payload);
      setPrimaryId(payload.plans[0]?.destination.id ?? "");
      setBackupId(payload.plans[1]?.destination.id ?? "");
      safeTrack("planner_completed", {
        planCount: payload.plans.length,
        activityCount: activities.length,
        conditions: payload.conditionsStatus,
      });
      window.setTimeout(() => document.getElementById("planner-results")?.focus(), 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The planner could not finish. Try again.");
      safeTrack("planner_failed");
    } finally {
      setLoading(false);
    }
  }

  async function sharePlan() {
    if (!primary) return;

    const url = new URL(window.location.href);
    url.hash = serializePlannerFragment(plannerRequest).slice(1);
    const text = `Michigan Outdoors Now: ${primary.destination.name}${backup ? `, with ${backup.destination.name} as backup` : ""}.`;

    try {
      let shareMethod = "clipboard";
      if (navigator.share) {
        shareMethod = "native";
        await navigator.share({ title: "My Michigan outdoor plan", text, url: url.toString() });
        setShareStatus("Plan shared.");
      } else {
        await navigator.clipboard.writeText(`${text} ${url.toString()}`);
        setShareStatus("Plan link copied. Send it to your group when ready.");
      }
      window.history.replaceState(null, "", url);
      safeTrack("trip_plan_shared", { method: shareMethod });
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setShareStatus("Could not copy automatically. Use your browser’s Share command to send this page.");
    }
  }

  return (
    <section className="planner-shell" id="planner" aria-labelledby="planner-title">
      <div className="planner-heading">
        <div>
          <p className="eyebrow">Build a Michigan plan</p>
          <h2 id="planner-title">What kind of outside sounds good?</h2>
        </div>
        {!compactIntro && (
          <p>
            Set the day, drive, and interests. The planner weighs destination fit against current
            forecast and air-quality data when available.
          </p>
        )}
      </div>

      <form onSubmit={submit} className="planner-form">
        <fieldset className="quick-start">
          <legend>Quick starts</legend>
          <p>Choose a useful starting point, then adjust it below.</p>
          <div className="preset-grid">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="preset-button"
                aria-pressed={activePreset === preset.id}
                onClick={() => applyPreset(preset)}
              >
                <strong>{preset.label}</strong>
                <span>{preset.detail}</span>
              </button>
            ))}
          </div>
          <p className="setup-status" aria-live="polite">{setupStatus}</p>
        </fieldset>

        <div className="form-row form-row-primary">
          <label className="field field-origin">
            <span>Starting in Michigan</span>
            <input
              value={origin}
              onChange={(event) => { setOrigin(event.target.value); setActivePreset(""); }}
              list="michigan-origins"
              name="origin"
              autoComplete="postal-code"
              placeholder="City or ZIP code"
              required
              minLength={2}
              maxLength={80}
            />
            <datalist id="michigan-origins">
              {origins.map((item) => (
                <option key={item.slug} value={item.name}>{`${item.name} — ${item.zip}`}</option>
              ))}
            </datalist>
          </label>

          <label className="field">
            <span>Maximum one-way drive</span>
            <select
              value={maxDriveHours}
              onChange={(event) => { setMaxDriveHours(Number(event.target.value)); setActivePreset(""); }}
              name="maxDriveHours"
            >
              <option value={1}>Up to 1 hour</option>
              <option value={2}>Up to 2 hours</option>
              <option value={3}>Up to 3 hours</option>
              <option value={5}>Up to 5 hours</option>
            </select>
          </label>
        </div>

        <fieldset className="choice-group">
          <legend>When are you going?</legend>
          <div className="date-grid">
            {dateOptions.map((option) => (
              <label className="choice-card" key={option.value} data-selected={date === option.value}>
                <input
                  type="radio"
                  name="date"
                  value={option.value}
                  checked={date === option.value}
                  onChange={() => { setDate(option.value); setActivePreset(""); }}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.detail}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="choice-group">
          <legend>Pick one or more activities</legend>
          <div className="activity-grid">
            {activityIds.map((activity) => (
              <label
                className="activity-choice"
                key={activity}
                data-selected={activities.includes(activity)}
              >
                <input
                  type="checkbox"
                  checked={activities.includes(activity)}
                  onChange={() => toggleActivity(activity)}
                />
                <span className={`activity-mark activity-${activity}`} aria-hidden="true" />
                <span>{activityLabels[activity]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="choice-group needs-group">
          <legend>Who needs to fit the plan?</legend>
          <div className="toggle-row">
            <label className="toggle-choice">
              <input type="checkbox" checked={kids} onChange={(event) => { setKids(event.target.checked); setActivePreset(""); }} />
              <span>Good with kids</span>
            </label>
            <label className="toggle-choice">
              <input type="checkbox" checked={dog} onChange={(event) => { setDog(event.target.checked); setActivePreset(""); }} />
              <span>Dog allowed</span>
            </label>
            <label className="toggle-choice">
              <input
                type="checkbox"
                checked={accessible}
                onChange={(event) => { setAccessible(event.target.checked); setActivePreset(""); }}
              />
              <span>Lower-barrier access</span>
            </label>
          </div>
        </fieldset>

        <div className="planner-brief" data-usefulness="planner-brief">
          <span>Your brief</span>
          <strong>{dateOptions.find((option) => option.value === date)?.label} from {origin || "your Michigan starting point"}</strong>
          <p>
            Up to {maxDriveHours} {maxDriveHours === 1 ? "hour" : "hours"} · {activities.length ? activities.map((item) => activityLabels[item]).join(" + ") : "choose an activity"}
            {(kids || dog || accessible) && ` · ${[kids && "kids", dog && "dog", accessible && "lower-barrier access"].filter(Boolean).join(" + ")}`}
          </p>
        </div>

        <div className="submit-row">
          <button className="primary-button" type="submit" disabled={loading}>
            <span>{loading ? "Checking Michigan…" : "Show my best options"}</span>
            <span aria-hidden="true">→</span>
          </button>
          <p>Free · no account · no device location</p>
        </div>
      </form>

      <div className="planner-status" aria-live="polite">
        {error && <p className="error-message">{error}</p>}
        {loading && (
          <div className="loading-card">
            <span className="spinner" aria-hidden="true" />
            Comparing drive fit, weather, wind, and air quality…
          </div>
        )}
      </div>

      {response && (
        <div className="results" id="planner-results" tabIndex={-1}>
          <div className="results-heading">
            <div>
              <p className="eyebrow">Three strongest fits</p>
              <h3>From {response.origin.name} for {formatTargetDate(response.targetDate)}</h3>
              <p className="results-meta">Updated {formatGeneratedTime(response.generatedAt)} · choose a primary and backup below</p>
            </div>
            <span className={`source-badge source-${response.conditionsStatus}`}>
              {response.conditionsStatus === "live" ? "Live conditions used" : "Estimated fit"}
            </span>
          </div>

          {response.plans.length ? (
            <>
              <ResultComparison
                plans={response.plans}
                primaryId={primaryId}
                backupId={backupId}
                onPrimary={choosePrimary}
                onBackup={chooseBackup}
              />
              <ol className="result-list">
                {response.plans.map((plan, index) => (
                  <li className="result-card" key={plan.destination.id} data-primary={primaryId === plan.destination.id} data-backup={backupId === plan.destination.id}>
                    <div className="result-rank" aria-label={`Option ${index + 1}`}>{String(index + 1).padStart(2, "0")}</div>
                    <div className="result-main">
                      <div className="result-title-row">
                        <div>
                          <p className="result-area">{plan.destination.area} · {plan.destination.setting}</p>
                          <h4>{plan.destination.name}</h4>
                        </div>
                        <div className="fit-score" aria-label={`${plan.score} percent trip fit`}>
                          <strong>{plan.score}</strong><span>trip fit</span>
                        </div>
                      </div>
                      <div className="result-choice-row" aria-label={`Choose how to use ${plan.destination.name}`}>
                        <button type="button" aria-pressed={primaryId === plan.destination.id} onClick={() => choosePrimary(plan.destination.id)}>
                          {primaryId === plan.destination.id ? "✓ Primary plan" : "Make primary"}
                        </button>
                        <button type="button" aria-pressed={backupId === plan.destination.id} disabled={primaryId === plan.destination.id} onClick={() => chooseBackup(plan.destination.id)}>
                          {backupId === plan.destination.id ? "✓ Weather backup" : "Set as backup"}
                        </button>
                      </div>
                      <p className="result-summary">{plan.destination.summary}</p>

                      <div className="result-facts">
                        <span>{formatDriveTime(plan.driveHours)}</span>
                        <span>{plan.distanceMiles} rough miles</span>
                        {plan.weather?.high !== null && plan.weather?.high !== undefined && <span>{Math.round(plan.weather.high)}° high / {plan.weather.low === null ? "—" : `${Math.round(plan.weather.low)}° low`}</span>}
                        {plan.weather?.precipitationProbability !== null && plan.weather?.precipitationProbability !== undefined && <span>{Math.round(plan.weather.precipitationProbability)}% rain</span>}
                        {plan.weather?.windGust !== null && plan.weather?.windGust !== undefined && <span>{Math.round(plan.weather.windGust)} mph gusts</span>}
                        {plan.weather?.aqi !== null && plan.weather?.aqi !== undefined && <span>AQI {Math.round(plan.weather.aqi)}</span>}
                        {activities.includes("dark-sky") && plan.weather?.cloudCover !== null && plan.weather?.cloudCover !== undefined && <span>{Math.round(plan.weather.cloudCover)}% clouds</span>}
                        {plan.weather?.sunshineHours !== null && plan.weather?.sunshineHours !== undefined && <span>{plan.weather.sunshineHours.toFixed(1)} sunshine hrs</span>}
                      </div>

                      <ul className="reason-list">{plan.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                      {plan.cautions.length > 0 && (
                        <div className="caution-box"><strong>Watch before you go</strong><ul>{plan.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul></div>
                      )}
                      <details className="access-note"><summary>Access note</summary><p>{plan.destination.accessNote}</p></details>
                      <div className="result-actions">
                        <a href={plan.mapUrl} target="_blank" rel="noreferrer" onClick={() => safeTrack("outbound_map_opened")}>Open in Maps ↗</a>
                        <a href={plan.destination.officialUrl} target="_blank" rel="noreferrer" onClick={() => safeTrack("outbound_official_opened")}>Official details ↗</a>
                        {plan.relatedTool && <a href={plan.relatedTool.url} onClick={() => safeTrack("related_tool_opened")}>{plan.relatedTool.label} →</a>}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
              <TripDecision primary={primary} backup={backup} shareStatus={shareStatus} onShare={sharePlan} />
            </>
          ) : (
            <div className="empty-result"><h4>No strong match inside that drive window.</h4><p>Try one more hour, remove a requirement, or choose another activity.</p></div>
          )}

          <p className="result-note">{response.note} Drive times are rough estimates, not live traffic. A trip-fit score is not a safety score.</p>
        </div>
      )}
    </section>
  );
}

function formatTargetDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function formatGeneratedTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "just now";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Detroit", timeZoneName: "short" }).format(date);
}
