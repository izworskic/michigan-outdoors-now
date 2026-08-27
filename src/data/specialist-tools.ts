import type { ActivityId } from "../lib/types";

export type SpecialistTool = {
  id: string;
  name: string;
  question: string;
  url: string;
  activities: ActivityId[];
  signals: string[];
  timing: string;
};

export const specialistTools: SpecialistTool[] = [
  { id: "beach-today", name: "Best Michigan Beaches Today", question: "Which Great Lakes beach has the strongest conditions today?", url: "https://chrisizworski.com/best-michigan-beaches-today/", activities: ["beaches", "paddling"], signals: ["weather", "waves", "water temperature", "swim-risk context"], timing: "Warm season" },
  { id: "waterfalls", name: "Michigan Waterfall Conditions", question: "Which waterfalls are most worth the drive after recent rain?", url: "https://chrisizworski.com/michigan-waterfall-conditions/", activities: ["hiking", "scenic"], signals: ["USGS flow where mapped", "recent rain", "forecast precipitation", "access context"], timing: "Spring through fall" },
  { id: "stargazing", name: "Michigan Stargazing Tonight", question: "Where are clouds and sky conditions best tonight?", url: "https://chrisizworski.com/michigan-stargazing-tonight/", activities: ["dark-sky", "scenic"], signals: ["cloud cover", "weather", "dark-sky locations", "night timing"], timing: "Year-round" },
  { id: "aurora", name: "Northern Lights Michigan", question: "Is tonight worth a northern-lights drive?", url: "https://chrisizworski.com/northern-lights-michigan/", activities: ["dark-sky", "scenic"], signals: ["NOAA space weather", "clouds", "viewing geography", "night timing"], timing: "Year-round" },
  { id: "fall-color", name: "Michigan Fall Color", question: "Where is color strongest and the weather worth the drive?", url: "https://chrisizworski.com/fall-color/", activities: ["hiking", "scenic"], signals: ["canopy observations", "weather", "regional progression", "weekend planning"], timing: "September–October" },
  { id: "keweenaw-hiking", name: "Keweenaw Hiking Conditions", question: "Which Keweenaw hike fits today's weather and exposure?", url: "https://chrisizworski.com/keweenaw-hiking-conditions/", activities: ["hiking", "scenic"], signals: ["weather", "AQI", "exposure context", "hourly timing"], timing: "Spring through fall" },
  { id: "snowshoe", name: "Michigan Snowshoe Conditions", question: "Where does the snow and weather support a winter outing?", url: "https://chrisizworski.com/michigan-snowshoe-conditions/", activities: ["hiking", "scenic"], signals: ["snowfall", "temperature", "wind", "forecast"], timing: "Winter" },
  { id: "ice", name: "Michigan Ice Report", question: "What do accumulated cold and regional ice signals show?", url: "https://chrisizworski.com/michigan-ice/", activities: ["fishing", "scenic"], signals: ["freezing degree days", "regional ice context", "weather"], timing: "Winter" },
  { id: "xc-ski", name: "Michigan Cross-Country Skiing", question: "Where are snow and trail conditions most promising?", url: "https://chrisizworski.com/michigan-cross-country-skiing/", activities: ["hiking", "scenic"], signals: ["snow", "trail-source context", "temperature", "wind"], timing: "Winter" },
  { id: "freighters", name: "Great Lakes Freighter Viewing", question: "Where should I go to watch ships?", url: "https://chrisizworski.com/great-lakes-freighter-viewing/", activities: ["freighters", "scenic"], signals: ["ship context", "weather", "viewing locations", "timing"], timing: "Shipping season" }
];
