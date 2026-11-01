import { Estimator, type AddonOption, type ModelOption, type PackageOption } from "./estimator";
import { Callout } from "@/components/ui";
import { hasSupabase } from "@/lib/supabase/env";
import { supabasePublic } from "@/lib/supabase/public";
import { getLocalities } from "@/lib/public-data";
import { categoriesFor } from "@/lib/estimate";

export const revalidate = 600;
export const metadata = {
  title: "What will my service cost?",
  description:
    "Pick your vehicle and what it needs. MEQIVA totals it from what garages in Gurugram actually charge — parts, labour and tax — before you book anything.",
};

async function load() {
  if (!hasSupabase()) return { models: [], packages: [], addons: [], localities: [] };
  const sb = supabasePublic();
  const [modelsRes, pkgRes, addonRes, localities] = await Promise.all([
    sb.from("vehicle_models").select("id, name, category, vehicle_makes(name)").order("name").limit(200),
    sb.from("service_packages").select("id, slug, name, vehicle_category, required_items, typical_minutes, service_categories(name)").eq("active", true).order("id"),
    sb.from("addon_catalog").select("id, slug, name, description").eq("active", true).order("sort"),
    getLocalities(),
  ]);

  const models: ModelOption[] = ((modelsRes.data ?? []) as unknown as { id: number; name: string; category: string; vehicle_makes: { name: string } }[])
    .map((m) => ({ id: m.id, label: `${m.vehicle_makes.name} ${m.name}`, category: m.category as ModelOption["category"] }));

  const packages: PackageOption[] = ((pkgRes.data ?? []) as unknown as {
    id: number; slug: string; name: string; vehicle_category: string | null;
    required_items: string[]; typical_minutes: number; service_categories: { name: string } | null;
  }[]).map((p) => ({
    id: p.id, slug: p.slug, name: p.name,
    group: p.service_categories?.name ?? "Other",
    includes: p.required_items ?? [],
    minutes: p.typical_minutes,
    categories: categoriesFor(p.vehicle_category),
  }));

  const addons: AddonOption[] = (addonRes.data ?? []).map((a) => ({ id: a.id, name: a.name, description: a.description }));

  return { models, packages, addons, localities: localities.map((l) => l.name) };
}

export default async function EstimatePage() {
  const { models, packages, addons, localities } = await load();

  return (
    <div className="gradient-surface">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6">
        <header className="max-w-2xl">
          <h1 className="display">What will it <span className="gradient-ink">actually</span> cost?</h1>
          <p className="mt-5 text-lg leading-relaxed text-ink2">
            Pick your vehicle and tick what it needs. The total below is added up from what garages near you have
            published — not a guess, and not an average of nothing.
          </p>
        </header>

        {packages.length === 0 ? (
          <Callout tone="warn" title="No service catalogue loaded">
            Run the migrations and <code className="rounded-xs bg-surface2 px-1">supabase/seed.sql</code> to populate the
            standard services, then garages can price them.
          </Callout>
        ) : (
          <div className="mt-10">
            <Estimator models={models} packages={packages} addons={addons} localities={localities} />
          </div>
        )}
      </div>
    </div>
  );
}
