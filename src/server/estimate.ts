"use server";
import { z } from "zod";
import { supabasePublic } from "@/lib/supabase/public";
import { hasSupabase } from "@/lib/supabase/env";
import { getSessionUser, supabaseServer } from "@/lib/supabase/server";
import { splitByCoverage, VEHICLE_CATEGORIES, type EstimateResult, type GarageQuote, type MarketBand } from "@/lib/estimate";

const input = z.object({
  category: z.enum(VEHICLE_CATEGORIES),
  packageIds: z.array(z.number().int().positive()).max(12),
  addonIds: z.array(z.number().int().positive()).max(12),
  locality: z.string().max(80).nullable().optional(),
  modelId: z.number().int().positive().nullable().optional(),
  /** Only logged once, when the person stops changing their mind. */
  record: z.boolean().optional(),
});
export type EstimateInput = z.infer<typeof input>;

interface QuoteRow {
  garage_id: string; public_name: string; slug: string; locality: string | null;
  verification: GarageQuote["verification"]; pickup_drop: boolean; accent_hex: string;
  covered: number; requested: number;
  labour_paise: number; parts_paise: number; consumables_paise: number;
  subtotal_paise: number; tax_paise: number; total_paise: number;
  est_minutes: number; warranty_days: number;
}

/**
 * The estimate is always computed in the database from what garages actually charge.
 * Nothing is interpolated, and a category nobody has priced returns nothing rather than
 * a number dressed up as a quote.
 */
export async function fetchEstimate(raw: EstimateInput): Promise<EstimateResult> {
  const empty: EstimateResult = { full: [], partial: [], band: null, requested: 0 };
  const parsed = input.safeParse(raw);
  if (!parsed.success || !hasSupabase()) return empty;
  const i = parsed.data;
  if (i.packageIds.length + i.addonIds.length === 0) return empty;

  const sb = supabasePublic();
  const args = {
    p_category: i.category,
    p_packages: i.packageIds,
    p_addons: i.addonIds,
    p_locality: i.locality ?? null,
  };

  const [quotesRes, bandRes] = await Promise.all([
    sb.rpc("estimate_quotes", args),
    sb.rpc("market_band", args).single(),
  ]);

  const rows = (quotesRes.data ?? []) as QuoteRow[];
  const quotes: GarageQuote[] = rows.map((r) => ({
    garageId: r.garage_id, name: r.public_name, slug: r.slug, locality: r.locality,
    verification: r.verification, pickupDrop: r.pickup_drop, accentHex: r.accent_hex,
    covered: Number(r.covered), requested: Number(r.requested),
    labourPaise: Number(r.labour_paise), partsPaise: Number(r.parts_paise),
    consumablesPaise: Number(r.consumables_paise), subtotalPaise: Number(r.subtotal_paise),
    taxPaise: Number(r.tax_paise), totalPaise: Number(r.total_paise),
    estMinutes: Number(r.est_minutes), warrantyDays: Number(r.warranty_days),
  }));

  const b = bandRes.data as { low_paise: number | null; median_paise: number | null; high_paise: number | null; garages: number } | null;
  const band: MarketBand | null = b && b.low_paise != null
    ? { lowPaise: Number(b.low_paise), medianPaise: Number(b.median_paise), highPaise: Number(b.high_paise), garages: Number(b.garages) }
    : null;

  const { full, partial } = splitByCoverage(quotes);

  if (i.record) {
    // Fire and forget: demand data is useful, but it must never delay or break an estimate.
    try {
      const user = await getSessionUser();
      const server = await supabaseServer();
      await server.from("estimate_requests").insert({
        user_id: user?.id ?? null,
        vehicle_category: i.category,
        model_id: i.modelId ?? null,
        package_ids: i.packageIds,
        addon_ids: i.addonIds,
        locality: i.locality ?? null,
        quoted_low_paise: band?.lowPaise ?? null,
        quoted_median_paise: band?.medianPaise ?? null,
        quoted_high_paise: band?.highPaise ?? null,
        garages_matched: full.length,
      });
    } catch { /* analytics only */ }
  }

  return { full, partial, band, requested: quotes[0]?.requested ?? (i.packageIds.length + i.addonIds.length) };
}
