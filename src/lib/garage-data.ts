import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_HOURS, type AvailabilityRules, type BusyInterval, type OpeningHours } from "./availability";
import { resolveFeatures, type FeatureMap, type GarageFeature } from "./features";
import type { FieldDef, FieldEntity } from "./fields";

/* Shared loaders used by both the public booking flow and the garage workspace. */

export interface GarageSettings {
  garage_id: string;
  accent_hex: string;
  logo_url: string | null;
  cover_url: string | null;
  tagline: string | null;
  about: string | null;
  locale: string;
  online_booking: boolean;
  min_lead_minutes: number;
  max_advance_days: number;
  slot_minutes: 15 | 30 | 60;
  buffer_minutes: number;
  concurrent_jobs_per_bay: number;
  auto_confirm: boolean;
  deposit_bps: number;
  cancellation_window_hours: number;
  no_show_fee_paise: number;
  pickup_enabled: boolean;
  pickup_fee_paise: number;
  pickup_radius_km: number;
  gst_registered: boolean;
  place_of_supply_code: string | null;
  default_gst_bps: number;
  invoice_prefix: string;
  invoice_terms: string | null;
  invoice_footer: string | null;
  default_labour_rate_paise: number;
  target_margin_bps: number;
  low_margin_alert_bps: number;
  default_warranty_days: number;
  features: FeatureMap;
  notify_channels: string[];
}

export const SETTINGS_COLUMNS =
  "garage_id, accent_hex, logo_url, cover_url, tagline, about, locale, online_booking, min_lead_minutes, " +
  "max_advance_days, slot_minutes, buffer_minutes, concurrent_jobs_per_bay, auto_confirm, deposit_bps, " +
  "cancellation_window_hours, no_show_fee_paise, pickup_enabled, pickup_fee_paise, pickup_radius_km, " +
  "gst_registered, place_of_supply_code, default_gst_bps, invoice_prefix, invoice_terms, invoice_footer, " +
  "default_labour_rate_paise, target_margin_bps, low_margin_alert_bps, default_warranty_days, features, notify_channels";

export async function getSettings(sb: SupabaseClient, garageId: string): Promise<GarageSettings | null> {
  const { data } = await sb.from("garage_settings").select(SETTINGS_COLUMNS).eq("garage_id", garageId).maybeSingle();
  return (data as GarageSettings | null) ?? null;
}

export async function getHours(sb: SupabaseClient, garageId: string): Promise<OpeningHours[]> {
  const { data } = await sb.from("garage_hours").select("day, opens, closes, closed").eq("garage_id", garageId);
  if (!data?.length) return DEFAULT_HOURS;
  return data.map((h) => ({ day: h.day, opens: String(h.opens).slice(0, 5), closes: String(h.closes).slice(0, 5), closed: h.closed }));
}

export async function getHolidays(sb: SupabaseClient, garageId: string): Promise<string[]> {
  const { data } = await sb.from("garage_holidays").select("on_date").eq("garage_id", garageId).gte("on_date", new Date().toISOString().slice(0, 10));
  return (data ?? []).map((h) => h.on_date as string);
}

export async function getBusy(sb: SupabaseClient, garageId: string, from: Date, to: Date): Promise<BusyInterval[]> {
  const { data } = await sb.rpc("garage_busy", { p_garage: garageId, p_from: from.toISOString(), p_to: to.toISOString() });
  return ((data ?? []) as { slot_start: string; slot_end: string; bay_id: string | null }[])
    .map((b) => ({ start: new Date(b.slot_start), end: new Date(b.slot_end), bayId: b.bay_id }));
}

export function rulesFrom(s: GarageSettings | null, bays: number): AvailabilityRules {
  return {
    slotMinutes: s?.slot_minutes ?? 30,
    bufferMinutes: s?.buffer_minutes ?? 15,
    minLeadMinutes: s?.min_lead_minutes ?? 120,
    maxAdvanceDays: s?.max_advance_days ?? 30,
    bays: Math.max(1, bays),
    concurrentPerBay: s?.concurrent_jobs_per_bay ?? 1,
    onlineBooking: s?.online_booking ?? true,
  };
}

export async function getFieldDefs(sb: SupabaseClient, garageId: string, entity: FieldEntity): Promise<FieldDef[]> {
  const { data } = await sb
    .from("garage_field_defs")
    .select("id, entity, key, label, help, type, options, required, show_to_customer, sort")
    .eq("garage_id", garageId).eq("entity", entity).eq("active", true).order("sort");
  return (data ?? []).map((d) => ({
    id: d.id, entity: d.entity, key: d.key, label: d.label, help: d.help, type: d.type,
    options: d.options ?? [], required: d.required, showToCustomer: d.show_to_customer, sort: d.sort,
  }));
}

export async function getFeatures(sb: SupabaseClient, garageId: string): Promise<Record<GarageFeature, boolean>> {
  const [flags, settings, sub] = await Promise.all([
    sb.from("feature_flags").select("key, enabled"),
    sb.from("garage_settings").select("features").eq("garage_id", garageId).maybeSingle(),
    sb.from("subscriptions").select("status, current_period_end, subscription_plans(features)").eq("garage_id", garageId).maybeSingle(),
  ]);
  const platform = Object.fromEntries((flags.data ?? []).map((f) => [f.key, f.enabled]));
  const row = sub.data as { status: string; current_period_end: string | null; subscription_plans: { features: FeatureMap } | null } | null;
  const active = !row ? true
    : ["trialing", "active"].includes(row.status) && (!row.current_period_end || new Date(row.current_period_end) > new Date());
  return resolveFeatures({
    platform,
    plan: row?.subscription_plans?.features ?? { inventory: true, crm: true, reminders: true, purchase_orders: true, marketplace_listing: true },
    garage: (settings.data?.features ?? {}) as FeatureMap,
    subscriptionActive: active,
  });
}
