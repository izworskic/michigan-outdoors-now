"use client";

import { useEffect, useState } from "react";
import {
  readMyOutdoorsProfile,
  recordRecentPlace,
  removeRememberedPlace,
  saveRememberedPlace,
  toggleVisitedPlace,
  writeMyOutdoorsProfile,
} from "../lib/my-outdoors";
import { trackGrowthEvent } from "../lib/growth-analytics";
import styles from "./place-memory-actions.module.css";

type Props = {
  placeId: string;
  placeName: string;
  area: string;
};

export function PlaceMemoryActions({ placeId, placeName, area }: Props) {
  const [saved, setSaved] = useState(false);
  const [visited, setVisited] = useState(false);

  useEffect(() => {
    let profile = readMyOutdoorsProfile();
    profile = recordRecentPlace(profile, {
      id: placeId,
      name: placeName,
      area,
      path: `/places/${placeId}`,
    });
    profile = writeMyOutdoorsProfile(profile);
    setSaved(profile.savedPlaces.some((item) => item.id === placeId));
    setVisited(profile.visitedPlaceIds.includes(placeId));
    trackGrowthEvent("my_outdoors_place_remembered", {
      surface: "place_detail",
      pageKey: `places/${placeId}`,
    }, { source: "place_view" });
  }, [area, placeId, placeName]);

  function toggleSave() {
    const current = readMyOutdoorsProfile();
    const next = saved
      ? removeRememberedPlace(current, placeId)
      : saveRememberedPlace(current, {
          id: placeId,
          name: placeName,
          area,
          path: `/places/${placeId}`,
          kind: "curated",
        });
    const written = writeMyOutdoorsProfile(next);
    const isSaved = written.savedPlaces.some((item) => item.id === placeId);
    setSaved(isSaved);
    trackGrowthEvent(isSaved ? "my_outdoors_place_saved" : "my_outdoors_place_unsaved", {
      surface: "place_detail",
      pageKey: `places/${placeId}`,
    });
  }

  function toggleVisited() {
    const next = writeMyOutdoorsProfile(
      toggleVisitedPlace(readMyOutdoorsProfile(), placeId),
    );
    const isVisited = next.visitedPlaceIds.includes(placeId);
    setVisited(isVisited);
    trackGrowthEvent("my_outdoors_visited_toggled", {
      surface: "place_detail",
      pageKey: `places/${placeId}`,
    }, { visited: isVisited });
  }

  return (
    <div className={styles.actions} aria-label="Remember this place">
      <button type="button" aria-pressed={saved} onClick={toggleSave}>
        {saved ? "Saved to My Outdoors" : "Save to My Outdoors"}
      </button>
      <button type="button" aria-pressed={visited} onClick={toggleVisited}>
        {visited ? "Been there ✓" : "Mark as been there"}
      </button>
      <span>Stays on this device.</span>
    </div>
  );
}
