import type { Origin } from "../lib/types";

export const origins: Origin[] = [
  {
    slug: "bay-city",
    name: "Bay City",
    zip: "48708",
    latitude: 43.5945,
    longitude: -83.8889,
    intro:
      "Start near Saginaw Bay, then compare shoreline, birding, fishing, and forest options without guessing how far the day will stretch.",
  },
  {
    slug: "saginaw",
    name: "Saginaw",
    zip: "48601",
    latitude: 43.4195,
    longitude: -83.9508,
    intro:
      "Use Saginaw as a central launch point for bay wetlands, river country, and easy day trips toward the Thumb or northern Lower Peninsula.",
  },
  {
    slug: "detroit",
    name: "Detroit",
    zip: "48226",
    latitude: 42.3314,
    longitude: -83.0458,
    intro:
      "Find a realistic escape from Detroit, from riverfront and migration stops nearby to beaches, trails, and dark skies farther north.",
  },
  {
    slug: "ann-arbor",
    name: "Ann Arbor",
    zip: "48104",
    latitude: 42.2808,
    longitude: -83.743,
    intro:
      "Plan from Ann Arbor across southeast Michigan lakes, Waterloo country, Lake Erie marshes, and west-side beaches when the drive window allows.",
  },
  {
    slug: "flint",
    name: "Flint",
    zip: "48502",
    latitude: 43.0125,
    longitude: -83.6875,
    intro:
      "Flint sits within reach of Saginaw Bay, the Thumb, and inland forests—use the planner to narrow those choices by conditions and fit.",
  },
  {
    slug: "lansing",
    name: "Lansing",
    zip: "48933",
    latitude: 42.7325,
    longitude: -84.5555,
    intro:
      "From Lansing, compare close-to-home recreation with Lake Michigan, northern forest, and southeast wetland options for a day or weekend.",
  },
  {
    slug: "grand-rapids",
    name: "Grand Rapids",
    zip: "49503",
    latitude: 42.9634,
    longitude: -85.6681,
    intro:
      "Start in Grand Rapids and sort Lake Michigan beaches, dunes, inland trails, paddling, and northern getaways by your actual time and interests.",
  },
  {
    slug: "kalamazoo",
    name: "Kalamazoo",
    zip: "49007",
    latitude: 42.2917,
    longitude: -85.5872,
    intro:
      "Use Kalamazoo as a base for southwest Michigan dunes and shoreline or widen the radius toward central and northern outdoor destinations.",
  },
  {
    slug: "traverse-city",
    name: "Traverse City",
    zip: "49684",
    latitude: 44.7631,
    longitude: -85.6206,
    intro:
      "From Traverse City, choose among dunes, rivers, quiet forest, beaches, and northern night skies with current conditions in view.",
  },
  {
    slug: "marquette",
    name: "Marquette",
    zip: "49855",
    latitude: 46.5436,
    longitude: -87.3954,
    intro:
      "Plan from Marquette across Lake Superior country, comparing cliffs, waterfalls, wildlife refuges, and western U.P. wilderness.",
  },
  {
    slug: "mackinaw-city",
    name: "Mackinaw City",
    zip: "49701",
    latitude: 45.7775,
    longitude: -84.7271,
    intro:
      "At the meeting point of Michigan's peninsulas, compare Straits shoreline, dark-sky country, freighters, waterfalls, and eastern U.P. routes.",
  },
];

export const originsBySlug = new Map(origins.map((origin) => [origin.slug, origin]));

export function findKnownOrigin(value: string): Origin | undefined {
  const normalized = value.trim().toLowerCase();

  return origins.find(
    (origin) =>
      origin.slug === normalized ||
      origin.name.toLowerCase() === normalized ||
      origin.zip === normalized,
  );
}
