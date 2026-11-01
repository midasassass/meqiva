import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Badge, Callout, Card, DataList, Empty, Field, Input, PageTitle, Panel, Stat, Textarea } from "@/components/ui";
import { claimWarranty } from "@/server/trust";
import { WARRANTY_KIND, WARRANTY_STATE, daysRemaining, kmRemaining, warrantyState, type WarrantyKind } from "@/lib/trust";
import { fmtDate, fmtKm } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Warranties" };

export default async function Warranties() {
  await requireUser();
  const sb = await supabaseServer();
  const today = new Date().toISOString().slice(0, 10);

  const [wRes, cRes] = await Promise.all([
    sb.from("warranties")
      .select(`id, kind, provider_name, covers, excludes, starts_on, expires_on, km_limit,
               odometer_at_start, reference,
               garages(public_name, slug), vehicles(id, reg_no, odometer_km, vehicle_models(name, vehicle_makes(name)))`)
      .order("starts_on", { ascending: false }).limit(60),
    sb.from("warranty_claims")
      .select("id, warranty_id, description, status, resolution, created_at")
      .order("created_at", { ascending: false }).limit(60),
  ]);

  type W = {
    id: string; kind: WarrantyKind; provider_name: string; covers: string; excludes: string | null;
    starts_on: string; expires_on: string | null; km_limit: number | null;
    odometer_at_start: number | null; reference: string | null;
    garages: { public_name: string; slug: string } | null;
    vehicles: {
      id: string; reg_no: string | null; odometer_km: number | null;
      vehicle_models: { name: string; vehicle_makes: { name: string } };
    } | null;
  };
  const warranties = (wRes.data ?? []) as unknown as W[];
  const claims = (cRes.data ?? []) as {
    id: string; warranty_id: string; description: string; status: string;
    resolution: string | null; created_at: string;
  }[];

  const withState = warranties.map((w) => ({ w, state: warrantyState(w, today, w.vehicles?.odometer_km) }));
  const live = withState.filter((x) => x.state === "active" || x.state === "expiring" || x.state === "open_ended");
  const past = withState.filter((x) => !live.includes(x));

  return (
    <>
      <PageTitle
        title="Your warranties"
        sub="Every job your garage warrants is recorded here with who honours it, exactly what it covers, and when it runs out. No paper slip to lose."
      />

      {warranties.length === 0 ? (
        <Empty
          title="No warranties recorded yet"
          body="When a MEQIVA garage completes work with a warranty, it appears here automatically — the terms, the end date and the distance limit, all in writing."
          icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
        />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Stat label="In cover now" value={String(live.length)} tone="success" />
            <Stat label="Lapsed" value={String(past.length)} />
            <Stat label="Open claims" value={String(claims.filter((c) => c.status === "open").length)}
              tone={claims.some((c) => c.status === "open") ? "warn" : undefined} />
          </div>

          <div className="space-y-4">
            {[...live, ...past].map(({ w, state }, i) => {
              const s = WARRANTY_STATE[state];
              const odo = w.vehicles?.odometer_km ?? null;
              const km = kmRemaining(w, odo);
              const days = daysRemaining(w.expires_on, today);
              const mine = claims.filter((c) => c.warranty_id === w.id);
              const claimable = state === "active" || state === "expiring" || state === "open_ended";

              return (
                <Card key={w.id} className="rise overflow-hidden" style={{ "--i": i } as React.CSSProperties}>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">{WARRANTY_KIND[w.kind]}</Badge>
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </div>
                      <p className="mt-2 text-[15px] font-semibold">{w.provider_name} honours this</p>
                      <p className="mt-0.5 text-[12.5px] text-ink2">
                        {w.vehicles
                          ? `${w.vehicles.vehicle_models.vehicle_makes.name} ${w.vehicles.vehicle_models.name}`
                          : "Vehicle not recorded"}
                        {w.vehicles?.reg_no && ` · ${w.vehicles.reg_no}`}
                        {w.garages && ` · work done at ${w.garages.public_name}`}
                      </p>
                    </div>
                    <div className="tnum text-right text-[12.5px] text-ink2">
                      {w.expires_on ? (
                        <>
                          <p className="text-[13px] font-semibold text-ink">{fmtDate(w.expires_on)}</p>
                          <p>{days != null && days >= 0 ? `${days} days left` : "end date passed"}</p>
                        </>
                      ) : (
                        <p>No end date</p>
                      )}
                      {km != null && <p className="mt-1">{fmtKm(km)} of cover left</p>}
                    </div>
                  </div>

                  <div className="p-5">
                    <DataList
                      rows={[
                        ["What is covered", <span key="c" className="leading-relaxed">{w.covers}</span>],
                        ...(w.excludes ? [["Not covered", <span key="e" className="leading-relaxed">{w.excludes}</span>] as [string, React.ReactNode]] : []),
                        ["Started", fmtDate(w.starts_on)],
                        ...(w.km_limit ? [["Distance limit", `${fmtKm(w.km_limit)} from ${fmtKm(w.odometer_at_start)}`] as [string, React.ReactNode]] : []),
                        ...(w.reference ? [["Reference", <span key="r" className="tnum">{w.reference}</span>] as [string, React.ReactNode]] : []),
                      ]}
                      cols={1}
                    />

                    {mine.length > 0 && (
                      <div className="mt-4 space-y-2 border-t border-line pt-4">
                        {mine.map((c) => (
                          <div key={c.id} className="rounded-card bg-surface2 px-3.5 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[12.5px] font-semibold">Claim opened {fmtDate(c.created_at)}</span>
                              <Badge tone={c.status === "resolved" ? "success" : c.status === "declined" ? "danger" : "warn"}>
                                {c.status === "open" ? "With the garage" : c.status === "accepted" ? "Accepted" : c.status === "declined" ? "Declined" : "Resolved"}
                              </Badge>
                            </div>
                            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink2">{c.description}</p>
                            {c.resolution && <p className="mt-1.5 text-[12.5px] leading-relaxed">{c.resolution}</p>}
                          </div>
                        ))}
                      </div>
                    )}

                    {claimable && (
                      <details className="group mt-4 border-t border-line pt-4">
                        <summary className="cursor-pointer text-[13px] font-semibold text-brand">
                          Something has gone wrong — make a claim
                        </summary>
                        <div className="mt-3">
                          <ActionForm action={claimWarranty} submitLabel="Open a claim" pendingLabel="Opening…" size="sm">
                            <input type="hidden" name="warrantyId" value={w.id} />
                            <Field label="What is happening?" required
                              hint="Describe the symptom and when it started. Be specific — it decides how fast this moves.">
                              <Textarea name="description" rows={4} required minLength={10} maxLength={4000}
                                placeholder="The grinding noise from the front left came back about a week after the brake job. It is worse when braking from speed." />
                            </Field>
                            <Field label="Odometer now" hint="In kilometres. Shows you are inside the distance limit.">
                              <Input name="odometerKm" type="number" inputMode="numeric" min={0}
                                defaultValue={odo ?? undefined} placeholder="64200" />
                            </Field>
                          </ActionForm>
                        </div>
                      </details>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Callout tone="brand" title="Why the distance matters as much as the date">
          A three-month warranty capped at 5,000 km ends on whichever comes first. If you drive a lot, the distance
          runs out long before the date does — so both are tracked here against your vehicle&apos;s actual odometer.
        </Callout>
        <Callout tone="neutral" title="Keep the odometer current">
          Cover is calculated from the reading on your vehicle record. Update it on your{" "}
          <Link href="/app/vehicles" className="font-semibold text-brand underline-offset-2 hover:underline">
            vehicle page
          </Link>{" "}
          so these figures stay true.
        </Callout>
      </div>
    </>
  );
}
