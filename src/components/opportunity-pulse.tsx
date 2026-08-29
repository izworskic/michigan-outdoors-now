"use client";

import { useEffect, useState } from "react";
import { trackGrowthEvent } from "../lib/growth-analytics";
import type { OpportunityResponse } from "../lib/opportunity-engine";
import styles from "./opportunity-pulse.module.css";

function activityLabel(value: string) {
  return value.replaceAll("-", " ");
}

export function OpportunityPulse() {
  const [response, setResponse] = useState<OpportunityResponse | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/opportunities")
      .then((request) => (request.ok ? request.json() : null))
      .then((payload) => {
        if (active && payload) setResponse(payload as OpportunityResponse);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!response || response.status !== "live" || !response.opportunities.length) return null;

  return (
    <section className={styles.section} aria-labelledby="opportunity-pulse-title">
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Worth noticing now</p>
          <h2 id="opportunity-pulse-title">Michigan windows that stand out today</h2>
        </div>
        <p className={styles.explainer}>
          These are not generic recommendations. They clear a high weather-fit threshold and stand
          out against tomorrow or the statewide norm.
        </p>
      </div>

      <div className={styles.grid}>
        {response.opportunities.slice(0, 3).map((opportunity) => (
          <article className={styles.card} key={opportunity.id}>
            <div className={styles.meta}>
              <span>{activityLabel(opportunity.activity)}</span>
              <strong>{opportunity.score}/100</strong>
            </div>
            <h3>{opportunity.title}</h3>
            <p className={styles.place}>
              {opportunity.destination.name} · {opportunity.destination.area}
            </p>
            <p>{opportunity.whyNow}</p>
            <p className={styles.comparison}>{opportunity.comparison}</p>
            <div className={styles.actions}>
              <a
                href={`/places/${opportunity.destination.id}`}
                onClick={() =>
                  trackGrowthEvent("opportunity_opened", { surface: "homepage_planner" }, {
                    opportunity_kind: opportunity.kind,
                    activity: opportunity.activity,
                    destination: opportunity.destination.id,
                  })
                }
              >
                Open this opportunity
              </a>
              <a
                href={opportunity.verifyUrl}
                onClick={() =>
                  trackGrowthEvent("opportunity_verify_opened", { surface: "homepage_planner" }, {
                    opportunity_kind: opportunity.kind,
                    activity: opportunity.activity,
                  })
                }
              >
                {opportunity.verifyLabel}
              </a>
            </div>
            <details className={styles.caveat}>
              <summary>What this does not prove</summary>
              <p>{opportunity.caveat}</p>
            </details>
          </article>
        ))}
      </div>
      <p className={styles.note}>{response.note}</p>
    </section>
  );
}
