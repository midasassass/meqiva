"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireGarageOrRedirect } from "@/lib/session";
import { getFieldDefs } from "@/lib/garage-data";
import { parseCustom } from "@/lib/fields";
import { computeQuote, type QuoteLine } from "@/lib/quote";
import { applyMovement } from "@/lib/inventory";
import type { ActionState } from "./booking";

const clean = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => String(v).trim() !== ""));
const onOff = (fd: FormData, n: string) => fd.get(n) === "on" || fd.get(n) === "true";
const rupees = (v: unknown) => Math.round(Number(v ?? 0) * 100);

async function ctx() {
  const c = await requireGarageOrRedirect();
  if (!c.garage.isManager) throw new Error("Not permitted");
  return c;
}

/* ─────────────── Job cards ─────────────── */

export async function createJobCard(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage, user } = await ctx();
  const parsed = z.object({
    bookingId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    vehicleId: z.string().uuid().optional(),
    walkInName: z.string().max(120).optional(),
    walkInPhone: z.string().max(20).optional(),
    complaints: z.string().min(3, "Note what the customer reported").max(2000),
    odometerKm: z.coerce.number().int().min(0).max(2_000_000).optional(),
    technicianId: z.string().uuid().optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the job details." };
  const p = parsed.data;

  const defs = await getFieldDefs(sb, garage.id, "job_card");
  const custom = parseCustom(fd, defs);
  if (!custom.ok) return { error: Object.values(custom.errors)[0] ?? "Check the custom fields." };

  // Origin decides commission, so it is derived from the booking rather than submitted.
  let origin: "marketplace" | "walk_in" | "fleet" = "walk_in";
  if (p.bookingId) {
    const { data: bk } = await sb.from("bookings").select("origin, customer_id, vehicle_id")
      .eq("id", p.bookingId).eq("garage_id", garage.id).maybeSingle();
    if (!bk) return { error: "That booking is not yours." };
    origin = bk.origin;
  }

  const { data, error } = await sb.from("job_cards").insert({
    garage_id: garage.id, booking_id: p.bookingId ?? null, customer_id: p.customerId ?? null,
    vehicle_id: p.vehicleId ?? null, origin, complaints: p.complaints,
    odometer_km: p.odometerKm ?? null, technician_id: p.technicianId ?? null,
    checked_in_at: new Date().toISOString(), custom: custom.values,
    advisor_notes: p.walkInName ? `Walk-in: ${p.walkInName}${p.walkInPhone ? ` (${p.walkInPhone})` : ""}` : null,
  }).select("id").single();
  if (error) return { error: "Could not create the job card." };

  void user;
  revalidatePath("/garage/jobs");
  redirect(`/garage/jobs/${data.id}`);
}

export async function assignTechnician(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await ctx();
  const jobId = String(fd.get("jobId"));
  const techId = String(fd.get("technicianId") || "");

  if (techId) {
    const { data: member } = await sb.from("garage_members")
      .select("user_id").eq("garage_id", garage.id).eq("user_id", techId).maybeSingle();
    if (!member) return { error: "That person does not work at this garage." };
  }

  const { error } = await sb.from("job_cards")
    .update({ technician_id: techId || null }).eq("id", jobId).eq("garage_id", garage.id);
  if (error) return { error: "Could not assign the job." };

  revalidatePath(`/garage/jobs/${jobId}`);
  revalidatePath("/garage/workshop");
  return { ok: true, message: techId ? "Assigned." : "Unassigned." };
}

export async function updateJobProgress(_: ActionState, fd: FormData): Promise<ActionState> {
  const c = await requireGarageOrRedirect();
  const jobId = String(fd.get("jobId"));
  const what = String(fd.get("what"));

  const { data: job } = await c.sb.from("job_cards")
    .select("id, technician_id, garage_id, started_at").eq("id", jobId).maybeSingle();
  if (!job) return { error: "Job card not found." };
  const mine = job.technician_id === c.user.id;
  if (!mine && !c.garage.isManager) return { error: "This job is not assigned to you." };

  const patch =
    what === "start" ? { started_at: new Date().toISOString() }
    : what === "complete" ? { completed_at: new Date().toISOString() }
    : what === "reopen" ? { completed_at: null, qc_passed: null }
    : null;
  if (!patch) return { error: "Unknown action." };

  const { error } = await c.sb.from("job_cards").update(patch).eq("id", jobId);
  if (error) return { error: "Could not update the job." };

  revalidatePath("/tech");
  revalidatePath(`/garage/jobs/${jobId}`);
  revalidatePath("/garage/workshop");
  return { ok: true, message: what === "start" ? "Started." : what === "complete" ? "Marked complete." : "Reopened." };
}

export async function recordDiagnostics(_: ActionState, fd: FormData): Promise<ActionState> {
  const c = await requireGarageOrRedirect();
  const jobId = String(fd.get("jobId"));
  const text = String(fd.get("diagnostics") ?? "").slice(0, 4000);

  const { data: job } = await c.sb.from("job_cards").select("technician_id").eq("id", jobId).maybeSingle();
  if (!job) return { error: "Job card not found." };
  if (job.technician_id !== c.user.id && !c.garage.isManager) return { error: "This job is not assigned to you." };

  await c.sb.from("job_cards").update({ diagnostics: text }).eq("id", jobId);
  revalidatePath(`/garage/jobs/${jobId}`);
  revalidatePath("/tech");
  return { ok: true, message: "Findings saved. A manager turns these into a quotation." };
}

/* ─────────────── Quotations ─────────────── */

const lineSchema = z.object({
  kind: z.enum(["part", "labour", "consumable", "other", "inspection"]),
  description: z.string().min(1).max(200),
  qty: z.coerce.number().min(0.01).max(1000),
  unitPrice: z.coerce.number().min(0).max(10_000_000),
  unitCost: z.coerce.number().min(0).max(10_000_000),
  gstPct: z.coerce.number().min(0).max(28),
  mrpApplies: z.boolean().optional(),
  mrp: z.coerce.number().min(0).max(10_000_000).optional(),
  packQty: z.coerce.number().int().min(1).max(1000).optional(),
  partId: z.string().uuid().optional(),
});

/**
 * Totals are always recomputed here from the submitted lines. Whatever the browser
 * calculated is ignored, so a tampered form cannot produce a quotation that breaks
 * the MRP rule or misstates margin.
 */
export async function saveQuote(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage, user } = await ctx();
  const parsed = z.object({
    id: z.string().uuid().optional(),
    jobCardId: z.string().uuid(),
    extraWork: z.boolean().optional(),
    reason: z.string().max(1000).optional(),
    warrantyNote: z.string().max(500).optional(),
    publish: z.boolean().optional(),
    lines: z.array(lineSchema).min(1, "Add at least one line"),
  }).safeParse({
    ...clean(fd),
    extraWork: onOff(fd, "extraWork"),
    publish: onOff(fd, "publish"),
    lines: JSON.parse(String(fd.get("lines") ?? "[]")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the quotation." };
  const p = parsed.data;

  const { data: job } = await sb.from("job_cards")
    .select("id, garage_id").eq("id", p.jobCardId).eq("garage_id", garage.id).maybeSingle();
  if (!job) return { error: "That job card is not yours." };

  const engineLines: QuoteLine[] = p.lines.map((l, i) => ({
    id: `l${i}`, kind: l.kind, description: l.description, qty: l.qty,
    unitPricePaise: rupees(l.unitPrice), unitCostPaise: rupees(l.unitCost),
    gstRateBps: Math.round(l.gstPct * 100),
    mrpApplies: !!l.mrpApplies, mrpPaise: l.mrp != null ? rupees(l.mrp) : null,
    packQty: l.packQty ?? null,
  }));
  const result = computeQuote(engineLines, { requiredKinds: p.extraWork ? [] : ["labour"] });

  if (!result.canIssue) {
    const blocking = result.warnings.find((w) => w.blocking);
    // Record the attempt so the compliance queue sees repeated over-MRP pricing.
    if (blocking?.code === "MRP_EXCEEDED") {
      const bad = p.lines.find((_, i) => result.mrpIssues[`l${i}`]?.some((x) => x.code === "MRP_EXCEEDED"));
      await sb.from("pricing_violations").insert({
        garage_id: garage.id, actor_id: user.id, part_id: bad?.partId ?? null, context: "quote",
        description: bad?.description ?? null,
        attempted_paise: bad ? rupees(bad.unitPrice) : null,
        mrp_paise: bad?.mrp != null ? rupees(bad.mrp) : null,
      });
    }
    return { error: blocking?.message ?? "This quotation cannot be issued yet." };
  }

  const stored = engineLines.map((l, i) => {
    const gross = l.unitPricePaise * l.qty;
    const sub = l.mrpApplies ? Math.round((gross * 10000) / (10000 + l.gstRateBps)) : gross;
    return {
      kind: l.kind, description: l.description, qty: l.qty,
      unit_price_paise: l.unitPricePaise, unit_cost_paise: l.unitCostPaise,
      gst_bps: l.gstRateBps, mrp_applies: !!l.mrpApplies, mrp_paise: l.mrpPaise,
      line_subtotal_paise: sub, line_total_paise: l.mrpApplies ? gross : sub + Math.round((sub * l.gstRateBps) / 10000),
      part_id: p.lines[i]?.partId ?? null,
    };
  });

  const row = {
    garage_id: garage.id, job_card_id: p.jobCardId, lines: stored,
    customer_total_paise: result.totals.customerTotal,
    subtotal_paise: result.totals.subtotalExTax,
    tax_paise: result.totals.tax,
    contribution_paise: result.totals.contributionPaise,
    extra_work: !!p.extraWork,
    warranty_note: p.warrantyNote ?? null,
    created_by: user.id,
    status: "draft" as const,
  };

  const { data: quote, error } = p.id
    ? await sb.from("quotes").update(row).eq("id", p.id).eq("garage_id", garage.id).select("id").single()
    : await sb.from("quotes").insert(row).select("id").single();
  if (error || !quote) return { error: "Could not save the quotation." };

  if (p.publish) {
    const { error: pubErr } = await sb.rpc("publish_quote", {
      p_quote: quote.id, p_reason: p.reason ?? null, p_valid_hours: 72,
    });
    if (pubErr) return { error: pubErr.message.replace(/^.*?:\s*/, "") };
  }

  revalidatePath(`/garage/jobs/${p.jobCardId}`);
  revalidatePath("/garage/quotes");
  return {
    ok: true,
    message: p.publish ? "Sent to the customer. They decide before anything else is done." : "Saved as a draft.",
  };
}

export async function issueInvoice(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await ctx();
  const jobId = String(fd.get("jobCardId"));

  const { data: approved } = await sb.from("quotes")
    .select("id, lines, subtotal_paise, tax_paise, customer_total_paise")
    .eq("job_card_id", jobId).eq("garage_id", garage.id).eq("status", "approved");

  if (!approved?.length) return { error: "Nothing approved yet. Send the quotation and wait for the customer." };

  const lines = approved.flatMap((q) => q.lines as unknown[]);
  const subtotal = approved.reduce((a, q) => a + Number(q.subtotal_paise), 0);
  const tax = approved.reduce((a, q) => a + Number(q.tax_paise), 0);
  const total = approved.reduce((a, q) => a + Number(q.customer_total_paise), 0);

  const { data, error } = await sb.rpc("issue_invoice", {
    p_job: jobId, p_lines: lines, p_subtotal: subtotal, p_tax: tax, p_total: total,
  });
  if (error) return { error: error.message.replace(/^.*?:\s*/, "") };

  revalidatePath(`/garage/jobs/${jobId}`);
  revalidatePath("/garage/invoices");
  return { ok: true, message: `Invoice issued. Reference ${String(data).slice(0, 8)}.` };
}

/* ─────────────── Parts and stock ─────────────── */

export async function savePart(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await ctx();
  const parsed = z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(1, "Name the part").max(160),
    brand: z.string().max(80).optional(),
    partNo: z.string().max(80).optional(),
    mrp: z.coerce.number().min(0).max(10_000_000).optional(),
    packQty: z.coerce.number().int().min(1).max(1000).optional(),
    purchase: z.coerce.number().min(0).max(10_000_000),
    sell: z.coerce.number().min(0).max(10_000_000),
    gstPct: z.coerce.number().min(0).max(28),
    stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
    reorderAt: z.coerce.number().int().min(0).max(10000),
    category: z.enum(["genuine", "oem", "aftermarket", "unknown"]).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the part." };
  const p = parsed.data;

  const mrpApplies = onOff(fd, "mrpApplies");
  if (mrpApplies && p.mrp == null) return { error: "Enter the printed MRP for a packaged part." };
  if (mrpApplies && p.mrp != null && rupees(p.sell) > rupees(p.mrp)) {
    return { error: "Selling price cannot be above the printed MRP. MRP already includes tax." };
  }

  const row = {
    garage_id: garage.id, name: p.name, brand: p.brand ?? null, part_no: p.partNo ?? null,
    mrp_applies: mrpApplies, mrp_paise: mrpApplies && p.mrp != null ? rupees(p.mrp) : null,
    pack_qty: p.packQty ?? null, purchase_paise: rupees(p.purchase), sell_paise: rupees(p.sell),
    gst_rate_bps: Math.round(p.gstPct * 100), reorder_at: p.reorderAt,
    category: p.category ?? "unknown",
    ...(p.id ? {} : { stock: p.stock ?? 0 }),
  };

  const { error } = p.id
    ? await sb.from("parts").update(row).eq("id", p.id).eq("garage_id", garage.id)
    : await sb.from("parts").insert(row);
  if (error) {
    return { error: error.message.includes("mrp_ceiling")
      ? "Selling price cannot be above the printed MRP."
      : "Could not save the part." };
  }

  revalidatePath("/garage/parts");
  return { ok: true, message: p.id ? "Part updated." : "Part added." };
}

export async function adjustStock(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await ctx();
  const parsed = z.object({
    partId: z.string().uuid(),
    kind: z.enum(["inward", "outward", "adjustment"]),
    qty: z.coerce.number().int().refine((v) => v !== 0, "Enter a quantity"),
    note: z.string().max(200).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the quantity." };

  const { data: part } = await sb.from("parts")
    .select("stock").eq("id", parsed.data.partId).eq("garage_id", garage.id).maybeSingle();
  if (!part) return { error: "Part not found." };

  try {
    applyMovement(part.stock, { kind: parsed.data.kind, qty: parsed.data.qty });
  } catch {
    return { error: `Only ${part.stock} in stock. Record an inward entry first.` };
  }

  const { error } = await sb.rpc("apply_stock_movement", {
    p_part: parsed.data.partId, p_kind: parsed.data.kind, p_qty: parsed.data.qty,
    p_job: null, p_note: parsed.data.note ?? null,
  });
  if (error) return { error: error.message.replace(/^.*?:\s*/, "") };

  revalidatePath("/garage/parts");
  return { ok: true, message: "Stock updated." };
}

/* ─────────────── CRM ─────────────── */

export async function saveFollowUp(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage, user } = await ctx();
  const parsed = z.object({
    customerId: z.string().uuid().optional(),
    vehicleId: z.string().uuid().optional(),
    quoteId: z.string().uuid().optional(),
    kind: z.enum(["quote_recovery", "service_due", "complaint", "callback", "other"]),
    dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().max(1000).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details." };

  const { error } = await sb.from("follow_ups").insert({
    garage_id: garage.id, customer_id: parsed.data.customerId ?? null,
    vehicle_id: parsed.data.vehicleId ?? null, quote_id: parsed.data.quoteId ?? null,
    kind: parsed.data.kind, due_on: parsed.data.dueOn, note: parsed.data.note ?? null,
    assigned_to: user.id,
  });
  if (error) return { error: "Could not create the follow-up." };

  revalidatePath("/garage/crm");
  return { ok: true, message: "Follow-up added to your list." };
}

export async function closeFollowUp(_: ActionState, fd: FormData): Promise<ActionState> {
  const { sb, garage } = await ctx();
  const parsed = z.object({
    id: z.string().uuid(),
    outcome: z.enum(["won", "lost", "no_response", "rescheduled"]),
    lostReason: z.string().max(200).optional(),
  }).safeParse(clean(fd));
  if (!parsed.success) return { error: "Choose an outcome." };

  const { error } = await sb.from("follow_ups").update({
    outcome: parsed.data.outcome,
    lost_reason: parsed.data.lostReason ?? null,
    closed_at: new Date().toISOString(),
  }).eq("id", parsed.data.id).eq("garage_id", garage.id);
  if (error) return { error: "Could not close the follow-up." };

  revalidatePath("/garage/crm");
  return { ok: true, message: "Closed. The outcome feeds your conversion figures." };
}
