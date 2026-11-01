import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge, ButtonLink, Callout, DataList, Empty, Field, PageTitle, Panel, Section, Select, Textarea } from "@/components/ui";
import { ActionButton, ActionForm } from "@/components/action-form";
import { EstimateSheet } from "@/components/estimate";
import { assignTechnician, issueInvoice, recordDiagnostics, updateJobProgress } from "@/server/garage-ops";
import { formatINR } from "@/lib/money";
import { fmtDateTime, fmtKm } from "@/lib/format";
import { displayValue, type FieldDef } from "@/lib/fields";
import { getFieldDefs } from "@/lib/garage-data";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Job card" };

export default async function JobCard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { sb, garage } = await requireGarageOrRedirect();

  const { data: j } = await sb.from("job_cards")
    .select(`id, origin, complaints, advisor_notes, diagnostics, odometer_km, checked_in_at, started_at, completed_at,
             qc_passed, custom, technician_id, booking_id,
             profiles!job_cards_technician_id_fkey(full_name),
             vehicles(id, reg_no, year, vehicle_models(name, vehicle_makes(name))),
             bookings(id, status)`)
    .eq("id", id).eq("garage_id", garage.id).maybeSingle();
  if (!j) notFound();

  const job = j as unknown as {
    id: string; origin: string; complaints: string | null; advisor_notes: string | null; diagnostics: string | null;
    odometer_km: number | null; checked_in_at: string | null; started_at: string | null; completed_at: string | null;
    qc_passed: boolean | null; custom: Record<string, unknown>; technician_id: string | null; booking_id: string | null;
    profiles: { full_name: string | null } | null;
    vehicles: { id: string; reg_no: string | null; year: number | null; vehicle_models: { name: string; vehicle_makes: { name: string } } } | null;
    bookings: { id: string; status: string } | null;
  };

  const [defs, techsRes, quotesRes, invoiceRes, runsRes] = await Promise.all([
    getFieldDefs(sb, garage.id, "job_card"),
    sb.from("garage_members").select("user_id, profiles(full_name)").eq("garage_id", garage.id),
    sb.from("quotes").select("id, version, status, extra_work, lines, subtotal_paise, tax_paise, customer_total_paise, contribution_paise, created_at")
      .eq("job_card_id", id).order("created_at"),
    sb.from("invoices").select("id, number, total_paise, paid_paise, issued_at").eq("job_card_id", id).is("voided_at", null).maybeSingle(),
    sb.from("checklist_runs").select("id, name, completed_at, checklist_results(id, label, status, note)").eq("job_card_id", id),
  ]);

  const techs = (techsRes.data ?? []) as unknown as { user_id: string; profiles: { full_name: string | null } | null }[];
  const quotes = (quotesRes.data ?? []) as unknown as {
    id: string; version: number; status: string; extra_work: boolean;
    lines: { description: string; qty: number; line_total_paise: number; mrp_paise: number | null }[];
    subtotal_paise: number; tax_paise: number; customer_total_paise: number; contribution_paise: number; created_at: string;
  }[];
  const invoice = invoiceRes.data;
  const runs = (runsRes.data ?? []) as unknown as { id: string; name: string; completed_at: string | null; checklist_results: { id: string; label: string; status: string; note: string | null }[] }[];

  const vehicleName = job.vehicles
    ? `${job.vehicles.vehicle_models.vehicle_makes.name} ${job.vehicles.vehicle_models.name}`
    : "Walk-in vehicle";
  const approved = quotes.filter((q) => q.status === "approved");
  const approvedTotal = approved.reduce((a, q) => a + Number(q.customer_total_paise), 0);

  return (
    <>
      <PageTitle
        title={vehicleName}
        sub={[job.vehicles?.reg_no, job.vehicles?.year, fmtKm(job.odometer_km)].filter(Boolean).join(" · ")}
        back={{ href: "/garage/jobs", label: "Job cards" }}
        right={<>
          <Badge tone={job.origin === "marketplace" ? "warn" : "outline"}>
            {job.origin === "marketplace" ? "MEQIVA booking" : job.origin === "fleet" ? "Fleet" : "Walk-in"}
          </Badge>
          <Badge tone={job.completed_at ? "success" : job.started_at ? "brand" : "neutral"}>
            {job.completed_at ? "Completed" : job.started_at ? "In progress" : "Queued"}
          </Badge>
        </>}
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-6">
          <Panel title="What the customer reported">
            <div className="p-4">
              <p className="text-sm leading-relaxed">{job.complaints ?? "Nothing recorded."}</p>
              {job.advisor_notes && <p className="mt-2 text-[12.5px] text-ink2">{job.advisor_notes}</p>}
            </div>
          </Panel>

          <Panel title="Diagnostic findings" description="What the technician found. A manager turns this into a quotation.">
            <div className="p-4">
              <ActionForm action={recordDiagnostics} submitLabel="Save findings" variant="outline">
                <input type="hidden" name="jobId" value={id} />
                <Textarea name="diagnostics" rows={4} maxLength={4000} defaultValue={job.diagnostics ?? ""}
                  placeholder="Front right anti-roll bar link worn, play in the bush. Brake pads at 4mm, will need replacing within 5,000 km." />
              </ActionForm>
            </div>
          </Panel>

          {quotes.length > 0 && (
            <Section title="Quotations">
              <div className="space-y-4">
                {quotes.map((q) => (
                  <div key={q.id}>
                    <EstimateSheet
                      dense
                      heading={`${q.extra_work ? "Additional work" : "Quotation"} — version ${q.version}`}
                      subheading={fmtDateTime(q.created_at)}
                      lines={q.lines.map((l) => ({
                        description: l.description, qty: l.qty,
                        amountPaise: Number(l.line_total_paise), mrpPaise: l.mrp_paise,
                      }))}
                      subtotalPaise={Number(q.subtotal_paise)}
                      taxPaise={Number(q.tax_paise)}
                      totalPaise={Number(q.customer_total_paise)}
                      aside={
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge tone={q.status === "approved" ? "success" : q.status === "rejected" ? "danger" : q.status === "issued" ? "warn" : "neutral"}>
                            {q.status === "issued" ? "Waiting on the customer" : q.status}
                          </Badge>
                          <span className="tnum text-[11.5px] text-ink2">
                            Contribution {formatINR(Number(q.contribution_paise))}
                          </span>
                        </div>
                      }
                    />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {runs.length > 0 && (
            <Panel title="Checklists">
              {runs.map((r) => (
                <div key={r.id} className="border-b border-line last:border-0">
                  <p className="px-4 pt-3 text-[13px] font-medium">{r.name}</p>
                  <ul className="divide-y divide-line">
                    {r.checklist_results.map((it) => (
                      <li key={it.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
                        <span>{it.label}</span>
                        <Badge tone={it.status === "ok" ? "success" : it.status === "fail" ? "danger" : it.status === "attention" ? "warn" : "neutral"}>
                          {it.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </Panel>
          )}
        </div>

        <aside className="space-y-5">
          <Panel title="Job">
            <div className="p-4">
              <DataList cols={1} rows={[
                ["Checked in", fmtDateTime(job.checked_in_at)],
                ["Started", job.started_at ? fmtDateTime(job.started_at) : "Not yet"],
                ["Completed", job.completed_at ? fmtDateTime(job.completed_at) : "Not yet"],
                ["Technician", job.profiles?.full_name ?? "Unassigned"],
                ...(job.booking_id ? [["Booking", <Link key="b" href="/garage/bookings" className="underline">View booking</Link>] as [string, React.ReactNode]] : []),
              ]} />
            </div>
            <div className="space-y-3 border-t border-line p-4">
              <ActionForm action={assignTechnician} submitLabel="Assign" variant="outline" size="sm">
                <input type="hidden" name="jobId" value={id} />
                <Field label="Assign to">
                  <Select name="technicianId" defaultValue={job.technician_id ?? ""}>
                    <option value="">Unassigned</option>
                    {techs.map((t) => <option key={t.user_id} value={t.user_id}>{t.profiles?.full_name ?? "Team member"}</option>)}
                  </Select>
                </Field>
              </ActionForm>
              <div className="flex flex-wrap gap-2">
                {!job.started_at && <ActionButton action={updateJobProgress} label="Start work" variant="primary" hidden={{ jobId: id, what: "start" }} />}
                {job.started_at && !job.completed_at && <ActionButton action={updateJobProgress} label="Mark complete" variant="primary" hidden={{ jobId: id, what: "complete" }} />}
                {job.completed_at && <ActionButton action={updateJobProgress} label="Reopen" hidden={{ jobId: id, what: "reopen" }} />}
              </div>
            </div>
          </Panel>

          {defs.length > 0 && (
            <Panel title="Your fields">
              <div className="p-4">
                <DataList cols={1} rows={defs.map((d: FieldDef) => [d.label, displayValue(d, job.custom?.[d.key])] as [string, string])} />
              </div>
            </Panel>
          )}

          <Panel title="Money">
            <div className="space-y-3 p-4">
              <DataList cols={1} rows={[
                ["Approved so far", approvedTotal > 0 ? formatINR(approvedTotal) : "Nothing approved"],
                ["Invoice", invoice ? `${invoice.number} · ${formatINR(Number(invoice.total_paise))}` : "Not issued"],
              ]} />
              <div className="flex flex-wrap gap-2">
                <ButtonLink href={`/garage/quotes/new?job=${id}`} size="sm">New quotation</ButtonLink>
                {!invoice && approved.length > 0 && (
                  <ActionButton action={issueInvoice} label="Issue invoice" variant="accent" hidden={{ jobCardId: id }} />
                )}
              </div>
              {!invoice && approved.length === 0 && (
                <p className="text-[12px] text-ink2">
                  An invoice can only be issued against work the customer has approved.
                </p>
              )}
            </div>
          </Panel>

          {job.origin === "marketplace" && (
            <Callout tone="neutral">
              Marketplace job. Commission accrues once, when this job completes, on the basis in your agreement.
            </Callout>
          )}
        </aside>
      </div>

      {quotes.length === 0 && (
        <div className="mt-6">
          <Empty
            title="No quotation yet"
            body="Build one from the diagnostic findings. The customer sees prices only — your costs and margin stay on your side."
            action={<ButtonLink href={`/garage/quotes/new?job=${id}`}>Build a quotation</ButtonLink>}
          />
        </div>
      )}
    </>
  );
}
