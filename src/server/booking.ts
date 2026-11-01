"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { istYmd, slotsForDay } from "@/lib/availability";
import { getBusy, getHolidays, getHours, getSettings, rulesFrom } from "@/lib/garage-data";
import type { BookingStatus } from "@/lib/booking";

export interface ActionState { error?: string; ok?: boolean; message?: string }

const bookingInput = z.object({
  garageId: z.string().uuid(),
  serviceId: z.string().uuid().optional(),
  vehicleId: z.string().uuid(),
  slotStart: z.string().datetime(),
  durationMinutes: z.coerce.number().int().min(15).max(1440),
  note: z.string().max(1000).optional(),
  pickup: z.coerce.boolean().optional(),
});

/**
 * Creates a booking only after re-deriving availability on the server. The slot the
 * browser submitted is never trusted; it has to still be offerable at this moment.
 */
export async function createBooking(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = bookingInput.safeParse({
    garageId: fd.get("garageId"), serviceId: fd.get("serviceId") || undefined, vehicleId: fd.get("vehicleId"),
    slotStart: fd.get("slotStart"), durationMinutes: fd.get("durationMinutes"),
    note: fd.get("note") || undefined, pickup: fd.get("pickup") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
  const i = parsed.data;

  const sb = await supabaseServer();

  const { data: vehicle } = await sb.from("vehicles").select("id").eq("id", i.vehicleId).eq("owner_id", user.id).maybeSingle();
  if (!vehicle) return { error: "Choose one of your own vehicles." };

  const { data: garage } = await sb.from("garages").select("id, bays_count, status").eq("id", i.garageId).maybeSingle();
  if (!garage || garage.status !== "active") return { error: "This garage is not accepting bookings right now." };

  const start = new Date(i.slotStart);
  const ymd = istYmd(start);
  const [settings, hours, holidays] = await Promise.all([
    getSettings(sb, i.garageId), getHours(sb, i.garageId), getHolidays(sb, i.garageId),
  ]);
  if (settings && !settings.online_booking) return { error: "This garage has switched off online booking." };

  const dayStart = new Date(start.getTime() - 24 * 3600_000);
  const dayEnd = new Date(start.getTime() + 24 * 3600_000);
  const busy = await getBusy(sb, i.garageId, dayStart, dayEnd);

  const slots = slotsForDay({
    ymd, durationMinutes: i.durationMinutes, hours, holidays, busy,
    rules: rulesFrom(settings, garage.bays_count ?? 1), now: new Date(),
  });
  const match = slots.find((s) => s.start.getTime() === start.getTime());
  if (!match) return { error: "That slot has just been taken. Pick another time." };

  const end = new Date(start.getTime() + i.durationMinutes * 60_000);
  let quoted: number | null = null;
  if (i.serviceId) {
    const { data: svc } = await sb.from("garage_services")
      .select("labour_paise, parts_paise, consumables_paise, gst_rate_bps")
      .eq("id", i.serviceId).eq("garage_id", i.garageId).maybeSingle();
    if (svc) {
      const base = svc.labour_paise + svc.parts_paise + svc.consumables_paise;
      quoted = base + Math.round((base * svc.gst_rate_bps) / 10000);
    }
  }

  const { data: booking, error } = await sb.from("bookings").insert({
    garage_id: i.garageId, customer_id: user.id, vehicle_id: i.vehicleId, service_id: i.serviceId ?? null,
    origin: "marketplace", status: "requested", slot_start: start.toISOString(), slot_end: end.toISOString(),
    quoted_total_paise: quoted, price_source: "independent_garage_confirmed",
    pickup_requested: !!i.pickup, customer_note: i.note ?? null,
  }).select("id").single();

  if (error) return { error: "That slot could not be held. Pick another time." };

  // Hand it to the garage. The database validates every transition, including this one.
  await sb.rpc("transition_booking", {
    p_booking: booking.id, p_to: "awaiting_garage_confirmation", p_message: "Booking requested by customer",
  });

  revalidatePath("/app/bookings");
  redirect(`/app/bookings/${booking.id}?new=1`);
}

const moveInput = z.object({
  bookingId: z.string().uuid(),
  to: z.string(),
  message: z.string().max(500).optional(),
});

/** Every status change in the product goes through here, and therefore through the database rules. */
export async function moveBooking(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const parsed = moveInput.safeParse({ bookingId: fd.get("bookingId"), to: fd.get("to"), message: fd.get("message") || undefined });
  if (!parsed.success) return { error: "That action is not available." };

  const sb = await supabaseServer();
  const { error } = await sb.rpc("transition_booking", {
    p_booking: parsed.data.bookingId,
    p_to: parsed.data.to as BookingStatus,
    p_message: parsed.data.message ?? null,
  });
  if (error) return { error: error.message.replace(/^.*?:\s*/, "") };

  revalidatePath(`/app/bookings/${parsed.data.bookingId}`);
  revalidatePath("/garage/bookings");
  revalidatePath("/garage");
  return { ok: true, message: "Updated." };
}

export async function cancelBooking(_: ActionState, fd: FormData): Promise<ActionState> {
  const fd2 = new FormData();
  fd2.set("bookingId", String(fd.get("bookingId") ?? ""));
  fd2.set("to", "cancelled");
  fd2.set("message", String(fd.get("reason") ?? "Cancelled"));
  return moveBooking({}, fd2);
}
