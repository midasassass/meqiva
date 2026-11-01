"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, requireGarageOrRedirect } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import type { ActionState } from "./booking";

const clean = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => String(v).trim() !== ""));
const onOff = (fd: FormData, n: string) => fd.get(n) === "on" || fd.get(n) === "true";
const rupees = (v: unknown) => Math.round(Number(v ?? 0) * 100);

async function staff(roles: string[] = ["super_admin", "quality_auditor"]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new Error("Not permitted");
  return { user, sb: await supabaseServer() };
}

/* ─────────── Repair review triage ─────────── */

/** Claims a request so two auditors do not answer the same one. */
export async function takeRepairReview(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, user } = await staff();
  const { error } = await sb.from("repair_reviews")
    .update({ status: "in_review", reviewer_id: user.id })
    .eq("id", String(fd.get("id"))).eq("status", "requested");
  if (error) return { error: "Could not take that one." };
  revalidatePath("/admin/advice");
  return { ok: true, message: "Yours. The customer sees it is being looked at." };
}

/* ─────────── Warranty claims, answered by the garage ─────────── */

export async function resolveWarrantyClaim(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await requireGarageOrRedirect();
  if (!garage.isManager) return { error: "Only an owner or service advisor can answer a claim." };

  const parsed = z.object({
    id: z.string().uuid(),
    status: z.enum(["accepted", "declined", "resolved"]),
    resolution: z.string().trim().min(10, "Tell the customer what happens next").max(4000),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the answer." };

  // RLS limits this to claims against warranties this garage issued.
  const { error } = await sb.from("warranty_claims")
    .update({ status: parsed.data.status, resolution: parsed.data.resolution })
    .eq("id", parsed.data.id);
  if (error) return { error: "Could not save that." };

  revalidatePath("/garage/warranties");
  revalidatePath("/app/warranties");
  return { ok: true, message: "Saved. The customer can read your answer now." };
}

/* ─────────── Testimonials ─────────── */

/**
 * Testimonials are only ever typed in from something a real customer actually said,
 * with a date they consented to it being published. Nothing here invents a quote, and
 * anything seeded for demonstration keeps its is_demo flag so the public site can say so.
 */
export async function saveTestimonial(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb } = await staff(["super_admin", "support_agent"]);
  const parsed = z.object({
    id: z.string().uuid().optional(),
    authorName: z.string().trim().min(2, "Who said it?").max(80),
    authorContext: z.string().trim().max(120).optional(),
    quote: z.string().trim().min(20, "A testimonial needs at least a sentence").max(600),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    city: z.string().trim().max(60).optional(),
    source: z.enum(["platform_review", "interview", "written"]),
    consentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Record the date they agreed to this being published"),
    garageId: z.string().uuid().optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  const p = parsed.data;

  const row = {
    author_name: p.authorName, author_context: p.authorContext ?? null, quote: p.quote,
    rating: p.rating ?? null, city: p.city ?? null, source: p.source,
    consent_on: p.consentOn, garage_id: p.garageId ?? null,
    published: onOff(fd, "published"), is_demo: false,
  };
  const { error } = p.id
    ? await sb.from("testimonials").update(row).eq("id", p.id)
    : await sb.from("testimonials").insert(row);
  if (error) return { error: "Could not save that." };

  revalidatePath("/admin/testimonials");
  revalidatePath("/");
  return { ok: true, message: row.published ? "Saved and live on the site." : "Saved, not published." };
}

export async function setTestimonialPublished(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb } = await staff(["super_admin", "support_agent"]);
  const publish = String(fd.get("publish")) === "1";
  const { error } = await sb.from("testimonials").update({ published: publish }).eq("id", String(fd.get("id")));
  if (error) return { error: "Could not change that." };
  revalidatePath("/admin/testimonials");
  revalidatePath("/");
  return { ok: true, message: publish ? "Live on the site." : "Taken down." };
}

export async function deleteTestimonial(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb } = await staff(["super_admin", "support_agent"]);
  const id = String(fd.get("id"));
  if (!id) return { error: "Missing testimonial ID." };
  const { error } = await sb.from("testimonials").delete().eq("id", id);
  if (error) return { error: "Could not delete testimonial." };
  revalidatePath("/admin/testimonials");
  revalidatePath("/");
  return { ok: true, message: "Testimonial deleted." };
}

/* ─────────── Roadside assistance directory ─────────── */

export async function saveAssistancePartner(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb } = await staff(["super_admin", "support_agent"]);
  const parsed = z.object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(2, "Name the operator").max(120),
    phone: z.string().trim().min(8, "A working phone number is the whole point").max(20),
    whatsapp: z.string().trim().max(20).optional(),
    city: z.string().trim().max(60).optional(),
    hours: z.string().trim().max(80).optional(),
    notes: z.string().trim().max(600).optional(),
    sort: z.coerce.number().int().min(0).max(999).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  const p = parsed.data;

  const kinds = fd.getAll("kinds").map(String).filter(Boolean);
  if (kinds.length === 0) return { error: "Choose at least one kind of help they provide." };
  const localities = String(fd.get("localities") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

  const row = {
    name: p.name, phone: p.phone, whatsapp: p.whatsapp ?? null,
    city: p.city || "Gurugram", hours: p.hours || "24 hours",
    notes: p.notes ?? null, kinds, localities,
    sort: p.sort ?? 0, active: !onOff(fd, "hidden"),
  };
  const { error } = p.id
    ? await sb.from("assistance_partners").update(row).eq("id", p.id)
    : await sb.from("assistance_partners").insert(row);
  if (error) return { error: "Could not save that partner." };

  revalidatePath("/admin/assistance");
  revalidatePath("/assistance");
  return { ok: true, message: "Saved. It appears publicly straight away; the checked badge needs the step below." };
}

/** The badge means someone rang the number and confirmed it. Only staff can set it. */
export async function setAssistanceVerified(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb } = await staff(["super_admin", "support_agent"]);
  const verify = String(fd.get("verify")) === "1";
  const { error } = await sb.from("assistance_partners")
    .update({ verified_at: verify ? new Date().toISOString() : null })
    .eq("id", String(fd.get("id")));
  if (error) return { error: "Could not change that." };
  revalidatePath("/admin/assistance");
  revalidatePath("/assistance");
  return { ok: true, message: verify ? "Marked as checked today." : "Checked badge removed." };
}

/* ─────────── Inspection orders ─────────── */

export async function scheduleInspection(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb } = await staff(["super_admin", "support_agent", "quality_auditor"]);
  const parsed = z.object({
    id: z.string().uuid(),
    scheduledFor: z.string().min(10, "Pick a date and time"),
    garageId: z.string().uuid().optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };

  const { error } = await sb.from("inspection_orders").update({
    scheduled_for: new Date(parsed.data.scheduledFor).toISOString(),
    garage_id: parsed.data.garageId ?? null,
    status: "scheduled",
  }).eq("id", parsed.data.id);
  if (error) return { error: "Could not schedule that." };

  revalidatePath("/admin/inspections");
  revalidatePath("/app/inspections");
  return { ok: true, message: "Scheduled. The customer can see the time." };
}

export async function publishInspectionReport(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb } = await staff(["super_admin", "quality_auditor"]);
  const parsed = z.object({
    orderId: z.string().uuid(),
    inspectorName: z.string().trim().min(2, "Who inspected it?").max(80),
    overallGrade: z.enum(["A", "B", "C", "D"]),
    headline: z.string().trim().min(10, "One line the buyer should take away").max(200),
    recommendation: z.string().trim().min(20, "Say plainly whether to buy, and on what terms").max(4000),
    estimatedSpend: z.coerce.number().min(0).max(10_000_000).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the report." };
  const p = parsed.data;

  const { error } = await sb.from("inspection_reports").upsert({
    order_id: p.orderId, inspector_name: p.inspectorName, overall_grade: p.overallGrade,
    headline: p.headline, recommendation: p.recommendation,
    estimated_spend_paise: p.estimatedSpend != null ? rupees(p.estimatedSpend) : null,
    published_at: new Date().toISOString(),
  }, { onConflict: "order_id" });
  if (error) return { error: "Could not publish that report." };

  await sb.from("inspection_orders").update({ status: "reported" }).eq("id", p.orderId);
  revalidatePath("/admin/inspections");
  revalidatePath("/app/inspections");
  return { ok: true, message: "Published. The buyer has it now." };
}
