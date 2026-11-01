import { ClipboardCheck } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Badge, Callout, Card, Empty, Field, Input, PageTitle, RadioCards, SegmentedLinks, Select, Stat, Textarea } from "@/components/ui";
import { publishInspectionReport, scheduleInspection } from "@/server/trust-admin";
import { GRADE } from "@/lib/trust";
import { formatINR } from "@/lib/money";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Used-car inspections" };

export default async function AdminInspections({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole("super_admin", "quality_auditor", "support_agent");
  const { status } = await searchParams;
  const sb = await supabaseServer();

  const [oRes, gRes] = await Promise.all([
    sb.from("inspection_orders")
      .select(`id, vehicle_description, registration, seller_contact, inspect_at, scheduled_for, status,
               price_paise, created_at, inspection_packages(name, checkpoints),
               profiles(full_name), garages(public_name),
               inspection_reports(overall_grade, headline, published_at)`)
      .order("created_at", { ascending: false }).limit(120),
    sb.from("garages").select("id, public_name").eq("status", "active").order("name").limit(200),
  ]);

  const all = (oRes.data ?? []) as unknown as {
    id: string; vehicle_description: string; registration: string | null; seller_contact: string | null;
    inspect_at: string | null; scheduled_for: string | null; status: string;
    price_paise: number; created_at: string;
    inspection_packages: { name: string; checkpoints: number } | null;
    profiles: { full_name: string | null } | null;
    garages: { public_name: string } | null;
    inspection_reports: { overall_grade: string | null; headline: string | null; published_at: string | null } | null;
  }[];
  const garages = gRes.data ?? [];

  const toSchedule = all.filter((o) => o.status === "requested");
  const toInspect = all.filter((o) => o.status === "scheduled" || o.status === "in_progress");
  const done = all.filter((o) => o.status === "reported");

  const tab = status === "inspect" ? "inspect" : status === "done" ? "done" : "schedule";
  const shown = tab === "inspect" ? toInspect : tab === "done" ? done : toSchedule;

  return (
    <>
      <PageTitle
        title="Used-car inspections"
        sub="Orders from buyers who want a vehicle checked before they pay for it. Schedule the visit, then publish the graded report."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="To schedule" value={String(toSchedule.length)} tone={toSchedule.length > 0 ? "warn" : undefined} />
        <Stat label="Booked in" value={String(toInspect.length)} />
        <Stat label="Reported" value={String(done.length)} tone="success" />
      </div>

      <SegmentedLinks
        current={`/admin/inspections${tab === "schedule" ? "" : `?status=${tab}`}`}
        items={[
          { href: "/admin/inspections", label: "To schedule", count: toSchedule.length },
          { href: "/admin/inspections?status=inspect", label: "Booked in", count: toInspect.length },
          { href: "/admin/inspections?status=done", label: "Reported", count: done.length },
        ]}
      />

      <div className="mt-6 space-y-4">
        {shown.length === 0 ? (
          <Empty title="Nothing here" body="Orders arrive from the customer app." icon={<ClipboardCheck className="h-5 w-5" aria-hidden />} />
        ) : (
          shown.map((o, i) => {
            const grade = o.inspection_reports?.overall_grade ? GRADE[o.inspection_reports.overall_grade] : null;
            return (
              <Card key={o.id} className="rise overflow-hidden" style={{ "--i": i } as React.CSSProperties}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-semibold">{o.vehicle_description}</p>
                    <p className="tnum mt-0.5 text-[12px] text-ink2">
                      {o.inspection_packages?.name}
                      {o.registration && ` · ${o.registration}`}
                      {` · for ${o.profiles?.full_name ?? "a customer"}`}
                      {` · ordered ${fmtDate(o.created_at)}`}
                    </p>
                    {o.inspect_at && <p className="mt-1 text-[12.5px] text-ink2">Where: {o.inspect_at}</p>}
                    {o.seller_contact && <p className="tnum mt-0.5 text-[12.5px] text-ink2">Seller: {o.seller_contact}</p>}
                    {o.scheduled_for && (
                      <p className="mt-1 text-[12.5px] font-semibold text-brand">Visiting {fmtDateTime(o.scheduled_for)}</p>
                    )}
                  </div>
                  <div className="text-right">
                    {grade ? <Badge tone={grade.tone}>{grade.label}</Badge> : <Badge tone="neutral">{o.status}</Badge>}
                    <p className="tnum mt-1.5 text-[13px] font-semibold">{formatINR(Number(o.price_paise))}</p>
                  </div>
                </div>

                <div className="p-5">
                  {o.status === "requested" && (
                    <ActionForm action={scheduleInspection} submitLabel="Schedule it" pendingLabel="Saving…" size="sm">
                      <input type="hidden" name="id" value={o.id} />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="When" required hint="After you have agreed a time with the seller.">
                          <Input name="scheduledFor" type="datetime-local" required />
                        </Field>
                        <Field label="Which workshop inspects it?" hint="Optional — leave blank for an in-house inspector.">
                          <Select name="garageId" defaultValue="">
                            <option value="">MEQIVA inspector</option>
                            {garages.map((g) => <option key={g.id} value={g.id}>{g.public_name}</option>)}
                          </Select>
                        </Field>
                      </div>
                    </ActionForm>
                  )}

                  {(o.status === "scheduled" || o.status === "in_progress") && (
                    <ActionForm action={publishInspectionReport} submitLabel="Publish the report" pendingLabel="Publishing…" size="sm">
                      <input type="hidden" name="orderId" value={o.id} />
                      <Field label="Inspector" required>
                        <Input name="inspectorName" required minLength={2} maxLength={80} placeholder="Full name" />
                      </Field>
                      <Field label="Overall grade" required>
                        <RadioCards
                          name="overallGrade" columns={2}
                          options={Object.entries(GRADE).map(([k, g]) => ({ value: k, label: g.label, hint: g.meaning }))}
                        />
                      </Field>
                      <Field label="The one line that matters" required>
                        <Input name="headline" required minLength={10} maxLength={200}
                          placeholder="Sound body and engine, but it needs both front tyres and a clutch inside a year." />
                      </Field>
                      <Field label="What you would tell the buyer" required
                        hint="Plain language. Say whether to buy, and at what price, and what to get in writing from the seller.">
                        <Textarea name="recommendation" rows={5} required minLength={20} maxLength={4000} />
                      </Field>
                      <Field label="Budget for the findings" hint="Rupees. Optional.">
                        <Input name="estimatedSpend" type="number" inputMode="decimal" min={0} step="1"
                          placeholder="24000" className="tnum" />
                      </Field>
                    </ActionForm>
                  )}

                  {o.status === "reported" && o.inspection_reports && (
                    <div>
                      <p className="text-[14px] font-semibold leading-snug">{o.inspection_reports.headline}</p>
                      <p className="mt-1 text-[11.5px] text-ink2">
                        Published {fmtDate(o.inspection_reports.published_at)}
                        {o.garages && ` · inspected by ${o.garages.public_name}`}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <div className="mt-8">
        <Callout tone="warn" title="The inspector is not the seller's friend, and not the buyer's either">
          Grade on what was found, not on whether the buyer seemed keen. A Grade C that reads like a Grade A costs
          someone a clutch; a Grade C that reads like a Grade D costs an honest seller a sale. Write the findings and
          let the grade follow from them.
        </Callout>
      </div>
    </>
  );
}
