import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge, ButtonLink, Callout, Card, DataList, Empty, Field, Input, PageTitle, Panel, Section, Textarea } from "@/components/ui";
import { WARRANTY_KIND, WARRANTY_STATE, summariseForecast, warrantyState, type ForecastRow, type WarrantyKind } from "@/lib/trust";
import { ActionForm } from "@/components/action-form";
import { addServiceRecord } from "@/server/customer";
import { formatINR } from "@/lib/money";
import { fmtDate, fmtKm } from "@/lib/format";
import { serviceDue } from "@/lib/reminders";
import { istYmd } from "@/lib/availability";
import { requireUser } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Vehicle" };

export default async function VehiclePassport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();
  const sb = await supabaseServer();

  const { data: v } = await sb.from("vehicles")
    .select("id, year, reg_no, odometer_km, last_service_on, last_service_km, notes, warranty_note, vehicle_models(name, category, vehicle_makes(name))")
    .eq("id", id).maybeSingle();
  if (!v) notFound();

  const vehicle = v as unknown as {
    id: string; year: number | null; reg_no: string | null; odometer_km: number | null;
    last_service_on: string | null; last_service_km: number | null; notes: string | null; warranty_note: string | null;
    vehicle_models: { name: string; category: string; vehicle_makes: { name: string } };
  };

  const [invoicesRes, uploadedRes, forecastRes, warrantyRes, evidenceRes] = await Promise.all([
    sb.from("invoices").select("id, number, total_paise, issued_at, lines, garages(public_name, slug), job_cards!inner(vehicle_id, odometer_km, complaints)")
      .eq("job_cards.vehicle_id", id).order("issued_at", { ascending: false }),
    sb.from("vehicle_service_records").select("id, serviced_on, odometer_km, garage_name, summary, amount_paise")
      .eq("vehicle_id", id).order("serviced_on", { ascending: false }),
    sb.rpc("forecast_maintenance", { p_vehicle: id }),
    sb.from("warranties")
      .select("id, kind, provider_name, covers, starts_on, expires_on, km_limit, odometer_at_start, garages(public_name)")
      .eq("vehicle_id", id).order("starts_on", { ascending: false }),
    sb.from("service_evidence")
      .select("id, caption, kind, stage, created_at, job_cards!inner(vehicle_id)")
      .eq("job_cards.vehicle_id", id).eq("visible_to_customer", true)
      .order("created_at", { ascending: false }).limit(12),
  ]);

  const verified = (invoicesRes.data ?? []) as unknown as {
    id: string; number: string; total_paise: number; issued_at: string; lines: { description: string }[];
    garages: { public_name: string; slug: string }; job_cards: { odometer_km: number | null; complaints: string | null };
  }[];
  const uploaded = uploadedRes.data ?? [];
  const forecast = (forecastRes.data ?? []) as ForecastRow[];
  const warranties = (warrantyRes.data ?? []) as unknown as {
    id: string; kind: WarrantyKind; provider_name: string; covers: string; starts_on: string;
    expires_on: string | null; km_limit: number | null; odometer_at_start: number | null;
    garages: { public_name: string } | null;
  }[];
  const evidence = (evidenceRes.data ?? []) as unknown as {
    id: string; caption: string | null; kind: string; stage: string | null; created_at: string;
  }[];

  const name = `${vehicle.vehicle_models.vehicle_makes.name} ${vehicle.vehicle_models.name}`;
  const todayYmd = istYmd(new Date());
  const plan = summariseForecast(forecast, todayYmd);
  const due = serviceDue({
    vehicleId: vehicle.id, category: vehicle.vehicle_models.category, lastServiceOn: vehicle.last_service_on,
    lastServiceKm: vehicle.last_service_km, odometerKm: vehicle.odometer_km,
  }, istYmd(new Date()));

  return (
    <>
      <PageTitle
        title={name}
        sub={[vehicle.year, vehicle.reg_no].filter(Boolean).join(" · ") || undefined}
        back={{ href: "/app/vehicles", label: "All vehicles" }}
        right={<>
          <ButtonLink href={`/app/vehicles/${id}/export`} variant="outline" size="sm" prefetch={false}>Export history</ButtonLink>
          <ButtonLink href="/find" size="sm">Book a service</ButtonLink>
        </>}
      />

      {due.due && <Callout tone="warn" title="This vehicle is due for a service">{due.reason}</Callout>}

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div>
          <Section title={`Service history${verified.length ? ` (${verified.length} verified)` : ""}`}>
            {verified.length === 0 && uploaded.length === 0 ? (
              <Empty title="No history yet" body="Services booked through MEQIVA are recorded here automatically, with the itemised invoice attached." />
            ) : (
              <ul className="grid gap-3">
                {verified.map((inv) => (
                  <li key={inv.id}>
                    <Card className="p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/garages/${inv.garages.slug}`} className="font-medium hover:underline">{inv.garages.public_name}</Link>
                            <Badge tone="success">Verified through MEQIVA</Badge>
                          </div>
                          <p className="tnum mt-1 text-[12.5px] text-ink2">
                            {fmtDate(inv.issued_at)}
                            {inv.job_cards?.odometer_km != null && ` · ${fmtKm(inv.job_cards.odometer_km)}`}
                            {` · invoice ${inv.number}`}
                          </p>
                          {inv.job_cards?.complaints && <p className="mt-1.5 text-[13px] text-ink2">{inv.job_cards.complaints}</p>}
                        </div>
                        <p className="tnum font-semibold">{formatINR(Number(inv.total_paise))}</p>
                      </div>
                      {Array.isArray(inv.lines) && inv.lines.length > 0 && (
                        <p className="mt-2 text-[12.5px] text-ink2">{inv.lines.map((l) => l.description).join(", ")}</p>
                      )}
                    </Card>
                  </li>
                ))}

                {uploaded.map((r) => (
                  <li key={r.id}>
                    <Card className="border-dashed p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{r.garage_name ?? "Another garage"}</p>
                            <Badge tone="outline">Added by you, not verified</Badge>
                          </div>
                          <p className="tnum mt-1 text-[12.5px] text-ink2">
                            {fmtDate(r.serviced_on)}{r.odometer_km != null && ` · ${fmtKm(r.odometer_km)}`}
                          </p>
                          {r.summary && <p className="mt-1.5 text-[13px] text-ink2">{r.summary}</p>}
                        </div>
                        {r.amount_paise != null && <p className="tnum font-semibold">{formatINR(Number(r.amount_paise))}</p>}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Cost forecast. Every figure comes from what garages have actually published. */}
          <div className="mt-8">
            <Section
              title="What the next year looks like"
              description="Due dates from your running and service history; prices from what garages near you have actually published for this vehicle class."
            >
              {forecast.length === 0 ? (
                <Empty
                  title="Not enough to forecast on yet"
                  body="Record a service with the odometer reading and we can work out how much you drive, what falls due when, and what it will cost."
                />
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Card className="p-5">
                      <p className="tnum display-2">{plan.twelveMonthPaise > 0 ? formatINR(plan.twelveMonthPaise) : "—"}</p>
                      <p className="mt-1.5 text-[13px] font-semibold">likely spend over twelve months</p>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-ink2">
                        Sum of the typical price for {plan.pricedCount} {plan.pricedCount === 1 ? "item" : "items"} falling due.
                        {plan.unpricedCount > 0 && ` ${plan.unpricedCount} more ${plan.unpricedCount === 1 ? "is" : "are"} due but nobody near you has published a price yet.`}
                      </p>
                    </Card>
                    <Card className={plan.overdue.length > 0 ? "border-warn/50 bg-warn-soft/40 p-5" : "p-5"}>
                      <p className="tnum display-2">{plan.overdue.length}</p>
                      <p className="mt-1.5 text-[13px] font-semibold">
                        {plan.overdue.length === 1 ? "item is already overdue" : "items are already overdue"}
                      </p>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-ink2">
                        {plan.overdue.length > 0
                          ? "Overdue on time or on distance. Doing these first is almost always cheaper than waiting."
                          : "Nothing has slipped past its interval."}
                      </p>
                    </Card>
                  </div>

                  <ul className="mt-4 divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface">
                    {plan.within12Months.map((r) => (
                      <li key={`${r.package_id}-${r.due_on}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                        <div className="min-w-0">
                          <p className="text-[13.5px] font-semibold">{r.package_name}</p>
                          <p className="tnum mt-0.5 text-[11.5px] text-ink2">
                            {r.due_reason} · {fmtDate(r.due_on)}
                            {r.garages > 0 && ` · ${r.garages} ${r.garages === 1 ? "garage priced" : "garages priced"}`}
                          </p>
                        </div>
                        <p className="tnum shrink-0 text-right text-[13px]">
                          {r.median_paise != null && r.garages > 0 ? (
                            <>
                              <span className="font-bold">{formatINR(Number(r.median_paise))}</span>
                              {r.low_paise != null && r.high_paise != null && (
                                <span className="block text-[11px] font-normal text-ink2">
                                  {formatINR(Number(r.low_paise))} – {formatINR(Number(r.high_paise))}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[12px] text-ink2">No price published</span>
                          )}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11.5px] leading-relaxed text-ink2">
                    A forecast, not a quotation. It assumes nothing breaks unexpectedly and that you keep driving about
                    as much as you have been. Book any of it and you get a real itemised quote first.
                  </p>
                </>
              )}
            </Section>
          </div>

          {evidence.length > 0 && (
            <div className="mt-8">
              <Section title="Photos from the workshop"
                description="Taken during your jobs and attached to them. Open a booking to see the full set against each stage.">
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {evidence.map((e) => (
                    <li key={e.id} className="rounded-card border border-line bg-surface px-4 py-3">
                      <p className="text-[13px] font-medium">{e.caption ?? "Workshop photo"}</p>
                      <p className="tnum mt-0.5 text-[11.5px] text-ink2">
                        {e.stage ?? e.kind} · {fmtDate(e.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>
          )}
        </div>

        <aside className="space-y-6">
          <Panel title="Details">
            <div className="p-4">
              <DataList cols={1} rows={[
                ["Model", name],
                ["Year", vehicle.year ?? "—"],
                ["Registration", vehicle.reg_no ?? "—"],
                ["Odometer", fmtKm(vehicle.odometer_km)],
                ["Last service", vehicle.last_service_on ? `${fmtDate(vehicle.last_service_on)}${vehicle.last_service_km ? ` at ${fmtKm(vehicle.last_service_km)}` : ""}` : "Not recorded"],
                ["Next due", due.dueOn ? fmtDate(due.dueOn) : "Not enough history"],
              ]} />
            </div>
          </Panel>

          <Panel title="Warranties on this vehicle">
            <div className="p-4">
              {warranties.length === 0 ? (
                <p className="text-[12.5px] leading-relaxed text-ink2">
                  Nothing recorded yet. Work done at a MEQIVA garage with a warranty appears here with its terms and
                  end date.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {warranties.map((w) => {
                    const st = WARRANTY_STATE[warrantyState(w, todayYmd, vehicle.odometer_km)];
                    return (
                      <li key={w.id} className="rounded-card border border-line px-3.5 py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[12.5px] font-semibold">{WARRANTY_KIND[w.kind]}</span>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </div>
                        <p className="mt-1 text-[12px] leading-relaxed text-ink2">{w.covers}</p>
                        <p className="tnum mt-1 text-[11px] text-ink2">
                          {w.provider_name}
                          {w.expires_on && ` · till ${fmtDate(w.expires_on)}`}
                          {w.km_limit && ` or ${fmtKm(w.km_limit)}`}
                        </p>
                      </li>
                    );
                  })}
                  <li>
                    <Link href="/app/warranties" className="text-[12.5px] font-semibold text-brand hover:underline">
                      All warranties and claims
                    </Link>
                  </li>
                </ul>
              )}
            </div>
          </Panel>

          <Panel title="Add earlier history" description="Work done before MEQIVA. Kept separate and labelled as unverified.">
            <div className="p-4">
              <ActionForm action={addServiceRecord} submitLabel="Add record" pendingLabel="Saving…" variant="outline" resetOnSuccess fullWidth>
                <input type="hidden" name="vehicleId" value={id} />
                <Field label="Date of service" required><Input name="servicedOn" type="date" required /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Odometer"><Input name="odometerKm" type="number" inputMode="numeric" min={0} /></Field>
                  <Field label="Garage"><Input name="garageName" maxLength={120} /></Field>
                </div>
                <Field label="What was done"><Textarea name="summary" rows={2} maxLength={1000} /></Field>
              </ActionForm>
            </div>
          </Panel>

          <p className="text-xs text-ink2">
            Your history belongs to you. Export it any time as a spreadsheet — verified and self-added records stay
            marked as such so a future buyer or garage can tell them apart.
          </p>
        </aside>
      </div>
    </>
  );
}
