"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireGarageOrRedirect } from "@/lib/session";
import { parseHex } from "@/lib/theme";
import { GARAGE_FEATURES } from "@/lib/features";
import { fieldKey } from "@/lib/fields";
import type { ActionState } from "./booking";

const clean = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => String(v).trim() !== ""));
const onOff = (fd: FormData, name: string) => fd.get(name) === "on" || fd.get(name) === "true";

async function manager() {
  const ctx = await requireGarageOrRedirect();
  if (!ctx.garage.isManager) throw new Error("Not permitted");
  return ctx;
}
async function owner() {
  const ctx = await requireGarageOrRedirect();
  if (!ctx.garage.isOwner) throw new Error("Only the garage owner can change this");
  return ctx;
}

const touched = (...paths: string[]) => paths.forEach((p) => revalidatePath(p));

/* ─────────────── Branding ─────────────── */

export async function updateBranding(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await owner();
  const parsed = z.object({
    accentHex: z.string().refine((v) => !!parseHex(v), "Pick a colour from the list or enter a valid hex code"),
    tagline: z.string().max(120).optional(),
    about: z.string().max(2000).optional(),
    logoUrl: z.string().url().max(500).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };

  const { error } = await sb.from("garage_settings").update({
    accent_hex: parsed.data.accentHex.toLowerCase(),
    tagline: parsed.data.tagline ?? null,
    about: parsed.data.about ?? null,
    logo_url: parsed.data.logoUrl ?? null,
  }).eq("garage_id", garage.id);
  if (error) return { error: "Could not save your branding." };

  touched("/garage/settings/branding", "/garage", `/garages/${garage.slug}`);
  return { ok: true, message: "Branding updated. Your profile and booking page use it straight away." };
}

/* ─────────────── Booking rules ─────────────── */

export async function updateBookingRules(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await owner();
  const parsed = z.object({
    minLeadMinutes: z.coerce.number().int().min(0).max(10080),
    maxAdvanceDays: z.coerce.number().int().min(1).max(365),
    slotMinutes: z.coerce.number().refine((v) => [15, 30, 60].includes(v), "Choose 15, 30 or 60 minutes"),
    bufferMinutes: z.coerce.number().int().min(0).max(240),
    concurrentJobsPerBay: z.coerce.number().int().min(1).max(5),
    depositPct: z.coerce.number().min(0).max(100),
    cancellationWindowHours: z.coerce.number().int().min(0).max(168),
    noShowFee: z.coerce.number().min(0).max(100000),
    pickupFee: z.coerce.number().min(0).max(100000),
    pickupRadiusKm: z.coerce.number().min(0).max(100),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the numbers." };
  const p = parsed.data;

  const { error } = await sb.from("garage_settings").update({
    online_booking: onOff(fd, "onlineBooking"),
    auto_confirm: onOff(fd, "autoConfirm"),
    pickup_enabled: onOff(fd, "pickupEnabled"),
    min_lead_minutes: p.minLeadMinutes,
    max_advance_days: p.maxAdvanceDays,
    slot_minutes: p.slotMinutes,
    buffer_minutes: p.bufferMinutes,
    concurrent_jobs_per_bay: p.concurrentJobsPerBay,
    deposit_bps: Math.round(p.depositPct * 100),
    cancellation_window_hours: p.cancellationWindowHours,
    no_show_fee_paise: Math.round(p.noShowFee * 100),
    pickup_fee_paise: Math.round(p.pickupFee * 100),
    pickup_radius_km: p.pickupRadiusKm,
  }).eq("garage_id", garage.id);
  if (error) return { error: "Could not save your booking rules." };

  touched("/garage/settings/booking", `/book/${garage.slug}`, `/garages/${garage.slug}`);
  return { ok: true, message: "Saved. New slots follow these rules immediately." };
}

/* ─────────────── Invoicing and tax ─────────────── */

export async function updateInvoicing(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await owner();
  const parsed = z.object({
    invoicePrefix: z.string().regex(/^[A-Z0-9/-]{1,10}$/, "Use up to 10 capital letters, numbers, / or -"),
    defaultGstPct: z.coerce.number().min(0).max(28),
    placeOfSupplyCode: z.string().regex(/^\d{2}$/, "Use the two-digit state code").optional(),
    invoiceTerms: z.string().max(2000).optional(),
    invoiceFooter: z.string().max(500).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };

  const { error } = await sb.from("garage_settings").update({
    gst_registered: onOff(fd, "gstRegistered"),
    invoice_prefix: parsed.data.invoicePrefix,
    default_gst_bps: Math.round(parsed.data.defaultGstPct * 100),
    place_of_supply_code: parsed.data.placeOfSupplyCode ?? null,
    invoice_terms: parsed.data.invoiceTerms ?? null,
    invoice_footer: parsed.data.invoiceFooter ?? null,
  }).eq("garage_id", garage.id);
  if (error) return { error: "Could not save your invoice settings." };

  touched("/garage/settings/invoicing");
  return { ok: true, message: "Saved. The next invoice uses this numbering." };
}

/* ─────────────── Commercial defaults ─────────────── */

export async function updateCommercials(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await owner();
  const parsed = z.object({
    defaultLabourRate: z.coerce.number().min(0).max(100000),
    targetMarginPct: z.coerce.number().min(0).max(100),
    lowMarginAlertPct: z.coerce.number().min(0).max(100),
    defaultWarrantyDays: z.coerce.number().int().min(0).max(3650),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the numbers." };
  const p = parsed.data;
  if (p.lowMarginAlertPct > p.targetMarginPct) {
    return { error: "The warning level should be at or below your target margin." };
  }

  const { error } = await sb.from("garage_settings").update({
    default_labour_rate_paise: Math.round(p.defaultLabourRate * 100),
    target_margin_bps: Math.round(p.targetMarginPct * 100),
    low_margin_alert_bps: Math.round(p.lowMarginAlertPct * 100),
    default_warranty_days: p.defaultWarrantyDays,
  }).eq("garage_id", garage.id);
  if (error) return { error: "Could not save." };

  touched("/garage/settings/commercials", "/garage/quotes/new");
  return { ok: true, message: "Saved. The quotation builder uses these as its defaults." };
}

/* ─────────────── Feature switches ─────────────── */

export async function updateFeatures(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await owner();
  const features: Record<string, boolean> = {};
  for (const f of GARAGE_FEATURES) features[f] = onOff(fd, `feature.${f}`);

  const { error } = await sb.from("garage_settings").update({ features }).eq("garage_id", garage.id);
  if (error) return { error: "Could not save your feature choices." };

  touched("/garage/settings/features", "/garage");
  return { ok: true, message: "Saved. Anything switched off is hidden for your whole team." };
}

/* ─────────────── Working hours ─────────────── */

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export async function saveHours(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await owner();
  const rows = DAYS.map((day) => {
    const closed = onOff(fd, `closed.${day}`);
    const opens = String(fd.get(`opens.${day}`) ?? "09:30");
    const closes = String(fd.get(`closes.${day}`) ?? "19:00");
    return { garage_id: garage.id, branch_id: null, day, opens, closes, closed };
  });

  for (const r of rows) {
    if (!r.closed && r.closes <= r.opens) {
      return { error: `Closing time must be after opening time on ${r.day}.` };
    }
  }

  await sb.from("garage_hours").delete().eq("garage_id", garage.id).is("branch_id", null);
  const { error } = await sb.from("garage_hours").insert(rows);
  if (error) return { error: "Could not save your opening hours." };

  touched("/garage/settings/hours", `/book/${garage.slug}`, `/garages/${garage.slug}`);
  return { ok: true, message: "Hours saved. Bookable slots follow them from now on." };
}

export async function addHoliday(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await owner();
  const parsed = z.object({
    onDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    reason: z.string().max(120).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Pick a date." };

  const { error } = await sb.from("garage_holidays")
    .insert({ garage_id: garage.id, on_date: parsed.data.onDate, reason: parsed.data.reason ?? null });
  if (error) return { error: error.code === "23505" ? "That date is already marked as closed." : "Could not save." };

  touched("/garage/settings/hours", `/book/${garage.slug}`);
  return { ok: true, message: "Marked as closed. No slots will be offered that day." };
}

export async function removeHoliday(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await owner();
  await sb.from("garage_holidays").delete().eq("id", Number(fd.get("id"))).eq("garage_id", garage.id);
  touched("/garage/settings/hours", `/book/${garage.slug}`);
  return { ok: true, message: "Removed." };
}

/* ─────────────── Custom job card fields ─────────────── */

export async function saveFieldDef(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await owner();
  const parsed = z.object({
    id: z.string().uuid().optional(),
    entity: z.enum(["job_card", "customer", "vehicle", "booking"]),
    key: fieldKey,
    label: z.string().min(1, "Give the field a label").max(80),
    help: z.string().max(200).optional(),
    type: z.enum(["text", "textarea", "number", "select", "multiselect", "boolean", "date", "photo"]),
    options: z.string().max(500).optional(),
    sort: z.coerce.number().int().min(0).max(999).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the field." };
  const p = parsed.data;

  const options = (p.options ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (["select", "multiselect"].includes(p.type) && options.length < 2) {
    return { error: "A choice field needs at least two options, separated by commas." };
  }

  const row = {
    garage_id: garage.id, entity: p.entity, key: p.key, label: p.label, help: p.help ?? null,
    type: p.type, options, required: onOff(fd, "required"),
    show_to_customer: onOff(fd, "showToCustomer"), sort: p.sort ?? 0, active: true,
  };

  const { error } = p.id
    ? await sb.from("garage_field_defs").update(row).eq("id", p.id).eq("garage_id", garage.id)
    : await sb.from("garage_field_defs").insert(row);
  if (error) return { error: error.code === "23505" ? "A field with that key already exists." : "Could not save the field." };

  touched("/garage/settings/fields", "/garage/jobs");
  return { ok: true, message: p.id ? "Field updated." : "Field added to your job card." };
}

export async function deleteFieldDef(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await owner();
  // Kept as inactive so historical job cards still render what was collected.
  await sb.from("garage_field_defs").update({ active: false }).eq("id", String(fd.get("id"))).eq("garage_id", garage.id);
  touched("/garage/settings/fields");
  return { ok: true, message: "Field retired. Existing job cards keep what they already recorded." };
}

/* ─────────────── Checklists ─────────────── */

export async function saveChecklist(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await manager();
  const parsed = z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1, "Give the checklist a name").max(80),
    categoryId: z.coerce.number().int().positive().optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };

  const row = {
    garage_id: garage.id, name: parsed.data.name,
    category_id: parsed.data.categoryId ?? null, require_photo: onOff(fd, "requirePhoto"),
  };
  const { error } = parsed.data.id
    ? await sb.from("garage_checklists").update(row).eq("id", parsed.data.id).eq("garage_id", garage.id)
    : await sb.from("garage_checklists").insert(row);
  if (error) return { error: "Could not save the checklist." };

  touched("/garage/settings/checklists");
  return { ok: true, message: "Checklist saved." };
}

export async function saveChecklistItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb } = await manager();
  const parsed = z.object({
    checklistId: z.string().uuid(),
    label: z.string().min(1, "Describe what to check").max(160),
    help: z.string().max(200).optional(),
    sort: z.coerce.number().int().min(0).max(999).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the item." };

  const { error } = await sb.from("garage_checklist_items").insert({
    checklist_id: parsed.data.checklistId, label: parsed.data.label, help: parsed.data.help ?? null,
    require_photo: onOff(fd, "requirePhoto"), sort: parsed.data.sort ?? 0,
  });
  if (error) return { error: "Could not add the item." };

  touched("/garage/settings/checklists");
  return { ok: true, message: "Item added." };
}

export async function deleteChecklistItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb } = await manager();
  await sb.from("garage_checklist_items").delete().eq("id", String(fd.get("id")));
  touched("/garage/settings/checklists");
  return { ok: true, message: "Item removed." };
}

/* ─────────────── Labour rate cards ─────────────── */

export async function saveLabourRate(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await manager();
  const parsed = z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1, "Name the rate card").max(80),
    vehicleCategory: z.string().max(40).optional(),
    ratePerHour: z.coerce.number().min(0).max(100000),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the rate." };

  const isDefault = onOff(fd, "isDefault");
  if (isDefault) await sb.from("garage_labour_rates").update({ is_default: false }).eq("garage_id", garage.id);

  const row = {
    garage_id: garage.id, name: parsed.data.name,
    vehicle_category: parsed.data.vehicleCategory ?? null,
    rate_per_hour_paise: Math.round(parsed.data.ratePerHour * 100),
    is_default: isDefault,
  };
  const { error } = parsed.data.id
    ? await sb.from("garage_labour_rates").update(row).eq("id", parsed.data.id).eq("garage_id", garage.id)
    : await sb.from("garage_labour_rates").insert(row);
  if (error) return { error: "Could not save the rate card." };

  touched("/garage/settings/rates", "/garage/quotes/new");
  return { ok: true, message: "Rate card saved." };
}

/* ─────────────── Terms shown to customers ─────────────── */

export async function saveTerms(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await owner();
  const parsed = z.object({
    warrantyPolicy: z.string().max(4000).optional(),
    cancellationPolicy: z.string().max(4000).optional(),
    serviceTerms: z.string().max(8000).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: "Those terms are too long." };

  const { error } = await sb.from("garage_terms").upsert({
    garage_id: garage.id,
    warranty_policy: parsed.data.warrantyPolicy ?? null,
    cancellation_policy: parsed.data.cancellationPolicy ?? null,
    service_terms: parsed.data.serviceTerms ?? null,
  });
  if (error) return { error: "Could not save your terms." };

  touched("/garage/settings/terms", `/garages/${garage.slug}`);
  return { ok: true, message: "Saved. These appear on your public profile and at checkout." };
}

/* ─────────────── Services and prices ─────────────── */

export async function saveService(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await owner();
  const parsed = z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1, "Name the service").max(120),
    description: z.string().max(500).optional(),
    categoryId: z.coerce.number().int().positive(),
    packageId: z.coerce.number().int().positive().optional(),
    labour: z.coerce.number().min(0).max(1_000_000),
    parts: z.coerce.number().min(0).max(1_000_000),
    consumables: z.coerce.number().min(0).max(1_000_000),
    inspectionFee: z.coerce.number().min(0).max(100000).optional(),
    gstPct: z.coerce.number().min(0).max(28),
    estMinutes: z.coerce.number().int().min(15).max(1440),
    warrantyDays: z.coerce.number().int().min(0).max(3650),
    includedItems: z.string().max(600).optional(),
    exclusions: z.string().max(600).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the service." };
  const p = parsed.data;

  const row = {
    garage_id: garage.id, name: p.name, description: p.description ?? null,
    category_id: p.categoryId, package_id: p.packageId ?? null,
    labour_paise: Math.round(p.labour * 100), parts_paise: Math.round(p.parts * 100),
    consumables_paise: Math.round(p.consumables * 100),
    inspection_fee_paise: Math.round((p.inspectionFee ?? 0) * 100),
    gst_rate_bps: Math.round(p.gstPct * 100), est_minutes: p.estMinutes, warranty_days: p.warrantyDays,
    included_items: (p.includedItems ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    exclusions: p.exclusions ?? null,
    active: !onOff(fd, "hidden"),
  };

  const { error } = p.id
    ? await sb.from("garage_services").update(row).eq("id", p.id).eq("garage_id", garage.id)
    : await sb.from("garage_services").insert(row);
  if (error) return { error: "Could not save the service." };

  touched("/garage/services", `/garages/${garage.slug}`, "/find");
  return { ok: true, message: p.id ? "Service updated." : "Service published to your profile." };
}

export async function toggleService(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await owner();
  const id = String(fd.get("id"));
  const { data } = await sb.from("garage_services").select("active").eq("id", id).eq("garage_id", garage.id).maybeSingle();
  if (!data) return { error: "Service not found." };
  await sb.from("garage_services").update({ active: !data.active }).eq("id", id).eq("garage_id", garage.id);
  touched("/garage/services", `/garages/${garage.slug}`, "/find");
  return { ok: true, message: data.active ? "Hidden from your profile." : "Published to your profile." };
}

/* ─────────────── Team ─────────────── */

export async function inviteStaff(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await owner();
  const parsed = z.object({
    email: z.string().email("Enter a valid email address"),
    role: z.enum(["service_advisor", "technician", "garage_owner"]),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the invitation." };

  const { error } = await sb.from("staff_invites")
    .insert({ garage_id: garage.id, email: parsed.data.email.toLowerCase(), role: parsed.data.role });
  if (error) return { error: error.code === "23505" ? "That person already has an invitation." : "Could not create the invitation." };

  touched("/garage/team");
  return { ok: true, message: "Invitation created. Send them the link from the list below." };
}

export async function removeMember(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage, user } = await owner();
  const userId = String(fd.get("userId"));
  if (userId === user.id) return { error: "You cannot remove yourself from the garage." };

  const { count } = await sb.from("garage_members")
    .select("user_id", { count: "exact", head: true }).eq("garage_id", garage.id).eq("role", "garage_owner");
  const { data: target } = await sb.from("garage_members")
    .select("role").eq("garage_id", garage.id).eq("user_id", userId).maybeSingle();
  if (target?.role === "garage_owner" && (count ?? 0) <= 1) {
    return { error: "A garage must keep at least one owner." };
  }

  await sb.from("garage_members").delete().eq("garage_id", garage.id).eq("user_id", userId);
  touched("/garage/team");
  return { ok: true, message: "Removed from this garage." };
}
