"use client";

import { track } from "@vercel/analytics";
import { formatDriveTime } from "../lib/planner";
import type { Plan } from "../lib/types";

type TripDecisionProps = {
  primary: Plan | null;
  backup: Plan | null;
  shareStatus: string;
  onShare: () => void;
};

function trackOutbound(name: string) {
  try {
    track(name);
  } catch {
    // A blocked analytics request must never block an official or map link.
  }
}

function DecisionCard({ label, plan }: { label: string; plan: Plan | null }) {
  if (!plan) return null;

  return (
    <article className="decision-card">
      <p>{label}</p>
      <h5>{plan.destination.name}</h5>
      <div className="decision-facts">
        <span>{plan.score}/100 fit</span>
        <span>{formatDriveTime(plan.driveHours)}</span>
        {plan.weather?.precipitationProbability !== null &&
          plan.weather?.precipitationProbability !== undefined && (
            <span>{Math.round(plan.weather.precipitationProbability)}% rain</span>
          )}
      </div>
      <div className="result-actions">
        <a href={plan.mapUrl} target="_blank" rel="noreferrer" onClick={() => trackOutbound("outbound_map_opened")}>Open map ↗</a>
        <a href={plan.destination.officialUrl} target="_blank" rel="noreferrer" onClick={() => trackOutbound("outbound_official_opened")}>Check official details ↗</a>
      </div>
    </article>
  );
}

export function TripDecision({ primary, backup, shareStatus, onShare }: TripDecisionProps) {
  if (!primary) return null;

  return (
    <section className="decision-board" aria-labelledby="decision-title" data-usefulness="trip-decision">
      <div className="decision-heading">
        <div>
          <p className="eyebrow">Leave with a decision</p>
          <h4 id="decision-title">Your primary plan and weather backup</h4>
        </div>
        <button type="button" className="share-button" onClick={onShare}>
          Share this plan
        </button>
      </div>
      <div className="decision-grid">
        <DecisionCard label="Primary plan" plan={primary} />
        <DecisionCard label="Backup plan" plan={backup} />
      </div>
      <p className="decision-note">
        The shared link stores your setup after the # symbol, so it is not sent in the web request.
        It never replaces official weather, closure, marine, trail, or road checks.
      </p>
      <p className="share-status" aria-live="polite">{shareStatus}</p>
    </section>
  );
}
