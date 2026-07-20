"use client";

import { formatDriveTime } from "../lib/planner";
import type { Plan } from "../lib/types";

type ResultComparisonProps = {
  plans: Plan[];
  primaryId: string;
  backupId: string;
  onPrimary: (destinationId: string) => void;
  onBackup: (destinationId: string) => void;
};

function metric(value: number | null | undefined, suffix: string, digits = 0) {
  return value === null || value === undefined ? "—" : `${value.toFixed(digits)}${suffix}`;
}

export function ResultComparison({
  plans,
  primaryId,
  backupId,
  onPrimary,
  onBackup,
}: ResultComparisonProps) {
  if (!plans.length) return null;

  return (
    <section className="comparison-panel" aria-labelledby="comparison-title" data-usefulness="result-compare">
      <div className="comparison-heading">
        <div>
          <p className="eyebrow">Compare before you commit</p>
          <h4 id="comparison-title">The three options at a glance</h4>
        </div>
        <p>Weather signals help compare fit. They do not determine safety.</p>
      </div>
      <div className="comparison-scroll" tabIndex={0} aria-label="Scrollable result comparison">
        <table className="comparison-table">
          <caption className="sr-only">Compare recommended Michigan outdoor plans</caption>
          <thead>
            <tr>
              <th scope="col">Plan</th>
              <th scope="col">Fit</th>
              <th scope="col">Drive</th>
              <th scope="col">High</th>
              <th scope="col">Rain</th>
              <th scope="col">Gusts</th>
              <th scope="col">AQI</th>
              <th scope="col">Decision</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => {
              const id = plan.destination.id;
              return (
                <tr key={id} data-primary={primaryId === id} data-backup={backupId === id}>
                  <th scope="row">
                    <strong>{plan.destination.name}</strong>
                    <small>{plan.destination.area}</small>
                  </th>
                  <td><strong>{plan.score}</strong>/100</td>
                  <td>{formatDriveTime(plan.driveHours)}</td>
                  <td>{metric(plan.weather?.high, "°")}</td>
                  <td>{metric(plan.weather?.precipitationProbability, "%")}</td>
                  <td>{metric(plan.weather?.windGust, " mph")}</td>
                  <td>{metric(plan.weather?.aqi, "")}</td>
                  <td>
                    <div className="comparison-actions">
                      <button
                        type="button"
                        aria-pressed={primaryId === id}
                        onClick={() => onPrimary(id)}
                      >
                        {primaryId === id ? "Primary" : "Make primary"}
                      </button>
                      <button
                        type="button"
                        aria-pressed={backupId === id}
                        disabled={primaryId === id}
                        onClick={() => onBackup(id)}
                      >
                        {backupId === id ? "Backup" : "Set backup"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
