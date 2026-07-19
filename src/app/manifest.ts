import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Michigan Outdoors Now",
    short_name: "MI Outdoors",
    description: "A Michigan outdoor day and weekend planner by Chris Izworski.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3ead8",
    theme_color: "#123d35",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
    ],
  };
}
