"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import type { ActionState } from "./booking";

/* ───────────────── Vehicles ───────────────── */

const vehicleInput = z.object({
  modelId: z.coerce.number().int().positive(),
  variantId: z.coerce.number().int().positive().optional(),
  year: z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1).optional(),
  regNo: z.string().trim().max(15).regex(/^[A-Za-z0-9 -]*$/, "Use letters and numbers only").optional(),
  odometerKm: z.coerce.number().int().min(0).max(2_000_000).optional(),
  lastServiceOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  lastServiceKm: z.coerce.number().int().min(0).max(2_000_000).optional(),
  notes: z.string().max(1000).optional(),
});

const clean = (fd: FormData) =>
  Object.fromEntries([...fd.entries()].filter(([, v]) => String(v).trim() !== ""));

export async function saveVehicle(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = vehicleInput.safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the vehicle details." };
  const v = parsed.data;

  const sb = await supabaseServer();
  const row = {
    owner_id: user.id, model_id: v.modelId, variant_id: v.variantId ?? null, year: v.year ?? null,
    reg_no: v.regNo ? v.regNo.toUpperCase().replace(/\s+/g, "") : null,
    odometer_km: v.odometerKm ?? null, last_service_on: v.lastServiceOn ?? null,
    last_service_km: v.lastServiceKm ?? null, notes: v.notes ?? null,
  };

  const id = String(fd.get("id") ?? "");
  const { error } = id
    ? await sb.from("vehicles").update(row).eq("id", id).eq("owner_id", user.id)
    : await sb.from("vehicles").insert(row);

  if (error) {
    return { error: error.code === "23505" ? "That registration number is already saved." : "Could not save the vehicle." };
  }
  revalidatePath("/app/vehicles");
  return { ok: true, message: id ? "Vehicle updated." : "Vehicle added." };
}

export async function deleteVehicle(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const sb = await supabaseServer();
  const { error } = await sb.from("vehicles").delete().eq("id", String(fd.get("id"))).eq("owner_id", user.id);
  if (error) return { error: "This vehicle has service history and cannot be removed." };
  revalidatePath("/app/vehicles");
  return { ok: true, message: "Vehicle removed." };
}

/** History from before MEQIVA. Stored separately from verified records and always labelled. */
export async function addServiceRecord(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({
    vehicleId: z.string().uuid(),
    servicedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick the date of the service"),
    odometerKm: z.coerce.number().int().min(0).optional(),
    garageName: z.string().max(120).optional(),
    summary: z.string().max(1000).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };

  const sb = await supabaseServer();
  const { error } = await sb.from("vehicle_service_records").insert({
    vehicle_id: parsed.data.vehicleId, owner_id: user.id, source: "customer_upload",
    serviced_on: parsed.data.servicedOn, odometer_km: parsed.data.odometerKm ?? null,
    garage_name: parsed.data.garageName ?? null, summary: parsed.data.summary ?? null,
  });
  if (error) return { error: "Could not save that record." };
  revalidatePath(`/app/vehicles/${parsed.data.vehicleId}`);
  return { ok: true, message: "Added to history, marked as unverified." };
}

/* ───────────────── Quotation decisions ───────────────── */

export async function decideQuote(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = z.object({
    publicationId: z.string().uuid(),
    decision: z.enum(["approved", "rejected"]),
    reason: z.string().max(500).optional(),
    bookingId: z.string().uuid().optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: "That decision could not be recorded." };

  const sb = await supabaseServer();
  const { error } = await sb.rpc("decide_quote", {
    p_publication: parsed.data.publicationId,
    p_decision: parsed.data.decision,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) return { error: error.message.replace(/^.*?:\s*/, "") };

  if (parsed.data.bookingId) revalidatePath(`/app/bookings/${parsed.data.bookingId}`);
  revalidatePath("/app/bookings");
  return {
    ok: true,
    message: parsed.data.decision === "approved"
      ? "Approved. The garage can carry on."
      : "Declined. Only the work you already approved will be done.",
  };
}

/* ───────────────── Reviews ───────────────── */

export async function submitReview(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const score = z.coerce.number().int().min(1).max(5);
  const parsed = z.object({
    bookingId: z.string().uuid(), garageId: z.string().uuid(), rating: score,
    quality: score.optional(), priceTransparency: score.optional(),
    timeliness: score.optional(), communication: score.optional(),
    remarks: z.string().max(2000).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: "Give the service a rating from 1 to 5." };
  const r = parsed.data;

  const sb = await supabaseServer();
  const { error } = await sb.from("reviews").insert({
    booking_id: r.bookingId, garage_id: r.garageId, customer_id: user.id, rating: r.rating,
    quality: r.quality ?? null, price_transparency: r.priceTransparency ?? null,
    timeliness: r.timeliness ?? null, communication: r.communication ?? null,
    remarks: r.remarks ?? null,
  });
  if (error) {
    return { error: error.code === "23505" ? "You have already reviewed this booking." : "Only a completed booking can be reviewed." };
  }
  revalidatePath(`/app/bookings/${r.bookingId}`);
  return { ok: true, message: "Thanks — your review is published." };
}

/* ───────────────── Support ───────────────── */

export async function raiseTicket(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({
    bookingId: z.string().uuid().optional(),
    garageId: z.string().uuid().optional(),
    category: z.string().min(2).max(60),
    description: z.string().min(10, "Tell us a little more so we can help").max(4000),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };

  const sb = await supabaseServer();
  const { error } = await sb.from("support_tickets").insert({
    customer_id: user.id, booking_id: parsed.data.bookingId ?? null, garage_id: parsed.data.garageId ?? null,
    category: parsed.data.category, description: parsed.data.description,
  });
  if (error) return { error: "Could not open the ticket. Try again." };
  if (parsed.data.bookingId) revalidatePath(`/app/bookings/${parsed.data.bookingId}`);
  return { ok: true, message: "Ticket opened. The garage is notified and MEQIVA can step in if it is not resolved." };
}
