import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MEQIVA", short_name: "MEQIVA", start_url: "/", display: "standalone",
    background_color: "#fafaf9", theme_color: "#4f46e5",
    description: "The Automotive Operating Ecosystem.",
  };
}
