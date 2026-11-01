"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { ROLES } from "@/lib/permissions";
import type { ActionState } from "./booking";

const clean = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => String(v).trim() !== ""));
const onOff = (fd: FormData, n: string) => fd.get(n) === "on" || fd.get(n) === "true";

/** Platform staff only. Row-level security refuses these writes for anyone else regardless. */
async function admin() {
  const user = await requireUser();
  if (user.role !== "super_admin") throw new Error("Not permitted");
  return { user, sb: await supabaseServer() };
}
async function staff() {
  const user = await requireUser();
  if (!["super_admin", "quality_auditor", "support_agent"].includes(user.role)) throw new Error("Not permitted");
  return { user, sb: await supabaseServer() };
}

type Sb = Awaited<ReturnType<typeof supabaseServer>>;
async function log(sb: Sb, actorId: string, action: string, entity: string, entityId: string, meta: Record<string, unknown> = {}) {
  await sb.from("audit_logs").insert({ actor_id: actorId, action, entity, entity_id: entityId, meta });
}

/* ─────────────── Garage lifecycle ─────────────── */

export async function setGarageStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, user } = await admin();
  const parsed = z.object({
    id: z.string().uuid(),
    status: z.enum(["active", "suspended", "rejected", "pending"]),
    note: z.string().max(500).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: "That status is not valid." };

  const { error } = await sb.from("garages").update({ status: parsed.data.status }).eq("id", parsed.data.id);
  if (error) return { error: "Could not change the status." };

  await log(sb, user.id, `garage.${parsed.data.status}`, "garage", parsed.data.id, { note: parsed.data.note ?? null });
  revalidatePath("/admin/garages");
  revalidatePath(`/admin/garages/${parsed.data.id}`);
  revalidatePath("/find");
  return {
    ok: true,
    message: parsed.data.status === "active" ? "Approved. The garage is now listed."
      : parsed.data.status === "suspended" ? "Suspended. Their own records stay available to them."
      : "Status updated.",
  };
}

/**
 * Verification is deliberately separate from approval and from any subscription.
 * It can only be set here, alongside the audit record that justifies it.
 */
export async function setVerification(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, user } = await staff();
  if (!["super_admin", "quality_auditor"].includes(user.role)) return { error: "Only an auditor can change verification." };

  const parsed = z.object({
    id: z.string().uuid(),
    level: z.enum(["none", "listed", "verified", "quality_assured"]),
    validMonths: z.coerce.number().int().min(1).max(60).optional(),
    findings: z.string().max(4000).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: "Check the verification details." };

  const now = new Date();
  const expires = new Date(now);
  expires.setMonth(expires.getMonth() + (parsed.data.validMonths ?? 12));

  const { error } = await sb.from("garages").update({
    verification: parsed.data.level,
    verified_at: parsed.data.level === "none" ? null : now.toISOString(),
    verification_expires_at: parsed.data.level === "none" ? null : expires.toISOString(),
  }).eq("id", parsed.data.id);
  if (error) return { error: "Could not record the verification." };

  await sb.from("garage_audits").insert({
    garage_id: parsed.data.id, auditor_id: user.id, findings: parsed.data.findings ?? null,
    result: parsed.data.level, valid_until: expires.toISOString().slice(0, 10),
  });
  await log(sb, user.id, `verification.${parsed.data.level}`, "garage", parsed.data.id, { validMonths: parsed.data.validMonths ?? 12 });

  revalidatePath(`/admin/garages/${parsed.data.id}`);
  revalidatePath("/admin/garages");
  revalidatePath("/find");
  return { ok: true, message: `Recorded as ${parsed.data.level.replace("_", "-")}, with the audit date and expiry attached.` };
}

/* ─────────────── People ─────────────── */

export async function setUserRole(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, user } = await admin();
  const parsed = z.object({
    id: z.string().uuid(),
    role: z.enum(ROLES),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: "That role is not valid." };
  if (parsed.data.id === user.id) return { error: "You cannot change your own role." };

  const { error } = await sb.from("profiles").update({ role: parsed.data.role }).eq("id", parsed.data.id);
  if (error) return { error: "Could not change the role." };

  await log(sb, user.id, "user.role_changed", "profile", parsed.data.id, { role: parsed.data.role });
  revalidatePath("/admin/users");
  return { ok: true, message: `Role set to ${parsed.data.role.replace(/_/g, " ")}.` };
}

/* ─────────────── Monetisation ─────────────── */

export async function saveCommissionRule(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, user } = await admin();
  const parsed = z.object({
    id: z.coerce.number().int().positive().optional(),
    garageId: z.string().uuid().optional(),
    type: z.enum(["fixed", "pct_labour", "pct_total"]),
    amount: z.coerce.number().min(0).max(1_000_000).optional(),
    ratePct: z.coerce.number().min(0).max(100).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: "Check the commission rule." };
  const p = parsed.data;

  if (p.type === "fixed" && p.amount == null) return { error: "Enter the fixed fee." };
  if (p.type !== "fixed" && p.ratePct == null) return { error: "Enter the percentage." };

  const row = {
    garage_id: p.garageId ?? null, type: p.type,
    amount_paise: p.type === "fixed" ? Math.round((p.amount ?? 0) * 100) : null,
    rate_bps: p.type === "fixed" ? null : Math.round((p.ratePct ?? 0) * 100),
    active: true,
  };

  const { error } = p.id
    ? await sb.from("commission_rules").update(row).eq("id", p.id)
    : await sb.from("commission_rules").insert(row);
  if (error) return { error: "Could not save the rule." };

  await log(sb, user.id, "commission.rule_saved", "commission_rule", String(p.id ?? "new"), row);
  revalidatePath("/admin/commissions");
  return { ok: true, message: "Saved. It applies to marketplace bookings that complete from now on." };
}

export async function savePlan(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, user } = await admin();
  const parsed = z.object({
    id: z.string().min(2).max(40).regex(/^[a-z0-9_-]+$/, "Use lowercase letters, numbers, - or _"),
    name: z.string().min(1).max(60),
    price: z.coerce.number().min(0).max(1_000_000),
    interval: z.enum(["month", "year"]),
    trialDays: z.coerce.number().int().min(0).max(365),
    maxUsers: z.coerce.number().int().min(1).max(1000).optional(),
    maxBranches: z.coerce.number().int().min(1).max(500).optional(),
    features: z.string().max(2000).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the plan." };
  const p = parsed.data;

  let features: Record<string, boolean> = {};
  if (p.features) {
    try { features = JSON.parse(p.features); } catch { return { error: "Features must be valid JSON." }; }
  }

  const { error } = await sb.from("subscription_plans").upsert({
    id: p.id, name: p.name, price_paise: Math.round(p.price * 100), interval: p.interval,
    trial_days: p.trialDays, max_users: p.maxUsers ?? null, max_branches: p.maxBranches ?? null,
    features, active: !onOff(fd, "hidden"),
  });
  if (error) return { error: "Could not save the plan." };

  await log(sb, user.id, "plan.saved", "subscription_plan", p.id, { price: p.price });
  revalidatePath("/admin/plans");
  revalidatePath("/pricing");
  return { ok: true, message: "Plan saved and published to the pricing page." };
}

/* ─────────────── Platform configuration ─────────────── */

export async function setFeatureFlag(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, user } = await admin();
  const key = String(fd.get("key"));
  const { data } = await sb.from("feature_flags").select("enabled").eq("key", key).maybeSingle();
  if (!data) return { error: "That flag does not exist." };

  await sb.from("feature_flags").update({ enabled: !data.enabled }).eq("key", key);
  await log(sb, user.id, "flag.toggled", "feature_flag", key, { enabled: !data.enabled });
  revalidatePath("/admin/platform");
  return { ok: true, message: `${key.replace(/_/g, " ")} is now ${!data.enabled ? "on" : "off"} for every garage.` };
}

export async function savePlatformSetting(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, user } = await admin();
  const key = String(fd.get("key"));
  const raw = String(fd.get("value") ?? "");
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { error: "That is not valid JSON." }; }

  const { error } = await sb.from("platform_settings").update({ value }).eq("key", key);
  if (error) return { error: "Could not save the setting." };

  await log(sb, user.id, "settings.saved", "platform_setting", key, {});
  revalidatePath("/admin/platform");
  return { ok: true, message: "Saved." };
}

/* ─────────────── Content ─────────────── */

export async function saveCmsPage(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, user } = await admin();
  const parsed = z.object({
    slug: z.string().min(2).max(60).regex(/^[a-z0-9-]+$/),
    title: z.string().min(1).max(160),
    metaDescription: z.string().max(300).optional(),
    body: z.string().min(1).max(60000),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the page." };

  const { error } = await sb.from("cms_pages").upsert({
    slug: parsed.data.slug, title: parsed.data.title,
    meta_description: parsed.data.metaDescription ?? null, body: parsed.data.body,
    published: !onOff(fd, "hidden"), updated_by: user.id,
  });
  if (error) return { error: "Could not save the page." };

  await log(sb, user.id, "cms.saved", "cms_page", parsed.data.slug, {});
  revalidatePath(`/legal/${parsed.data.slug}`);
  revalidatePath("/admin/content");
  return { ok: true, message: "Published." };
}

export async function saveFaq(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, user } = await admin();
  const parsed = z.object({
    id: z.coerce.number().int().positive().optional(),
    topic: z.string().min(1).max(40),
    question: z.string().min(5).max(300),
    answer: z.string().min(5).max(4000),
    audience: z.enum(["customer", "garage"]),
    sort: z.coerce.number().int().min(0).max(999).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the answer." };
  const p = parsed.data;

  const row = { topic: p.topic, question: p.question, answer: p.answer, audience: p.audience, sort: p.sort ?? 0, published: !onOff(fd, "hidden") };
  const { error } = p.id
    ? await sb.from("faqs").update(row).eq("id", p.id)
    : await sb.from("faqs").insert(row);
  if (error) return { error: "Could not save." };

  await log(sb, user.id, "faq.saved", "faq", String(p.id ?? "new"), {});
  revalidatePath("/help");
  revalidatePath("/admin/content");
  return { ok: true, message: "Saved to the help centre." };
}

/* ─────────────── Compliance and support ─────────────── */

export async function resolveViolation(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, user } = await admin();
  const id = Number(fd.get("id"));
  await sb.from("pricing_violations").update({ resolved_at: new Date().toISOString() }).eq("id", id);
  await log(sb, user.id, "compliance.resolved", "pricing_violation", String(id), {});
  revalidatePath("/admin/compliance");
  return { ok: true, message: "Marked as reviewed." };
}

export async function updateTicket(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, user } = await staff();
  const parsed = z.object({
    id: z.string().uuid(),
    status: z.enum(["open", "in_progress", "awaiting_customer", "awaiting_garage", "resolved", "closed"]),
    resolution: z.string().max(4000).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: "Check the ticket update." };

  const { error } = await sb.from("support_tickets").update({
    status: parsed.data.status,
    resolution: parsed.data.resolution ?? null,
    assignee_id: user.id,
  }).eq("id", parsed.data.id);
  if (error) return { error: "Could not update the ticket." };

  await log(sb, user.id, `ticket.${parsed.data.status}`, "support_ticket", parsed.data.id, {});
  revalidatePath("/admin/tickets");
  return { ok: true, message: "Ticket updated." };
}
