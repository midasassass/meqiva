import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge, ButtonLink, Callout, Card, DataList, Empty, Field, PageTitle, Panel, Section, Select, Textarea, Timeline } from "@/components/ui";
import { ActionButton, ActionForm } from "@/components/action-form";
import { EstimateSheet } from "@/components/estimate";
import { ApprovalCard, type PublicationLine } from "./approval-card";
import { ReviewForm } from "./review-form";
import { cancelBooking } from "@/server/booking";
import { raiseTicket } from "@/server/customer";
import { formatINR } from "@/lib/money";
import { fmtDate, fmtDateTime, sentence } from "@/lib/format";
import { canTransition, type BookingStatus } from "@/lib/booking";
import { requireUser } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Booking" };

const STAGES: { key: BookingStatus; label: string }[] = [
  { key: "awaiting_garage_confirmation", label: "Sent to the garage" },
  { key: "confirmed", label: "Confirmed" },
  { key: "vehicle_arrived", label: "Vehicle received" },
  { key: "inspection_in_progress", label: "Inspection" },
  { key: "service_in_progress", label: "Work underway" },
  { key: "quality_check", label: "Quality check" },
  { key: "ready_for_delivery", label: "Ready for collection" },
  { key: "completed", label: "Completed" },
];

const TICKET_CATEGORIES = [
  "Price discrepancy", "Poor workmanship", "Incorrect part", "Delay", "Payment issue",
  "Refund request", "Vehicle damage", "Missing service record", "Warranty issue", "Other",
];

export default async function BookingDetail({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  await requireUser();
  const sb = await supabaseServer();

  const { data: b } = await sb.from("bookings")
    .select(`id, status, origin, slot_start, slot_end, quoted_total_paise, customer_note, pickup_requested, created_at,
             garages(id, slug, public_name, phone, locality),
             vehicles(id, year, reg_no, vehicle_models(name, vehicle_makes(name))),
             garage_services(name, est_minutes, warranty_days)`)
    .eq("id", id).maybeSingle();
  if (!b) notFound();

  const booking = b as unknown as {
    id: string; status: BookingStatus; origin: string; slot_start: string | null; slot_end: string | null;
    quoted_total_paise: number | null; customer_note: string | null; pickup_requested: boolean; created_at: string;
    garages: { id: string; slug: string; public_name: string; phone: string | null; locality: string | null };
    vehicles: { id: string; year: number | null; reg_no: string | null; vehicle_models: { name: string; vehicle_makes: { name: string } } } | null;
    garage_services: { name: string; est_minutes: number; warranty_days: number } | null;
  };

  const [eventsRes, pubsRes, approvalsRes, evidenceRes, invoiceRes, reviewRes] = await Promise.all([
    sb.from("booking_events").select("id, from_status, to_status, message, category, created_at").eq("booking_id", id).order("created_at"),
    sb.from("quote_publications").select("id, version, extra_work, reason, lines, subtotal_paise, tax_paise, total_paise, warranty_note, expires_at, published_at").eq("booking_id", id).order("version"),
    sb.from("customer_approvals").select("publication_id, decision, amount_paise, decided_at, reason").eq("garage_id", booking.garages.id),
    sb.from("service_evidence").select("id, caption, stage, created_at").eq("booking_id", id).eq("visible_to_customer", true).order("created_at"),
    sb.from("invoices").select("id, number, lines, subtotal_paise, tax_paise, total_paise, paid_paise, cgst_paise, sgst_paise, igst_paise, issued_at").eq("booking_id", id).is("voided_at", null).maybeSingle(),
    sb.from("reviews").select("id, rating, remarks").eq("booking_id", id).maybeSingle(),
  ]);

  const events = eventsRes.data ?? [];
  const pubs = (pubsRes.data ?? []) as unknown as {
    id: string; version: number; extra_work: boolean; reason: string | null; lines: PublicationLine[];
    subtotal_paise: number; tax_paise: number; total_paise: number; warranty_note: string | null;
    expires_at: string | null; published_at: string;
  }[];
  const decisions = new Map((approvalsRes.data ?? []).map((a) => [a.publication_id, a]));
  const pendingApproval = pubs.find((p) => p.extra_work && !decisions.has(p.id));
  const invoice = invoiceRes.data;

  const reached = new Set(events.map((e) => e.to_status));
  const stageEntries = STAGES.map((s) => {
    const ev = events.find((e) => e.to_status === s.key);
    return {
      title: s.label,
      at: ev ? fmtDateTime(ev.created_at) : undefined,
      detail: ev?.message ?? undefined,
      done: reached.has(s.key),
      tone: (s.key === booking.status ? "accent" : undefined) as "accent" | undefined,
      now: s.key === booking.status,
    };
  });

  const vehicleName = booking.vehicles
    ? `${booking.vehicles.vehicle_models.vehicle_makes.name} ${booking.vehicles.vehicle_models.name}`
    : "Vehicle";
  const canCancel = canTransition(booking.status, "cancelled", "customer");

  return (
    <>
      <PageTitle
        title={booking.garages.public_name}
        sub={`${vehicleName}${booking.garage_services ? ` · ${booking.garage_services.name}` : ""}`}
        back={{ href: "/app/bookings", label: "All bookings" }}
        right={<Badge tone={booking.status === "completed" ? "success" : booking.status === "awaiting_customer_approval" ? "warn" : "brand"}>
          {sentence(booking.status)}
        </Badge>}
      />

      {sp.new && (
        <Callout tone="success" title="Request sent">
          {booking.garages.public_name} has been notified. You will see the confirmation here, and nothing is charged
          until they accept.
        </Callout>
      )}

      {pendingApproval && (
        <div className="mt-5"><ApprovalCard bookingId={id} publication={pendingApproval} /></div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="space-y-6">
          <Panel title="Progress">
            <div className="p-5"><Timeline entries={stageEntries} /></div>
          </Panel>

          {pubs.length > 0 && (
            <Section title="Quotations">
              <div className="grid gap-4">
                {pubs.map((p) => {
                  const d = decisions.get(p.id);
                  return (
                    <div key={p.id}>
                      <EstimateSheet
                        heading={p.extra_work ? `Additional work — version ${p.version}` : `Quotation — version ${p.version}`}
                        subheading={`Issued ${fmtDateTime(p.published_at)}`}
                        dense
                        lines={p.lines.map((l) => ({
                          description: l.description, qty: l.qty,
                          amountPaise: Number(l.line_total_paise), mrpPaise: l.mrp_paise ?? null,
                        }))}
                        subtotalPaise={Number(p.subtotal_paise)}
                        taxPaise={Number(p.tax_paise)}
                        totalPaise={Number(p.total_paise)}
                        footnote={p.warranty_note ?? undefined}
                        aside={d && (
                          <p className="mt-1 text-[12px]">
                            <Badge tone={d.decision === "approved" ? "success" : "neutral"}>
                              {d.decision === "approved" ? "You approved this" : "You declined this"} on {fmtDate(d.decided_at)}
                            </Badge>
                          </p>
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {invoice && (
            <Section title="Invoice">
              <EstimateSheet
                heading={`Invoice ${invoice.number}`}
                subheading={`Issued ${fmtDate(invoice.issued_at)}`}
                lines={(invoice.lines as PublicationLine[]).map((l) => ({
                  description: l.description, qty: l.qty, amountPaise: Number(l.line_total_paise), mrpPaise: l.mrp_paise ?? null,
                }))}
                subtotalPaise={Number(invoice.subtotal_paise)}
                taxPaise={Number(invoice.tax_paise)}
                totalPaise={Number(invoice.total_paise)}
                footnote={
                  <>
                    {Number(invoice.igst_paise) > 0
                      ? `IGST ${formatINR(Number(invoice.igst_paise))}`
                      : `CGST ${formatINR(Number(invoice.cgst_paise))} · SGST ${formatINR(Number(invoice.sgst_paise))}`}
                    {Number(invoice.paid_paise) >= Number(invoice.total_paise)
                      ? " · Paid in full"
                      : ` · ${formatINR(Number(invoice.total_paise) - Number(invoice.paid_paise))} outstanding`}
                  </>
                }
              />
            </Section>
          )}

          {(evidenceRes.data ?? []).length > 0 && (
            <Panel title="Photographs from the workshop">
              <ul className="divide-y divide-line">
                {(evidenceRes.data ?? []).map((e) => (
                  <li key={e.id} className="px-4 py-3 text-[13px]">
                    <p className="font-medium">{e.caption ?? e.stage ?? "Photograph"}</p>
                    <p className="tnum mt-0.5 text-xs text-ink2">{fmtDateTime(e.created_at)}</p>
                  </li>
                ))}
              </ul>
              <p className="border-t border-line px-4 py-2.5 text-xs text-ink2">
                Images are held in private storage and opened through short-lived links.
              </p>
            </Panel>
          )}

          {booking.status === "completed" && !reviewRes.data && (
            <Panel title="How did it go?" description="Only customers whose booking completed can review, so this carries weight.">
              <div className="p-4"><ReviewForm bookingId={id} garageId={booking.garages.id} /></div>
            </Panel>
          )}

          {reviewRes.data && (
            <Panel title="Your review">
              <div className="p-4">
                <p className="tnum text-sm font-semibold">{reviewRes.data.rating}/5</p>
                {reviewRes.data.remarks && <p className="mt-1.5 text-[13.5px] text-ink2">{reviewRes.data.remarks}</p>}
              </div>
            </Panel>
          )}
        </div>

        <aside className="space-y-5">
          <Panel title="Details">
            <div className="p-4">
              <DataList cols={1} rows={[
                ["Garage", <Link key="g" href={`/garages/${booking.garages.slug}`} className="underline">{booking.garages.public_name}</Link>],
                ["Where", booking.garages.locality ?? "Gurugram"],
                ["Phone", booking.garages.phone ?? "—"],
                ["Vehicle", `${vehicleName}${booking.vehicles?.reg_no ? ` · ${booking.vehicles.reg_no}` : ""}`],
                ["Slot", fmtDateTime(booking.slot_start)],
                ["Estimate at booking", booking.quoted_total_paise != null ? formatINR(Number(booking.quoted_total_paise)) : "—"],
                ...(booking.garage_services?.warranty_days ? [["Warranty", `${booking.garage_services.warranty_days} days`] as [string, string]] : []),
                ...(booking.pickup_requested ? [["Pickup", "Requested"] as [string, string]] : []),
              ]} />
              {booking.customer_note && (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="text-xs text-ink2">What you told them</p>
                  <p className="mt-1 text-[13px]">{booking.customer_note}</p>
                </div>
              )}
            </div>
          </Panel>

          {canCancel && (
            <Card>
              <p className="text-[13px] font-medium">Need to cancel?</p>
              <p className="mt-1 text-xs text-ink2">
                Free within the garage&rsquo;s cancellation window. If parts have already been ordered for your vehicle, a
                charge may apply and the garage will tell you first.
              </p>
              <div className="mt-3">
                <ActionButton action={cancelBooking} label="Cancel this booking" variant="outline"
                  hidden={{ bookingId: id, reason: "Cancelled by customer" }}
                  confirm="Cancel this booking? The garage will be notified." />
              </div>
            </Card>
          )}

          <Panel title="Something wrong?" description="Raise it here and the garage is notified. MEQIVA can step in if it is not resolved.">
            <div className="p-4">
              <ActionForm action={raiseTicket} submitLabel="Open a ticket" variant="outline" resetOnSuccess fullWidth>
                <input type="hidden" name="bookingId" value={id} />
                <input type="hidden" name="garageId" value={booking.garages.id} />
                <Field label="What is the problem?" required>
                  <Select name="category" required defaultValue="">
                    <option value="" disabled>Choose one</option>
                    {TICKET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </Field>
                <Field label="What happened?" required>
                  <Textarea name="description" rows={3} required minLength={10} maxLength={4000} />
                </Field>
              </ActionForm>
            </div>
          </Panel>

          <p className="text-xs text-ink2">
            {booking.origin === "marketplace" ? "Booked through MEQIVA." : "Added by the garage."}{" "}
            Work is carried out by {booking.garages.public_name}, which issues the invoice and owns the warranty.
          </p>
        </aside>
      </div>

      {events.length === 0 && <div className="mt-6"><Empty title="No updates yet" body="The garage will update this as the work moves." /></div>}
    </>
  );
}
