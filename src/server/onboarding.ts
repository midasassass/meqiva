"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { DEFAULT_HOURS } from "@/lib/availability";
import type { ActionState } from "./booking";

/**
 * Creates the garage through register_garage(), which is the only route that can make a
 * signed-in person a garage owner. It refuses a second garage, refuses platform staff,
 * and can never grant a verification level — that still has to be earned by audit.
 */
export async function registerGarage(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = z.object({
    publicName: z.string().trim().min(2, "Enter the garage name").max(120),
    phone: z.string().trim().regex(/^$|^[0-9+\-\s]{7,15}$/, "Enter a valid phone number").optional(),
    locality: z.string().trim().max(80).optional(),
    address: z.string().trim().max(300).optional(),
    pincode: z.string().trim().regex(/^$|^[0-9]{6}$/, "A pincode is six digits").optional(),
    bays: z.coerce.number().int().min(1, "At least one bay").max(100),
    gstin: z.string().trim().regex(/^$|^[0-9A-Za-z]{15}$/, "A GSTIN is 15 characters").optional(),
  }).safeParse({
    publicName: fd.get("publicName"), phone: fd.get("phone") ?? "", locality: fd.get("locality") ?? "",
    address: fd.get("address") ?? "", pincode: fd.get("pincode") ?? "",
    bays: fd.get("bays") ?? 1, gstin: fd.get("gstin") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };
  const p = parsed.data;

  const sb = await supabaseServer();
  const { data: garageId, error } = await sb.rpc("register_garage", {
    p_public_name: p.publicName,
    p_phone: p.phone || null,
    p_locality: p.locality || null,
    p_address: p.address || null,
    p_pincode: p.pincode || null,
    p_bays: p.bays,
    p_gstin: p.gstin || null,
  });

  if (error) {
    const m = error.message.replace(/^.*?:\s*/, "");
    return { error: m.includes("already belongs") ? "This account already runs a garage." : m };
  }

  // Sensible opening hours so the garage is bookable the moment it is approved.
  await sb.from("garage_hours").insert(
    DEFAULT_HOURS.map((h) => ({
      garage_id: garageId, branch_id: null, day: h.day,
      opens: h.opens, closes: h.closes, closed: !!h.closed,
    })),
  );

  void user;
  revalidatePath("/garage");
  redirect("/garage/pricing?welcome=1");
}
