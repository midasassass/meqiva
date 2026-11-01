import { MessageSquareQuote } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Badge, Callout, Card, Empty, Field, Input, PageTitle, Stat, Textarea } from "@/components/ui";
import { submitSecondQuote } from "@/server/trust";
import { formatINR } from "@/lib/money";
import { fmtRelative } from "@/lib/format";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Second-quote leads" };

export default async function Leads() {
  const { sb, garage } = await requireGarageOrRedirect();

  // RLS already hides requests this garage is excluded from, and anything closed.
  const { data } = await sb.from("second_quote_requests")
    .select(`id, scope, vehicle_category, status, closes_at, created_at,
             vehicles(reg_no, odometer_km, vehicle_models(name, category, vehicle_makes(name))),
             second_quote_responses(id, garage_id, total_paise, note, est_minutes, warranty_days, created_at)`)
    .eq("status", "open").order("created_at", { ascending: false }).limit(50);

  const rows = (data ?? []) as unknown as {
    id: string; scope: string; vehicle_category: string | null; status: string;
    closes_at: string; created_at: string;
    vehicles: {
      reg_no: string | null; odometer_km: number | null;
      vehicle_models: { name: string; category: string; vehicle_makes: { name: string } };
    } | null;
    second_quote_responses: {
      id: string; garage_id: string; total_paise: number; note: string | null;
      est_minutes: number | null; warranty_days: number | null; created_at: string;
    }[];
  }[];

  const mineOn = (r: (typeof rows)[number]) => r.second_quote_responses.find((x) => x.garage_id === garage.id);
  const open = rows.filter((r) => !mineOn(r));
  const quoted = rows.filter((r) => mineOn(r));

  return (
    <>
      <PageTitle
        title="Second-quote leads"
        sub="Customers who have been quoted elsewhere and want another price for the same work. Quote it and you are competing on the job, not on advertising."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Waiting for your price" value={String(open.length)} tone={open.length > 0 ? "brand" : undefined} />
        <Stat label="You have quoted" value={String(quoted.length)} />
        <Stat label="Costs you" value="Nothing" hint="Commission applies only if the customer books." />
      </div>

      {rows.length === 0 ? (
        <Empty
          title="No open requests right now"
          body="These appear when a customer asks for a second quote on work they have been quoted for elsewhere. You never see what they were quoted, and they never see your competitors' prices."
          icon={<MessageSquareQuote className="h-5 w-5" aria-hidden />}
        />
      ) : (
        <div className="space-y-4">
          {[...open, ...quoted].map((r, i) => {
            const mine = mineOn(r);
            const v = r.vehicles;
            return (
              <Card key={r.id} className="rise overflow-hidden" style={{ "--i": i } as React.CSSProperties}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-semibold">
                      {v ? `${v.vehicle_models.vehicle_makes.name} ${v.vehicle_models.name}` : "Vehicle not shared"}
                    </p>
                    <p className="tnum mt-0.5 text-[12px] text-ink2">
                      {v?.vehicle_models.category ?? r.vehicle_category ?? "category unknown"}
                      {v?.odometer_km != null && ` · ${v.odometer_km.toLocaleString("en-IN")} km`}
                      {` · closes ${fmtRelative(r.closes_at)}`}
                    </p>
                  </div>
                  {mine ? (
                    <Badge tone="success">You quoted {formatINR(Number(mine.total_paise))}</Badge>
                  ) : (
                    <Badge tone="brand">Open</Badge>
                  )}
                </div>

                <div className="p-5">
                  <p className="rounded-card bg-surface2 px-3.5 py-3 text-[13.5px] leading-relaxed">{r.scope}</p>

                  {mine ? (
                    <div className="mt-4 text-[12.5px] text-ink2">
                      <p>
                        Sent {fmtRelative(mine.created_at)}
                        {mine.est_minutes ? ` · about ${Math.round(mine.est_minutes / 60)} hr` : ""}
                        {mine.warranty_days ? ` · ${mine.warranty_days}-day warranty` : ""}
                      </p>
                      {mine.note && <p className="mt-1.5 leading-relaxed">{mine.note}</p>}
                      <p className="mt-2">Send it again to revise your price while the request is open.</p>
                    </div>
                  ) : null}

                  <details className="group mt-4 border-t border-line pt-4" open={!mine && open.length <= 2}>
                    <summary className="cursor-pointer text-[13px] font-semibold text-brand">
                      {mine ? "Revise your quote" : "Quote this job"}
                    </summary>
                    <div className="mt-3">
                      <ActionForm action={submitSecondQuote} submitLabel={mine ? "Update my quote" : "Send my quote"}
                        pendingLabel="Sending…" size="sm">
                        <input type="hidden" name="requestId" value={r.id} />
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Field label="Your price" required hint="All in, including GST.">
                            <Input name="total" type="number" inputMode="decimal" required min={1} step="1"
                              defaultValue={mine ? Math.round(Number(mine.total_paise) / 100) : undefined}
                              placeholder="9400" className="tnum" />
                          </Field>
                          <Field label="Time in workshop" hint="Minutes.">
                            <Input name="estMinutes" type="number" inputMode="numeric" min={10} max={1440}
                              defaultValue={mine?.est_minutes ?? undefined} placeholder="180" className="tnum" />
                          </Field>
                          <Field label="Warranty" hint="Days.">
                            <Input name="warrantyDays" type="number" inputMode="numeric" min={0} max={3650}
                              defaultValue={mine?.warranty_days ?? undefined} placeholder="90" className="tnum" />
                          </Field>
                        </div>
                        <Field label="What is included"
                          hint="Say which parts you would use and what you would check first. This is what wins the job.">
                          <Textarea name="note" rows={3} maxLength={2000} defaultValue={mine?.note ?? undefined}
                            placeholder="OE-equivalent pads and discs, brake fluid flush included. We would measure disc thickness before replacing — if they are within limits we will say so and charge for pads only." />
                        </Field>
                      </ActionForm>
                    </div>
                  </details>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Callout tone="brand" title="What you can and cannot see">
          You get the described work and the vehicle. You do not get the customer&apos;s phone number, the price they
          were already quoted, or what any other garage has offered. Everyone quotes blind, which is the only way the
          number means anything.
        </Callout>
        <Callout tone="neutral" title="An honest quote beats a low one">
          Customers see your quote next to your quality-assured status and rating. Telling them you would check before
          replacing wins more work here than shaving a few hundred rupees off the total.
        </Callout>
      </div>
    </>
  );
}
