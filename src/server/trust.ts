"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, requireGarageOrRedirect } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import type { ActionState } from "./booking";

const clean = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => String(v).trim() !== ""));
const rupees = (v: unknown) => Math.round(Number(v ?? 0) * 100);

/* ───────────── Repair necessity review ───────────── */

export async function requestRepairReview(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({
    vehicleId: z.string().uuid().optional(),
    bookingId: z.string().uuid().optional(),
    publicationId: z.string().uuid().optional(),
    question: z.string().trim().min(10, "Tell us what you have been quoted for").max(4000),
    quotedTotal: z.coerce.number().min(0).max(10_000_000).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };

  const sb = await supabaseServer();
  const { error } = await sb.from("repair_reviews").insert({
    customer_id: user.id,
    vehicle_id: parsed.data.vehicleId ?? null,
    booking_id: parsed.data.bookingId ?? null,
    publication_id: parsed.data.publicationId ?? null,
    question: parsed.data.question,
    quoted_total_paise: parsed.data.quotedTotal != null ? rupees(parsed.data.quotedTotal) : null,
    status: "requested",
  });
  if (error) return { error: "Could not send that for review. Try again in a moment." };

  revalidatePath("/app/advice");
  return { ok: true, message: "Sent. A MEQIVA reviewer looks at this, not the garage that quoted you." };
}

export async function withdrawRepairReview(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const sb = await supabaseServer();
  await sb.from("repair_reviews").update({ status: "withdrawn" })
    .eq("id", String(fd.get("id"))).eq("customer_id", user.id).in("status", ["requested", "in_review"]);
  revalidatePath("/app/advice");
  return { ok: true, message: "Withdrawn." };
}

/** Answered by a quality auditor. The garage that quoted never sees any of this. */
export async function answerRepairReview(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!["super_admin", "quality_auditor"].includes(user.role)) return { error: "Only a MEQIVA auditor can answer a review." };

  const parsed = z.object({
    id: z.string().uuid(),
    verdict: z.enum(["necessary", "advisable", "can_wait", "not_needed", "needs_inspection"]),
    rationale: z.string().trim().min(20, "Explain the reasoning — this is the whole point of the service").max(4000),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the answer." };

  const sb = await supabaseServer();
  const { error } = await sb.from("repair_reviews").update({
    status: "answered", reviewer_id: user.id,
    verdict: parsed.data.verdict, rationale: parsed.data.rationale,
    responded_at: new Date().toISOString(),
  }).eq("id", parsed.data.id);
  if (error) return { error: "Could not save that answer." };

  revalidatePath("/admin/advice");
  return { ok: true, message: "Answered. The customer can see it now." };
}

/* ───────────── Second quotation ───────────── */

export async function requestSecondQuote(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({
    vehicleId: z.string().uuid().optional(),
    publicationId: z.string().uuid().optional(),
    excludeGarageId: z.string().uuid().optional(),
    scope: z.string().trim().min(5, "Describe the work you have been quoted for").max(2000),
    vehicleCategory: z.string().max(20).optional(),
    originalTotal: z.coerce.number().min(0).max(10_000_000).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };

  const sb = await supabaseServer();
  const { error } = await sb.from("second_quote_requests").insert({
    customer_id: user.id,
    vehicle_id: parsed.data.vehicleId ?? null,
    publication_id: parsed.data.publicationId ?? null,
    exclude_garage_id: parsed.data.excludeGarageId ?? null,
    scope: parsed.data.scope,
    vehicle_category: parsed.data.vehicleCategory ?? null,
    original_total_paise: parsed.data.originalTotal != null ? rupees(parsed.data.originalTotal) : null,
  });
  if (error) return { error: "Could not open that request." };

  revalidatePath("/app/second-opinion");
  return { ok: true, message: "Open for 72 hours. Other garages nearby can quote; the one that quoted you cannot." };
}

export async function closeSecondQuote(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const sb = await supabaseServer();
  await sb.from("second_quote_requests").update({ status: "closed" })
    .eq("id", String(fd.get("id"))).eq("customer_id", user.id);
  revalidatePath("/app/second-opinion");
  return { ok: true, message: "Closed to new quotes." };
}

/** A garage answering someone else's request. RLS blocks the excluded garage entirely. */
export async function submitSecondQuote(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await requireGarageOrRedirect();
  if (!garage.isManager) return { error: "Only an owner or service advisor can quote." };

  const parsed = z.object({
    requestId: z.string().uuid(),
    total: z.coerce.number().min(1, "Enter your price").max(10_000_000),
    note: z.string().trim().max(2000).optional(),
    estMinutes: z.coerce.number().int().min(10).max(1440).optional(),
    warrantyDays: z.coerce.number().int().min(0).max(3650).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check your quote." };

  const { error } = await sb.from("second_quote_responses").upsert({
    request_id: parsed.data.requestId, garage_id: garage.id,
    total_paise: rupees(parsed.data.total), note: parsed.data.note ?? null,
    est_minutes: parsed.data.estMinutes ?? null, warranty_days: parsed.data.warrantyDays ?? null,
  }, { onConflict: "request_id,garage_id" });
  if (error) {
    return { error: error.code === "42501"
      ? "This request is closed, or it came from a customer you already quoted."
      : "Could not send that quote." };
  }

  revalidatePath("/garage/leads");
  return { ok: true, message: "Sent. The customer sees it alongside the original." };
}

/* ───────────── Warranty ───────────── */

export async function issueWarranty(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await requireGarageOrRedirect();
  if (!garage.isManager) return { error: "Only an owner or service advisor can issue a warranty." };

  const parsed = z.object({
    jobCardId: z.string().uuid().optional(),
    vehicleId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    kind: z.enum(["labour", "part", "platform"]),
    providerName: z.string().trim().min(2, "Who honours this warranty?").max(120),
    covers: z.string().trim().min(10, "Say what is covered").max(2000),
    excludes: z.string().trim().max(2000).optional(),
    months: z.coerce.number().int().min(0).max(120).optional(),
    kmLimit: z.coerce.number().int().min(0).max(1_000_000).optional(),
    odometer: z.coerce.number().int().min(0).max(2_000_000).optional(),
    reference: z.string().trim().max(60).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the warranty." };
  const p = parsed.data;

  const starts = new Date();
  const expires = p.months ? new Date(starts.getTime()) : null;
  if (expires && p.months) expires.setMonth(expires.getMonth() + p.months);

  const { error } = await sb.from("warranties").insert({
    garage_id: garage.id, job_card_id: p.jobCardId ?? null, vehicle_id: p.vehicleId ?? null,
    customer_id: p.customerId ?? null, kind: p.kind, provider_name: p.providerName,
    covers: p.covers, excludes: p.excludes ?? null,
    starts_on: starts.toISOString().slice(0, 10),
    expires_on: expires ? expires.toISOString().slice(0, 10) : null,
    km_limit: p.kmLimit || null, odometer_at_start: p.odometer ?? null,
    reference: p.reference ?? null,
  });
  if (error) return { error: "Could not record that warranty." };

  revalidatePath("/garage/warranties");
  revalidatePath("/app/warranties");
  return { ok: true, message: "Recorded. The customer sees who honours it and when it ends." };
}

export async function claimWarranty(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({
    warrantyId: z.string().uuid(),
    description: z.string().trim().min(10, "Describe what has gone wrong").max(4000),
    odometerKm: z.coerce.number().int().min(0).max(2_000_000).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };

  const sb = await supabaseServer();
  const { error } = await sb.from("warranty_claims").insert({
    warranty_id: parsed.data.warrantyId, customer_id: user.id,
    description: parsed.data.description, odometer_km: parsed.data.odometerKm ?? null,
  });
  if (error) return { error: "Could not open that claim." };

  revalidatePath("/app/warranties");
  return { ok: true, message: "Claim opened. The garage that gave the warranty is notified." };
}

/* ───────────── Household ───────────── */

export async function createHousehold(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({ name: z.string().trim().min(2, "Give the account a name").max(80) }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the name." };

  const sb = await supabaseServer();
  const { data, error } = await sb.from("households")
    .insert({ name: parsed.data.name, created_by: user.id }).select("id").single();
  if (error || !data) return { error: "Could not create that account." };

  await sb.from("household_members").insert({
    household_id: data.id, user_id: user.id, role: "owner", can_book: true, can_approve: true,
  });
  revalidatePath("/app/family");
  return { ok: true, message: "Created. Add the vehicles you want everyone to see." };
}

export async function shareVehicle(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const vehicleId = String(fd.get("vehicleId"));
  const householdId = String(fd.get("householdId") || "");

  const sb = await supabaseServer();
  const { error } = await sb.from("vehicles")
    .update({ household_id: householdId || null })
    .eq("id", vehicleId).eq("owner_id", user.id);
  if (error) return { error: "Could not change that." };

  revalidatePath("/app/family");
  revalidatePath("/app/vehicles");
  return { ok: true, message: householdId ? "Shared with the family account." : "No longer shared." };
}

export async function addHouseholdMember(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = z.object({
    householdId: z.string().uuid(),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    canApprove: z.coerce.boolean().optional(),
  }).safeParse({ ...clean(fd), canApprove: fd.get("canApprove") === "on" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };

  const sb = await supabaseServer();
  // The lookup happens inside a security-definer function so email addresses never
  // leave the database, and only the household owner can run it.
  const { data, error } = await sb.rpc("invite_to_household", {
    p_household: parsed.data.householdId,
    p_email: parsed.data.email,
    p_can_approve: !!parsed.data.canApprove,
  });
  if (error) return { error: error.message.replace(/^.*?:\s*/, "") };
  if (data === "no_account") {
    return { error: "That email has no MEQIVA account yet. Ask them to sign up first, then add them here." };
  }
  if (data === "self") return { error: "You are already on this account." };

  revalidatePath("/app/family");
  return { ok: true, message: "Added. They can see the shared vehicles straight away." };
}

/* ───────────── Pre-owned inspection ───────────── */

export async function orderInspection(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({
    packageId: z.coerce.number().int().positive(),
    vehicleDescription: z.string().trim().min(4, "Which vehicle is it?").max(200),
    registration: z.string().trim().max(15).optional(),
    sellerContact: z.string().trim().max(120).optional(),
    inspectAt: z.string().trim().max(300).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };

  const sb = await supabaseServer();
  const { data: pkg } = await sb.from("inspection_packages")
    .select("price_paise").eq("id", parsed.data.packageId).eq("active", true).maybeSingle();
  if (!pkg) return { error: "That inspection is not available." };

  const { data, error } = await sb.from("inspection_orders").insert({
    customer_id: user.id, package_id: parsed.data.packageId,
    vehicle_description: parsed.data.vehicleDescription,
    registration: parsed.data.registration ?? null,
    seller_contact: parsed.data.sellerContact ?? null,
    inspect_at: parsed.data.inspectAt ?? null,
    price_paise: pkg.price_paise,
  }).select("id").single();
  if (error || !data) return { error: "Could not place that order." };

  revalidatePath("/app/inspections");
  redirect("/app/inspections?placed=1");
}

/* ───────────── Technician credentials ───────────── */

export async function saveCredential(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await requireGarageOrRedirect();
  if (!garage.isManager) return { error: "Only an owner or service advisor can add a credential." };

  const parsed = z.object({
    displayName: z.string().trim().min(2, "Whose credential is this?").max(80),
    credentialTypeId: z.coerce.number().int().positive(),
    reference: z.string().trim().max(60).optional(),
    issuedOn: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).optional(),
    yearsExperience: z.coerce.number().int().min(0).max(60).optional(),
    userId: z.string().uuid().optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };

  const { error } = await sb.from("technician_credentials").insert({
    garage_id: garage.id, user_id: parsed.data.userId ?? null,
    display_name: parsed.data.displayName, credential_type_id: parsed.data.credentialTypeId,
    reference: parsed.data.reference ?? null, issued_on: parsed.data.issuedOn || null,
    years_experience: parsed.data.yearsExperience ?? null,
  });
  if (error) return { error: "Could not save that credential." };

  revalidatePath("/garage/credentials");
  return { ok: true, message: "Saved. It shows publicly once a MEQIVA auditor has checked it." };
}

/** Verification is the auditor's call, never the garage's. */
export async function verifyCredential(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!["super_admin", "quality_auditor"].includes(user.role)) return { error: "Only an auditor can verify a credential." };

  const sb = await supabaseServer();
  const approve = String(fd.get("decision")) === "verify";
  const { error } = await sb.from("technician_credentials").update(
    approve
      ? { verified_by: user.id, verified_at: new Date().toISOString(), active: true }
      : { verified_by: null, verified_at: null, active: false },
  ).eq("id", String(fd.get("id")));
  if (error) return { error: "Could not update that credential." };

  revalidatePath("/admin/credentials");
  return { ok: true, message: approve ? "Verified and now shown publicly." : "Rejected and hidden." };
}
