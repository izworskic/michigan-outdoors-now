"use client";

import { useEffect, useMemo, useState } from "react";
import { activityIds, type ActivityId } from "../lib/types";
import {
  emptyMyOutdoorsProfile,
  MY_OUTDOORS_EVENT,
  readMyOutdoorsProfile,
  tripShapeDriveHours,
  tripShapes,
  writeMyOutdoorsProfile,
  type MyOutdoorsProfile,
  type TripShape,
} from "../lib/my-outdoors";
import { trackGrowthEvent } from "../lib/growth-analytics";
import type { OpportunityResponse } from "../lib/opportunity-engine";
import {
  detectSavedPlaceChanges,
  mergeOpportunityBaselines,
  type MyOutdoorsChange,
} from "../lib/my-outdoors-changes";
import styles from "./my-outdoors-drawer.module.css";

const activityLabels: Record<ActivityId, string> = {
  hiking: "Hiking",
  paddling: "Paddling",
  fishing: "Fishing",
  beaches: "Beaches",
  birding: "Birding",
  freighters: "Freighters",
  scenic: "Scenic",
  "dark-sky": "Dark sky",
};

const shapeLabels: Record<TripShape, string> = {
  quick: "Quick outing",
  "half-day": "Half day",
  "full-day": "Full day",
  weekend: "Weekend",
};

type Props = {
  currentOrigin: string;
  currentDriveHours: number;
  onApply: (profile: MyOutdoorsProfile) => void;
};

function safeOrigin(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "My location") return "";
  return trimmed.slice(0, 80);
}

export function MyOutdoorsDrawer({
  currentOrigin,
  currentDriveHours,
  onApply,
}: Props) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<MyOutdoorsProfile>(() => emptyMyOutdoorsProfile());
  const [regionsText, setRegionsText] = useState("");
  const [savedNotice, setSavedNotice] = useState("");
  const [changes, setChanges] = useState<MyOutdoorsChange[]>([]);
  const [pendingBaselines, setPendingBaselines] = useState<MyOutdoorsProfile["opportunityBaselines"] | null>(null);

  useEffect(() => {
    const sync = () => {
      const stored = readMyOutdoorsProfile();
      setProfile(stored);
      setRegionsText(stored.favoriteRegions.join(", "));
    };
    sync();
    window.addEventListener(MY_OUTDOORS_EVENT, sync);
    return () => window.removeEventListener(MY_OUTDOORS_EVENT, sync);
  }, []);

  const memoryCount = profile.savedPlaces.length + profile.recentPlaces.length;
  const hasSetup = Boolean(profile.homeOrigin || profile.savedPlaces.length || profile.recentPlaces.length);
  const curatedSavedKey = useMemo(
    () => profile.savedPlaces.filter((place) => place.kind === "curated").map((place) => place.id).sort().join(","),
    [profile.savedPlaces],
  );


  useEffect(() => {
    if (!curatedSavedKey) return;
    let active = true;

    fetch("/api/opportunities?scope=all")
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!active || !payload) return;
        const response = payload as OpportunityResponse;
        const latest = readMyOutdoorsProfile();
        const result = detectSavedPlaceChanges({
          savedPlaces: latest.savedPlaces,
          previous: latest.opportunityBaselines,
          opportunities: response.opportunities,
          checkedAt: response.generatedAt,
        });

        setChanges(result.changes);
        setPendingBaselines(result.current);

        if (!result.changes.length) {
          writeMyOutdoorsProfile({
            ...latest,
            opportunityBaselines: mergeOpportunityBaselines(
              latest.opportunityBaselines,
              result.current,
            ),
          });
          return;
        }

        trackGrowthEvent("my_outdoors_changes_detected", {
          surface: "homepage_planner",
          pageKey: "home",
        }, {
          changeCount: result.changes.length,
          newWindowCount: result.changes.filter((change) => change.kind === "new-window").length,
          strongerWindowCount: result.changes.filter((change) => change.kind === "stronger-window").length,
        });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [curatedSavedKey]);

  const recent = useMemo(
    () => profile.recentPlaces.filter((item) => !profile.savedPlaces.some((saved) => saved.id === item.id)).slice(0, 5),
    [profile.recentPlaces, profile.savedPlaces],
  );


  function markChangesSeen() {
    if (!changes.length || !pendingBaselines) return;
    const latest = readMyOutdoorsProfile();
    writeMyOutdoorsProfile({
      ...latest,
      opportunityBaselines: mergeOpportunityBaselines(
        latest.opportunityBaselines,
        pendingBaselines,
      ),
    });
    trackGrowthEvent("my_outdoors_changes_seen", {
      surface: "homepage_planner",
      pageKey: "home",
    }, {
      changeCount: changes.length,
    });
  }

  function update<K extends keyof MyOutdoorsProfile>(key: K, value: MyOutdoorsProfile[K]) {
    setProfile((previous) => ({ ...previous, [key]: value }));
    setSavedNotice("");
  }

  function toggleActivity(activity: ActivityId) {
    setProfile((previous) => {
      const selected = new Set(previous.favoriteActivities);
      if (selected.has(activity)) {
        if (selected.size === 1) return previous;
        selected.delete(activity);
      } else {
        selected.add(activity);
      }
      return { ...previous, favoriteActivities: [...selected] };
    });
    setSavedNotice("");
  }

  function chooseShape(shape: TripShape) {
    setProfile((previous) => ({
      ...previous,
      tripShape: shape,
      maxDriveHours: tripShapeDriveHours(shape),
    }));
    setSavedNotice("");
  }

  function save(apply = false) {
    const regions = regionsText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 12);
    const next = writeMyOutdoorsProfile({
      ...profile,
      favoriteRegions: regions,
    });
    setProfile(next);
    setRegionsText(next.favoriteRegions.join(", "));
    setSavedNotice(apply ? "Saved and applied to the planner." : "Saved on this device.");
    trackGrowthEvent(apply ? "my_outdoors_applied" : "my_outdoors_saved", {
      surface: "homepage_planner",
      pageKey: "home",
    }, {
      favoriteActivityCount: next.favoriteActivities.length,
      savedPlaceCount: next.savedPlaces.length,
      hasHomeOrigin: Boolean(next.homeOrigin),
      tripShape: next.tripShape,
    });
    if (apply) onApply(next);
  }

  function saveCurrentSetup() {
    const rememberedOrigin = safeOrigin(currentOrigin);
    const next = writeMyOutdoorsProfile({
      ...profile,
      ...(rememberedOrigin ? { homeOrigin: rememberedOrigin } : {}),
      maxDriveHours: currentDriveHours,
    });
    setProfile(next);
    setSavedNotice(
      rememberedOrigin
        ? "Current starting point and drive range saved."
        : "Current drive range saved. Device coordinates are never stored here.",
    );
    trackGrowthEvent("my_outdoors_saved", {
      surface: "homepage_planner",
      pageKey: "home",
    }, {
      source: "current_setup",
      hasHomeOrigin: Boolean(next.homeOrigin),
    });
  }

  function clearMemory() {
    const blank = writeMyOutdoorsProfile(emptyMyOutdoorsProfile());
    setProfile(blank);
    setRegionsText("");
    setSavedNotice("Local My Outdoors memory cleared.");
  }

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => {
          markChangesSeen();
          setOpen(true);
          trackGrowthEvent("my_outdoors_opened", {
            surface: "homepage_planner",
            pageKey: "home",
          }, {
            hasSetup,
            memoryCount,
          });
        }}
        aria-expanded={open}
        aria-controls="my-outdoors-drawer"
      >
        <span>My Outdoors</span>
        {changes.length > 0 && <em className={styles.changeBadge}>{changes.length} changed</em>}
        {memoryCount > 0 && <strong>{Math.min(99, memoryCount)}</strong>}
      </button>

      {open && (
        <div className={styles.layer}>
          <button
            type="button"
            className={styles.scrim}
            aria-label="Close My Outdoors"
            onClick={() => setOpen(false)}
          />
          <aside
            id="my-outdoors-drawer"
            className={styles.drawer}
            aria-label="My Michigan Outdoors"
          >
            <div className={styles.head}>
              <div>
                <p>Stored only on this device</p>
                <h2>My Michigan Outdoors</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>

            <div className={styles.body}>

              {changes.length > 0 && (
                <section className={styles.changeSection} aria-labelledby="my-outdoors-changes-title">
                  <div className={styles.changeHeading}>
                    <div>
                      <p>Since your last check</p>
                      <h3 id="my-outdoors-changes-title">Something got better.</h3>
                    </div>
                    <span>{changes.length} worth another look</span>
                  </div>
                  <div className={styles.changeList}>
                    {changes.map((change) => (
                      <article key={change.placeId}>
                        <div className={styles.changeMeta}>
                          <span>{change.kind === "new-window" ? "New window" : "Stronger now"}</span>
                          <strong>{change.opportunity.score}/100</strong>
                        </div>
                        <h4>{change.title}</h4>
                        <p>{change.opportunity.whyNow}</p>
                        <small>{change.detail}</small>
                        <div className={styles.changeActions}>
                          <a
                            href={change.path}
                            onClick={() => trackGrowthEvent("my_outdoors_change_opened", {
                              surface: "homepage_planner",
                              pageKey: "home",
                            }, {
                              changeKind: change.kind,
                              activity: change.opportunity.activity,
                              scoreBand: Math.floor(change.opportunity.score / 10) * 10,
                            })}
                          >
                            Open the place
                          </a>
                          <a
                            href={change.opportunity.verifyUrl}
                            onClick={() => trackGrowthEvent("my_outdoors_change_verify_opened", {
                              surface: "homepage_planner",
                              pageKey: "home",
                            }, {
                              changeKind: change.kind,
                              activity: change.opportunity.activity,
                            })}
                          >
                            {change.opportunity.verifyLabel}
                          </a>
                        </div>
                      </article>
                    ))}
                  </div>
                  <p className={styles.changeNote}>
                    Compared locally on this device. A stronger window is not a safety clearance; verify access and activity-specific conditions before leaving.
                  </p>
                </section>
              )}

              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <h3>Your usual setup</h3>
                  <button type="button" onClick={saveCurrentSetup}>Use current</button>
                </div>
                <label>
                  <span>Starting city or ZIP</span>
                  <input
                    value={profile.homeOrigin}
                    onChange={(event) => update("homeOrigin", event.target.value.slice(0, 80))}
                    placeholder="Bay City, MI"
                    autoComplete="postal-code"
                  />
                </label>
                <div className={styles.twoCol}>
                  <label>
                    <span>Normal max drive</span>
                    <select
                      value={profile.maxDriveHours}
                      onChange={(event) => update("maxDriveHours", Number(event.target.value))}
                    >
                      {[1,2,3,4,5,6,7,8].map((hours) => (
                        <option value={hours} key={hours}>Up to {hours} hr{hours === 1 ? "" : "s"}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Regions you like</span>
                    <input
                      value={regionsText}
                      onChange={(event) => setRegionsText(event.target.value.slice(0, 240))}
                      placeholder="Keweenaw, Au Sable"
                    />
                  </label>
                </div>
              </section>

              <section className={styles.section}>
                <h3>What kind of day do you usually want?</h3>
                <div className={styles.chips}>
                  {tripShapes.map((shape) => (
                    <button
                      type="button"
                      key={shape}
                      aria-pressed={profile.tripShape === shape}
                      onClick={() => chooseShape(shape)}
                    >
                      {shapeLabels[shape]}
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.section}>
                <h3>Things you actually do</h3>
                <div className={styles.chips}>
                  {activityIds.map((activity) => (
                    <button
                      type="button"
                      key={activity}
                      aria-pressed={profile.favoriteActivities.includes(activity)}
                      onClick={() => toggleActivity(activity)}
                    >
                      {activityLabels[activity]}
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.section}>
                <h3>Usual constraints</h3>
                <div className={styles.switches}>
                  <label>
                    <input
                      type="checkbox"
                      checked={profile.kids}
                      onChange={(event) => update("kids", event.target.checked)}
                    />
                    <span>Kids with me</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={profile.dog}
                      onChange={(event) => update("dog", event.target.checked)}
                    />
                    <span>Dog with me</span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={profile.accessible}
                      onChange={(event) => update("accessible", event.target.checked)}
                    />
                    <span>Lower-barrier access matters</span>
                  </label>
                </div>
              </section>

              {(profile.savedPlaces.length > 0 || recent.length > 0) && (
                <section className={styles.section}>
                  <h3>Your places</h3>
                  {profile.savedPlaces.length > 0 && (
                    <>
                      <p className={styles.subhead}>Saved</p>
                      <div className={styles.placeList}>
                        {profile.savedPlaces.slice(0, 6).map((place) => (
                          <a href={place.path} key={place.id}>
                            <strong>{place.name}</strong>
                            <span>{place.area}{profile.visitedPlaceIds.includes(place.id) ? " · been there" : ""}</span>
                          </a>
                        ))}
                      </div>
                    </>
                  )}
                  {recent.length > 0 && (
                    <>
                      <p className={styles.subhead}>Recently considered</p>
                      <div className={styles.placeList}>
                        {recent.map((place) => (
                          <a href={place.path} key={place.id}>
                            <strong>{place.name}</strong>
                            <span>{place.area}</span>
                          </a>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              )}

              {savedNotice && <p className={styles.notice} role="status">{savedNotice}</p>}
            </div>

            <div className={styles.footer}>
              <button type="button" className={styles.secondary} onClick={clearMemory}>Clear local memory</button>
              <button type="button" className={styles.secondary} onClick={() => save(false)}>Save</button>
              <button type="button" className={styles.primary} onClick={() => { save(true); setOpen(false); }}>
                Save & use now
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
