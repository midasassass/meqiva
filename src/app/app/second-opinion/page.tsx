import { MessageSquareQuote } from "lucide-react";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Callout, Card, Empty, Field, Input, PageTitle, Panel, Select, Textarea } from "@/components/ui";
import { closeSecondQuote, requestSecondQuote } from "@/server/trust";
import { formatINR } from "@/lib/money";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Get a second quote" };

export default async function SecondOpinion() {
  await requireUser();
  const sb = await supabaseServer();

  const [reqRes, vehiclesRes, garagesRes] = await Promise.all([
    sb.from("second_quote_requests")
      .select(`id, scope, original_total_paise, status, closes_at, created_at,
               excluded:garages!exclude_garage_id(public_name),
               vehicles(reg_no, vehicle_models(name, vehicle_makes(name))),
               second_quote_responses(id, total_paise, note, est_minutes, warranty_days, valid_until, garages(id, public_name, slug, verification))`)
      .order("created_at", { ascending: false }).limit(20),
    sb.from("vehicles").select("id, reg_no, vehicle_models(name, category, vehicle_makes(name))")
      .order("created_at", { ascending: false }),
    sb.from("garages").select("id, public_name").eq("status", "active").order("public_name").limit(200),
  ]);

  type Resp = {
    id: string; total_paise: number; note: string | null; est_minutes: number | null;
    warranty_days: number | null; valid_until: string;
    garages: { id: string; public_name: string; slug: string; verification: string | null } | null;
  };
  const requests = (reqRes.data ?? []) as unknown as {
    id: string; scope: string; original_total_paise: number | null; status: string;
    closes_at: string; created_at: string;
    excluded: { public_name: string } | null;
    vehicles: { reg_no: string | null; vehicle_models: { name: string; vehicle_makes: { name: string } } } | null;
    second_quote_responses: Resp[];
  }[];
  const vehicles = (vehiclesRes.data ?? []) as unknown as {
    id: string; reg_no: string | null;
    vehicle_models: { name: string; category: string; vehicle_makes: { name: string } };
  }[];
  const garages = garagesRes.data ?? [];

  return (
    <>
      <PageTitle
        title="Get a second quote"
        sub="Been quoted something that feels high? Describe the work and other workshops nearby will quote the same job. The garage that quoted you is shut out of this entirely."
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <div className="space-y-4">
          {requests.length === 0 ? (
            <Empty
              title="No requests open"
              body="Open one and other garages quote the same work within 72 hours. You are not committing to anything by asking."
            />
          ) : (
            requests.map((r, i) => {
              const quotes = [...r.second_quote_responses].sort((a, b) => Number(a.total_paise) - Number(b.total_paise));
              const original = r.original_total_paise != null ? Number(r.original_total_paise) : null;
              const best = quotes[0] ? Number(quotes[0].total_paise) : null;
              const saving = original != null && best != null ? original - best : null;

              return (
                <Card key={r.id} className="rise overflow-hidden" style={{ "--i": i } as React.CSSProperties}>
                  <div className="border-b border-line p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {r.vehicles
                            ? `${r.vehicles.vehicle_models.vehicle_makes.name} ${r.vehicles.vehicle_models.name}`
                            : "Second quote"}
                          {r.vehicles?.reg_no && <span className="tnum font-normal text-ink2"> · {r.vehicles.reg_no}</span>}
                        </p>
                        <p className="mt-0.5 text-[12px] text-ink2">
                          Opened {fmtDateTime(r.created_at)}
                          {r.status === "open" && ` · closes ${fmtRelative(r.closes_at)}`}
                          {r.excluded && ` · ${r.excluded.public_name} excluded`}
                        </p>
                      </div>
                      <Badge tone={r.status === "open" ? "brand" : "neutral"}>
                        {r.status === "open" ? "Open for quotes" : r.status === "closed" ? "Closed" : "Expired"}
                      </Badge>
                    </div>
                    <p className="mt-3 rounded-card bg-surface2 px-3.5 py-3 text-[13.5px] leading-relaxed">{r.scope}</p>
                    {original != null && (
                      <p className="tnum mt-2.5 text-[12.5px] text-ink2">
                        Originally quoted <span className="font-semibold text-ink">{formatINR(original)}</span>
                      </p>
                    )}
                  </div>

                  <div className="p-5">
                    {quotes.length === 0 ? (
                      <p className="text-[13px] text-ink2">
                        {r.status === "open"
                          ? "No quotes yet. Garages usually respond within a working day."
                          : "No garage quoted this one."}
                      </p>
                    ) : (
                      <>
                        {saving != null && saving > 0 && (
                          <p className="tnum mb-4 rounded-card bg-success-soft px-3.5 py-2.5 text-[13px] font-semibold text-success">
                            Lowest quote is {formatINR(saving)} below what you were quoted.
                          </p>
                        )}
                        <ul className="space-y-2.5">
                          {quotes.map((q, qi) => (
                            <li key={q.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line px-4 py-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-[13.5px] font-semibold">{q.garages?.public_name ?? "A garage"}</span>
                                  {(q.garages?.verification === "verified" || q.garages?.verification === "quality_assured") && (
                                    <Badge tone="success">
                                      {q.garages.verification === "quality_assured" ? "Quality assured" : "Verified"}
                                    </Badge>
                                  )}
                                  {qi === 0 && quotes.length > 1 && <Badge tone="brand">Lowest</Badge>}
                                </div>
                                <p className="tnum mt-0.5 text-[11.5px] text-ink2">
                                  {q.est_minutes ? `About ${Math.round(q.est_minutes / 60)} hr in the workshop` : "Time not stated"}
                                  {q.warranty_days ? ` · ${q.warranty_days}-day warranty` : ""}
                                  {` · valid till ${fmtDateTime(q.valid_until)}`}
                                </p>
                                {q.note && <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink2">{q.note}</p>}
                              </div>
                              <p className="tnum text-[15px] font-bold">{formatINR(Number(q.total_paise))}</p>
                            </li>
                          ))}
                        </ul>
                      </>
                    )}

                    {r.status === "open" && (
                      <div className="mt-4">
                        <ActionButton action={closeSecondQuote} label="Stop taking quotes" variant="ghost" hidden={{ id: r.id }} />
                      </div>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>

        <div className="space-y-5">
          <Panel title="Ask for quotes" tone="brand">
            <div className="p-5">
              <ActionForm action={requestSecondQuote} submitLabel="Open for 72 hours" pendingLabel="Opening…" resetOnSuccess fullWidth>
                <Field label="Which vehicle?">
                  <Select name="vehicleId" defaultValue="">
                    <option value="">Not listed</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vehicle_models.vehicle_makes.name} {v.vehicle_models.name}{v.reg_no ? ` · ${v.reg_no}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="What work has been quoted?" required
                  hint="List the jobs. The more exact you are, the closer the quotes will be to like-for-like.">
                  <Textarea name="scope" rows={5} required minLength={5} maxLength={2000}
                    placeholder="Front brake pads and discs both sides, brake fluid flush, and a wheel alignment afterwards." />
                </Field>
                <Field label="Amount you were quoted" hint="In rupees. Optional, and never shown to the garages quoting.">
                  <Input name="originalTotal" type="number" inputMode="decimal" min={0} step="1" placeholder="11800" />
                </Field>
                <Field label="Leave out this garage" hint="The workshop that gave you the original quote.">
                  <Select name="excludeGarageId" defaultValue="">
                    <option value="">Nobody in particular</option>
                    {garages.map((g) => <option key={g.id} value={g.id}>{g.public_name}</option>)}
                  </Select>
                </Field>
              </ActionForm>
            </div>
          </Panel>

          <Callout tone="neutral" icon={<MessageSquareQuote className="h-4 w-4" aria-hidden />} title="How this stays fair">
            Garages see the work you described and nothing else — not the price you were quoted, not your phone number,
            and not each other&apos;s quotes. The garage you excluded cannot see the request at all. That rule is
            enforced in the database, not by asking nicely.
          </Callout>
        </div>
      </div>
    </>
  );
}
