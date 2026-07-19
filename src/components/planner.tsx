"use client";

import { useState, type FormEvent } from "react";
import { origins } from "../data/origins";
import { activityLabels, formatDriveTime } from "../lib/planner";
import {
  activityIds,
  type ActivityId,
  type DateChoice,
  type PlannerResponse,
} from "../lib/types";

const dateOptions: Array<{ value: DateChoice; label: string; detail: string }> = [
  { value: "today", label: "Today", detail: "Go soon" },
  { value: "tomorrow", label: "Tomorrow", detail: "One day out" },
  { value: "weekend", label: "This weekend", detail: "Saturday plan" },
];

type PlannerProps = {
  defaultOrigin?: string;
  compactIntro?: boolean;
};

export function Planner({ defaultOrigin = "Bay City", compactIntro = false }: PlannerProps) {
  const [origin, setOrigin] = useState(defaultOrigin);
  const [date, setDate] = useState<DateChoice>("weekend");
  const [maxDriveHours, setMaxDriveHours] = useState(2);
  const [activities, setActivities] = useState<ActivityId[]>(["hiking", "scenic"]);
  const [kids, setKids] = useState(false);
  const [dog, setDog] = useState(false);
  const [accessible, setAccessible] = useState(false);
  const [response, setResponse] = useState<PlannerResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function toggleActivity(activity: ActivityId) {
    setActivities((current) =>
      current.includes(activity)
        ? current.filter((item) => item !== activity)
        : [...current, activity],
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResponse(null);

    try {
      const request = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          date,
          maxDriveHours,
          activities,
          kids,
          dog,
          accessible,
        }),
      });
      const payload = (await request.json()) as PlannerResponse | { error?: string };
      if (!request.ok || !("plans" in payload)) {
        throw new Error("error" in payload && payload.error ? payload.error : "The planner could not finish.");
      }
      setResponse(payload);
      window.setTimeout(() => document.getElementById("planner-results")?.focus(), 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The planner could not finish. Try again.");
    } finally {
      setLoading(false);
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
        <div className="form-row form-row-primary">
          <label className="field field-origin">
            <span>Starting in Michigan</span>
            <input
              value={origin}
              onChange={(event) => setOrigin(event.target.value)}
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
              onChange={(event) => setMaxDriveHours(Number(event.target.value))}
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
                  onChange={() => setDate(option.value)}
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
              <input type="checkbox" checked={kids} onChange={(event) => setKids(event.target.checked)} />
              <span>Good with kids</span>
            </label>
            <label className="toggle-choice">
              <input type="checkbox" checked={dog} onChange={(event) => setDog(event.target.checked)} />
              <span>Dog allowed</span>
            </label>
            <label className="toggle-choice">
              <input
                type="checkbox"
                checked={accessible}
                onChange={(event) => setAccessible(event.target.checked)}
              />
              <span>Lower-barrier access</span>
            </label>
          </div>
        </fieldset>

        <div className="submit-row">
          <button className="primary-button" type="submit" disabled={loading}>
            <span>{loading ? "Checking Michigan…" : "Show my best options"}</span>
            <span aria-hidden="true">→</span>
          </button>
          <p>Free · no account · no location tracking</p>
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
              <h3>
                From {response.origin.name} for {formatTargetDate(response.targetDate)}
              </h3>
            </div>
            <span className={`source-badge source-${response.conditionsStatus}`}>
              {response.conditionsStatus === "live" ? "Live conditions used" : "Estimated fit"}
            </span>
          </div>

          {response.plans.length ? (
            <ol className="result-list">
              {response.plans.map((plan, index) => (
                <li className="result-card" key={plan.destination.id}>
                  <div className="result-rank" aria-label={`Option ${index + 1}`}>
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div className="result-main">
                    <div className="result-title-row">
                      <div>
                        <p className="result-area">{plan.destination.area} · {plan.destination.setting}</p>
                        <h4>{plan.destination.name}</h4>
                      </div>
                      <div className="fit-score" aria-label={`${plan.score} percent trip fit`}>
                        <strong>{plan.score}</strong>
                        <span>trip fit</span>
                      </div>
                    </div>
                    <p className="result-summary">{plan.destination.summary}</p>

                    <div className="result-facts">
                      <span>{formatDriveTime(plan.driveHours)}</span>
                      <span>{plan.distanceMiles} rough miles</span>
                      {plan.weather?.high !== null && plan.weather?.high !== undefined && (
                        <span>
                          {Math.round(plan.weather.high)}° / {plan.weather.low === null ? "—" : `${Math.round(plan.weather.low)}°`}
                        </span>
                      )}
                      {plan.weather?.precipitationProbability !== null &&
                        plan.weather?.precipitationProbability !== undefined && (
                          <span>{Math.round(plan.weather.precipitationProbability)}% rain</span>
                        )}
                    </div>

                    <ul className="reason-list">
                      {plan.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>

                    {plan.cautions.length > 0 && (
                      <div className="caution-box">
                        <strong>Watch before you go</strong>
                        <ul>{plan.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul>
                      </div>
                    )}

                    <details className="access-note">
                      <summary>Access note</summary>
                      <p>{plan.destination.accessNote}</p>
                    </details>

                    <div className="result-actions">
                      <a href={plan.mapUrl} target="_blank" rel="noreferrer">Open in Maps ↗</a>
                      <a href={plan.destination.officialUrl} target="_blank" rel="noreferrer">Official details ↗</a>
                      {plan.relatedTool && <a href={plan.relatedTool.url}>{plan.relatedTool.label} →</a>}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-result">
              <h4>No strong match inside that drive window.</h4>
              <p>Try one more hour, remove a requirement, or choose another activity.</p>
            </div>
          )}

          <p className="result-note">{response.note} Drive times are rough estimates, not live traffic. A trip-fit score is not a safety score.</p>
        </div>
      )}
    </section>
  );
}

function formatTargetDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
