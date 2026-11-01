import type { MetadataRoute } from "next";
import { getLocalities } from "@/lib/public-data";
import { hasSupabase } from "@/lib/supabase/env";
import { supabasePublic } from "@/lib/supabase/public";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const stat: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, priority: 1, changeFrequency: "weekly" },
    { url: `${BASE}/find`, priority: 0.9, changeFrequency: "daily" },
    { url: `${BASE}/how-it-works`, priority: 0.7 },
    { url: `${BASE}/verification`, priority: 0.7 },
    { url: `${BASE}/for-garages`, priority: 0.8 },
    { url: `${BASE}/pricing`, priority: 0.6 },
    { url: `${BASE}/help`, priority: 0.5 },
    { url: `${BASE}/status`, priority: 0.2 },
    ...["about", "terms", "privacy", "grievance"].map((s) => ({ url: `${BASE}/legal/${s}`, priority: 0.3 })),
  ];

  const localities = await getLocalities();
  const areas = localities.map((l) => ({ url: `${BASE}/in/${l.slug}`, priority: 0.6, changeFrequency: "weekly" as const }));

  let garages: MetadataRoute.Sitemap = [];
  if (hasSupabase()) {
    const { data } = await supabasePublic().from("garages").select("slug").eq("status", "active").limit(5000);
    garages = (data ?? []).map((g) => ({ url: `${BASE}/garages/${g.slug}`, priority: 0.8, changeFrequency: "weekly" as const }));
  }

  return [...stat, ...areas, ...garages];
}
