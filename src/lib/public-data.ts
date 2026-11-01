import { hasSupabase } from "./supabase/env";
import { supabasePublic } from "./supabase/public";
import type { HeroModel } from "@/components/hero-estimate";

/**
 * Public, cacheable reads. These run through the anon client with no cookies so the
 * pages that use them stay static between revalidations — one database read per
 * window instead of one per visitor.
 */

export interface Counters { activeGarages: number; verifiedGarages: number; completedServices: number; localities: number }

export async function getCounters(): Promise<Counters> {
  const empty = { activeGarages: 0, verifiedGarages: 0, completedServices: 0, localities: 0 };
  if (!hasSupabase()) return empty;
  const { data } = await supabasePublic().rpc("platform_counters").single();
  const row = data as { active_garages: number; verified_garages: number; completed_services: number; localities: number } | null;
  return row
    ? { activeGarages: Number(row.active_garages), verifiedGarages: Number(row.verified_garages),
        completedServices: Number(row.completed_services), localities: Number(row.localities) }
    : empty;
}

export interface Faq { id: number; question: string; answer: string; topic: string }

export async function getFaqs(audience: "customer" | "garage" = "customer", limit = 8): Promise<Faq[]> {
  if (!hasSupabase()) return [];
  const { data } = await supabasePublic()
    .from("faqs").select("id, question, answer, topic")
    .eq("audience", audience).eq("published", true).order("sort").limit(limit);
  return data ?? [];
}

export async function getHeroModels(): Promise<HeroModel[]> {
  if (!hasSupabase()) return [];
  const { data } = await supabasePublic()
    .from("vehicle_models").select("id, name, category, vehicle_makes(name)").order("name").limit(40);
  const rows = (data ?? []) as unknown as { id: number; name: string; category: string; vehicle_makes: { name: string } }[];
  return rows.map((r) => ({ id: r.id, label: `${r.vehicle_makes.name} ${r.name}`, category: r.category }));
}

export async function getCmsPage(slug: string) {
  if (!hasSupabase()) return null;
  const { data } = await supabasePublic()
    .from("cms_pages").select("slug, title, body, meta_description, updated_at")
    .eq("slug", slug).eq("published", true).maybeSingle();
  return data;
}

export async function getLocalities() {
  if (!hasSupabase()) return [];
  const { data } = await supabasePublic()
    .from("seo_localities").select("slug, name, intro, city").eq("published", true).order("name");
  return data ?? [];
}

export interface ServicePackage {
  id: number; slug: string; name: string; required_items: string[]; optional_items: string[];
  typical_minutes: number; vehicle_category: string | null; category_id: number;
}

export async function getServicePackages(): Promise<ServicePackage[]> {
  if (!hasSupabase()) return [];
  const { data } = await supabasePublic()
    .from("service_packages")
    .select("id, slug, name, required_items, optional_items, typical_minutes, vehicle_category, category_id")
    .eq("active", true).order("id");
  return (data ?? []) as ServicePackage[];
}

/* ───────── Impact and testimonials, both computed from real rows ───────── */

export interface Impact {
  servicesCompleted: number;
  garagesActive: number;
  garagesVerified: number;
  vehiclesTracked: number;
  quotesCompared: number;
  approvalsRecorded: number;
  mrpBlocks: number;
  /** Average spread between the cheapest and the typical comparable quote, in basis points. */
  medianSavingBps: number;
}

/**
 * Every figure here is counted from the database by `platform_impact()`. Nothing is
 * rounded up, nothing is a projection, and a platform with no activity reports zeroes —
 * which is why the section that renders this hides itself rather than inventing numbers.
 */
const NO_IMPACT: Impact = {
  servicesCompleted: 0, garagesActive: 0, garagesVerified: 0, vehiclesTracked: 0,
  quotesCompared: 0, approvalsRecorded: 0, mrpBlocks: 0, medianSavingBps: 0,
};

export async function getImpact(): Promise<Impact> {
  if (!hasSupabase()) return NO_IMPACT;
  const sb = supabasePublic();
  const { data } = await sb.rpc("platform_impact").maybeSingle();
  const r = (data ?? {}) as Record<string, number | null>;
  return {
    servicesCompleted: Number(r.services_completed ?? 0),
    garagesActive: Number(r.garages_active ?? 0),
    garagesVerified: Number(r.garages_verified ?? 0),
    vehiclesTracked: Number(r.vehicles_tracked ?? 0),
    quotesCompared: Number(r.quotes_compared ?? 0),
    approvalsRecorded: Number(r.approvals_recorded ?? 0),
    mrpBlocks: Number(r.mrp_blocks ?? 0),
    medianSavingBps: Number(r.median_saving_bps ?? 0),
  };
}

export interface Testimonial {
  id: string;
  authorName: string;
  authorContext: string | null;
  quote: string;
  rating: number | null;
  city: string | null;
  /** True where the row was seeded for a demonstration. The UI must label these. */
  isDemo: boolean;
}

export async function getTestimonials(limit = 6): Promise<Testimonial[]> {
  if (!hasSupabase()) return [];
  const sb = supabasePublic();
  const { data } = await sb.from("testimonials")
    .select("id, author_name, author_context, quote, rating, city, is_demo")
    .eq("published", true).order("is_demo").order("sort").limit(limit);
  return (data ?? []).map((t) => ({
    id: t.id as string,
    authorName: t.author_name as string,
    authorContext: (t.author_context as string | null) ?? null,
    quote: t.quote as string,
    rating: (t.rating as number | null) ?? null,
    city: (t.city as string | null) ?? null,
    isDemo: Boolean(t.is_demo),
  }));
}
