"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireGarageOrRedirect } from "@/lib/session";
import { VEHICLE_CATEGORIES } from "@/lib/estimate";
import type { ActionState } from "./booking";

const rupees = (v: unknown) => Math.round(Number(v ?? 0) * 100);

const row = z.object({
  category: z.enum(VEHICLE_CATEGORIES),
  labour: z.coerce.number().min(0).max(5_000_000),
  parts: z.coerce.number().min(0).max(5_000_000),
  consumables: z.coerce.number().min(0).max(5_000_000),
  minutes: z.coerce.number().int().min(10).max(1440),
  warrantyDays: z.coerce.number().int().min(0).max(3650),
});

/**
 * Saves one service priced across every vehicle class in a single pass.
 *
 * A class left blank is removed rather than stored as zero, because "we do not price
 * this" and "we do this for free" are different claims and the estimator must not
 * confuse them. The database enforces the same rule with a CHECK constraint.
 */
export async function savePriceRow(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await requireGarageOrRedirect();
  if (!garage.isManager) return { error: "Only an owner or service advisor can change prices." };

  const packageId = Number(fd.get("packageId"));
  if (!Number.isInteger(packageId) || packageId <= 0) return { error: "Choose a service first." };

  const gstPct = Number(fd.get("gstPct") ?? 18);
  if (!(gstPct >= 0 && gstPct <= 28)) return { error: "GST must be between 0 and 28 percent." };

  const keep: Record<string, unknown>[] = [];
  const drop: string[] = [];
  const problems: string[] = [];

  for (const category of VEHICLE_CATEGORIES) {
    const offered = fd.get(`offer.${category}`) === "on";
    if (!offered) { drop.push(category); continue; }

    const parsed = row.safeParse({
      category,
      labour: fd.get(`labour.${category}`) || 0,
      parts: fd.get(`parts.${category}`) || 0,
      consumables: fd.get(`consumables.${category}`) || 0,
      minutes: fd.get(`minutes.${category}`) || 90,
      warrantyDays: fd.get(`warranty.${category}`) || 30,
    });
    if (!parsed.success) { problems.push(category); continue; }
    const r = parsed.data;

    const total = rupees(r.labour) + rupees(r.parts) + rupees(r.consumables);
    if (total <= 0) { problems.push(category); continue; }

    keep.push({
      garage_id: garage.id, package_id: packageId, vehicle_category: category,
      labour_paise: rupees(r.labour), parts_paise: rupees(r.parts), consumables_paise: rupees(r.consumables),
      gst_rate_bps: Math.round(gstPct * 100),
      est_minutes: r.minutes, warranty_days: r.warrantyDays, active: true,
    });
  }

  if (problems.length) {
    return { error: `Enter a price for ${problems.join(", ")}, or untick it. A ticked service needs a figure.` };
  }

  if (drop.length) {
    await sb.from("garage_price_matrix").delete()
      .eq("garage_id", garage.id).eq("package_id", packageId).in("vehicle_category", drop);
  }

  if (keep.length) {
    const { error } = await sb.from("garage_price_matrix")
      .upsert(keep, { onConflict: "garage_id,package_id,vehicle_category" });
    if (error) {
      return { error: error.message.includes("not offered for")
        ? "That service is not offered for one of the vehicle types you ticked."
        : "Could not save these prices." };
    }
  }

  revalidatePath("/garage/pricing");
  revalidatePath("/estimate");
  revalidatePath("/find");
  return {
    ok: true,
    message: keep.length
      ? `Saved for ${keep.length} vehicle ${keep.length === 1 ? "type" : "types"}. Customers see it on the estimator straight away.`
      : "Removed from your price list.",
  };
}

/** Copies one class's figures across the others, scaled — the usual way a garage prices up. */
export async function spreadPricing(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await requireGarageOrRedirect();
  if (!garage.isManager) return { error: "Only an owner or service advisor can change prices." };

  const parsed = z.object({
    packageId: z.coerce.number().int().positive(),
    from: z.enum(VEHICLE_CATEGORIES),
    uplift: z.coerce.number().min(-50).max(200),
  }).safeParse({ packageId: fd.get("packageId"), from: fd.get("from"), uplift: fd.get("uplift") ?? 0 });
  if (!parsed.success) return { error: "Pick a vehicle type to copy from." };
  const { packageId, from, uplift } = parsed.data;

  const { data: source } = await sb.from("garage_price_matrix")
    .select("labour_paise, parts_paise, consumables_paise, gst_rate_bps, est_minutes, warranty_days")
    .eq("garage_id", garage.id).eq("package_id", packageId).eq("vehicle_category", from).maybeSingle();
  if (!source) return { error: `Price ${from} first, then copy it across.` };

  const { data: pkg } = await sb.from("service_packages").select("applies_to").eq("id", packageId).maybeSingle();
  const allowed = (pkg?.applies_to ?? []) as string[];

  const factor = 1 + uplift / 100;
  const rows = VEHICLE_CATEGORIES
    .filter((c) => c !== from && allowed.includes(c))
    .map((c) => ({
      garage_id: garage.id, package_id: packageId, vehicle_category: c,
      labour_paise: Math.round(Number(source.labour_paise) * factor),
      parts_paise: Math.round(Number(source.parts_paise) * factor),
      consumables_paise: Math.round(Number(source.consumables_paise) * factor),
      gst_rate_bps: source.gst_rate_bps, est_minutes: source.est_minutes, warranty_days: source.warranty_days,
      active: true,
    }));

  if (!rows.length) return { error: "There is nothing else to copy this to." };

  const { error } = await sb.from("garage_price_matrix").upsert(rows, { onConflict: "garage_id,package_id,vehicle_category" });
  if (error) return { error: "Could not copy those prices across." };

  revalidatePath("/garage/pricing");
  revalidatePath("/estimate");
  return { ok: true, message: `Copied to ${rows.length} other vehicle types${uplift ? ` with a ${uplift}% adjustment` : ""}. Review each one.` };
}

/** Add-on pricing, same shape, one row per vehicle class. */
export async function saveAddonPrice(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await requireGarageOrRedirect();
  if (!garage.isManager) return { error: "Only an owner or service advisor can change prices." };

  const addonId = Number(fd.get("addonId"));
  if (!Number.isInteger(addonId) || addonId <= 0) return { error: "Choose an extra first." };

  const keep: Record<string, unknown>[] = [];
  const drop: string[] = [];
  for (const category of VEHICLE_CATEGORIES) {
    const price = Number(fd.get(`price.${category}`) ?? 0);
    if (!(price > 0)) { drop.push(category); continue; }
    keep.push({
      garage_id: garage.id, addon_id: addonId, vehicle_category: category,
      price_paise: rupees(price),
      gst_rate_bps: Math.round(Number(fd.get("gstPct") ?? 18) * 100),
      est_minutes: Math.max(10, Number(fd.get(`minutes.${category}`) ?? 30)),
      active: true,
    });
  }

  if (drop.length) {
    await sb.from("garage_addon_prices").delete()
      .eq("garage_id", garage.id).eq("addon_id", addonId).in("vehicle_category", drop);
  }
  if (keep.length) {
    const { error } = await sb.from("garage_addon_prices").upsert(keep, { onConflict: "garage_id,addon_id,vehicle_category" });
    if (error) return { error: "Could not save those prices." };
  }

  revalidatePath("/garage/pricing");
  revalidatePath("/estimate");
  return { ok: true, message: keep.length ? "Extra priced and live on the estimator." : "Removed from your list." };
}
