import type { ActivityId } from "../lib/types";

export type SpecialistTool = {
  id: string;
  name: string;
  question: string;
  url: string;
  activities: ActivityId[];
  signals: string[];
  timing: string;
  group: "live" | "seasonal" | "planning";
  verifiedAt: string;
};

export const retiredSpecialistPaths = [
  "michigan-waterfall-conditions",
  "michigan-stargazing-tonight",
  "keweenaw-hiking-conditions",
  "michigan-snowshoe-conditions",
  "great-lakes-freighter-viewing",
] as const;

export const specialistTools: SpecialistTool[] = [
  { id: "beaches", name: "Michigan Beach Conditions", question: "Which Great Lakes beach is the best choice today?", url: "https://chrisizworski.com/great-lakes-beaches/", activities: ["beaches"], signals: ["BeachGuard", "NWS swim risk", "waves", "water temperature"], timing: "Year-round", group: "live", verifiedAt: "2026-08-27" },
  { id: "buoys", name: "Great Lakes Buoys", question: "What are waves, wind, and water doing right now?", url: "https://chrisizworski.com/great-lakes-buoys/", activities: ["paddling", "fishing", "beaches"], signals: ["NOAA/NDBC waves", "wind", "water temperature"], timing: "Year-round", group: "live", verifiedAt: "2026-08-27" },
  { id: "trout", name: "Michigan Trout Report", question: "Which trout water looks best today?", url: "https://michigantroutreport.com/", activities: ["fishing"], signals: ["USGS flow", "water temperature", "weather"], timing: "Year-round", group: "live", verifiedAt: "2026-08-27" },
  { id: "birding", name: "Michigan Birding Report", question: "Where are the birds moving right now?", url: "https://michiganbirdingreport.com/", activities: ["birding"], signals: ["recent sightings", "migration context", "weather"], timing: "Year-round", group: "live", verifiedAt: "2026-08-27" },
  { id: "aurora", name: "Northern Lights Michigan", question: "Is tonight worth an aurora drive?", url: "https://chrisizworski.com/northern-lights-michigan/", activities: ["dark-sky", "scenic"], signals: ["NOAA SWPC", "clouds", "moon", "viewing geography"], timing: "Year-round", group: "live", verifiedAt: "2026-08-27" },
  { id: "freighters", name: "Great Lakes Ship Tracker", question: "Where are the freighters right now?", url: "https://chrisizworski.com/great-lakes-freighter-tracking/", activities: ["freighters", "scenic"], signals: ["AIS map", "corridor views", "nearby NOAA context"], timing: "Navigation season", group: "live", verifiedAt: "2026-08-27" },
  { id: "fall-color", name: "Michigan Fall Color", question: "Where is color strongest and weather worth the drive?", url: "https://chrisizworski.com/fall-color/", activities: ["hiking", "scenic"], signals: ["canopy progression", "weather", "regional timing"], timing: "September–October", group: "seasonal", verifiedAt: "2026-08-27" },
  { id: "ice", name: "Michigan Ice Report", question: "What do accumulated cold and Great Lakes ice signals show?", url: "https://chrisizworski.com/michigan-ice/", activities: ["fishing", "scenic"], signals: ["freezing degree days", "NOAA ice cover", "climatology"], timing: "Winter", group: "seasonal", verifiedAt: "2026-08-27" },
  { id: "xc-ski", name: "Michigan Cross-Country Skiing", question: "Where are snow and trail conditions most promising?", url: "https://chrisizworski.com/michigan-cross-country-skiing/", activities: ["hiking", "scenic"], signals: ["snow", "trail context", "temperature", "wind"], timing: "Winter", group: "seasonal", verifiedAt: "2026-08-27" },
  { id: "weekend", name: "Michigan Outdoor Weekend", question: "What is worth building a whole weekend around?", url: "https://weekend.chrisizworski.com/", activities: ["hiking", "paddling", "fishing", "beaches", "birding", "scenic"], signals: ["trip shape", "live-tool handoffs", "reservation links"], timing: "Year-round", group: "planning", verifiedAt: "2026-08-27" },
];
