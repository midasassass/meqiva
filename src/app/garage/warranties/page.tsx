import { ShieldCheck } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Badge, Callout, Card, Empty, Field, Input, PageTitle, Panel, RadioCards, Section, Stat, Table, Td, Textarea, Tr } from "@/components/ui";
import { issueWarranty } from "@/server/trust";
import { WARRANTY_KIND, WARRANTY_STATE, warrantyState, type WarrantyKind } from "@/lib/trust";
import { fmtDate, fmtKm } from "@/lib/format";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Warranties you have given" };

export default async function GarageWarranties() {
  const { sb, garage } = await requireGarageOrRedirect();
  const today = new Date().toISOString().slice(0, 10);

  const [wRes, jobsRes, claimsRes] = await Promise.all([
    sb.from("warranties")
      .select(`id, kind, provider_name, covers, starts_on, expires_on, km_limit, odometer_at_start, reference,
               vehicles(reg_no, odometer_km, vehicle_models(name, vehicle_makes(name))), profiles(full_name)`)
      .eq("garage_id", garage.id).order("starts_on", { ascending: false }).limit(100),
    sb.from("job_cards")
      .select("id, vehicle_id, customer_id, odometer_km, completed_at, complaints, vehicles(reg_no, vehicle_models(name, vehicle_makes(name)))")
      .eq("garage_id", garage.id).not("completed_at", "is", null)
      .order("completed_at", { ascending: false }).limit(40),
    sb.from("warranty_claims")
      .select("id, warranty_id, description, status, odometer_km, created_at")
      .order("created_at", { ascending: false }).limit(50),
  ]);

  type W = {
    id: string; kind: WarrantyKind; provider_name: string; covers: string; starts_on: string;
    expires_on: string | null; km_limit: number | null; odometer_at_start: number | null; reference: string | null;
    vehicles: { reg_no: string | null; odometer_km: number | null; vehicle_models: { name: string; vehicle_makes: { name: string } } } | null;
    profiles: { full_name: string | null } | null;
  };
  const warranties = (wRes.data ?? []) as unknown as W[];
  const jobs = (jobsRes.data ?? []) as unknown as {
    id: string; vehicle_id: string | null; customer_id: string | null;
    odometer_km: number | null; completed_at: string | null; complaints: string | null;
    vehicles: { reg_no: string | null; vehicle_models: { name: string; vehicle_makes: { name: string } } } | null;
  }[];
  const claims = (claimsRes.data ?? []) as {
    id: string; warranty_id: string; description: string; status: string;
    odometer_km: number | null; created_at: string;
  }[];

  const live = warranties.filter((w) => {
    const s = warrantyState(w, today, w.vehicles?.odometer_km);
    return s === "active" || s === "expiring" || s === "open_ended";
  });
  const openClaims = claims.filter((c) => c.status === "open");

  return (
    <>
      <PageTitle
        title="Warranties you have given"
        sub="Record what you stand behind and the customer sees it in their account — provider, terms, end date and distance limit. Written-down cover is what turns a one-off job into a returning customer."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="In cover now" value={String(live.length)} tone="success" />
        <Stat label="Issued all time" value={String(warranties.length)} />
        <Stat label="Open claims" value={String(openClaims.length)} tone={openClaims.length > 0 ? "warn" : undefined}
          hint={openClaims.length > 0 ? "Answer these first." : "Nothing outstanding."} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:items-start">
        <div className="space-y-5">
          {openClaims.length > 0 && (
            <Section title="Claims waiting on you">
              <div className="space-y-2.5">
                {openClaims.map((c) => {
                  const w = warranties.find((x) => x.id === c.warranty_id);
                  return (
                    <Card key={c.id} className="border-warn/40 bg-warn-soft/40 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[13px] font-semibold">
                          {w?.vehicles
                            ? `${w.vehicles.vehicle_models.vehicle_makes.name} ${w.vehicles.vehicle_models.name}`
                            : "Vehicle"}
                          {w?.vehicles?.reg_no && <span className="tnum font-normal text-ink2"> · {w.vehicles.reg_no}</span>}
                        </span>
                        <Badge tone="warn">Opened {fmtDate(c.created_at)}</Badge>
                      </div>
                      <p className="mt-2 text-[12.5px] leading-relaxed">{c.description}</p>
                      {c.odometer_km != null && (
                        <p className="tnum mt-1.5 text-[11.5px] text-ink2">Odometer at claim: {fmtKm(c.odometer_km)}</p>
                      )}
                    </Card>
                  );
                })}
              </div>
            </Section>
          )}

          <Section title="Everything you have issued">
            {warranties.length === 0 ? (
              <Empty
                title="No warranties recorded"
                body="Issue one against a completed job card and it lands in the customer's account immediately."
                icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
              />
            ) : (
              <Table head={["Vehicle", "Covers", "Type", "Ends", "State"]}>
                {warranties.map((w) => {
                  const s = WARRANTY_STATE[warrantyState(w, today, w.vehicles?.odometer_km)];
                  return (
                    <Tr key={w.id}>
                      <Td>
                        <p className="text-[13px] font-semibold">
                          {w.vehicles
                            ? `${w.vehicles.vehicle_models.vehicle_makes.name} ${w.vehicles.vehicle_models.name}`
                            : "—"}
                        </p>
                        <p className="tnum text-[11.5px] text-ink2">
                          {w.vehicles?.reg_no ?? ""}{w.profiles?.full_name ? ` · ${w.profiles.full_name}` : ""}
                        </p>
                      </Td>
                      <Td className="max-w-[22rem] text-[12.5px] leading-relaxed text-ink2">{w.covers}</Td>
                      <Td className="text-[12.5px]">{WARRANTY_KIND[w.kind]}</Td>
                      <Td className="tnum text-[12.5px]">
                        {w.expires_on ? fmtDate(w.expires_on) : "No end date"}
                        {w.km_limit && <span className="block text-[11px] text-ink2">or {fmtKm(w.km_limit)}</span>}
                      </Td>
                      <Td><Badge tone={s.tone}>{s.label}</Badge></Td>
                    </Tr>
                  );
                })}
              </Table>
            )}
          </Section>
        </div>

        <div className="space-y-5">
          <Panel title="Issue a warranty" tone="brand">
            <div className="p-5">
              {!garage.isManager ? (
                <p className="text-[13px] text-ink2">Only an owner or service advisor can issue a warranty.</p>
              ) : jobs.length === 0 ? (
                <p className="text-[13px] text-ink2">
                  Complete a job card first — a warranty attaches to the work it covers.
                </p>
              ) : (
                <ActionForm action={issueWarranty} submitLabel="Record it" pendingLabel="Recording…" resetOnSuccess fullWidth>
                  <Field label="Against which job?" required>
                    <RadioCards
                      name="jobCardId"
                      defaultValue={jobs[0]?.id ?? ""}
                      options={jobs.slice(0, 8).map((j) => ({
                        value: j.id,
                        label: j.vehicles ? `${j.vehicles.vehicle_models.vehicle_makes.name} ${j.vehicles.vehicle_models.name}` : "Job card",
                        hint: [j.vehicles?.reg_no, j.odometer_km != null ? fmtKm(j.odometer_km) : null,
                               j.completed_at ? `completed ${fmtDate(j.completed_at)}` : null,
                               j.complaints?.slice(0, 60)].filter(Boolean).join(" · "),
                      }))}
                    />
                  </Field>
                  <Field label="What kind of cover?" required>
                    <RadioCards
                      name="kind" defaultValue="labour" columns={1}
                      options={[
                        { value: "labour", label: "Workmanship", hint: "You stand behind your own labour." },
                        { value: "part", label: "Part", hint: "The manufacturer's warranty on a part you fitted." },
                        { value: "platform", label: "MEQIVA-backed", hint: "Only where MEQIVA has agreed to stand behind it." },
                      ]}
                    />
                  </Field>
                  <Field label="Who honours it?" required hint="Your workshop, or the part maker's name.">
                    <Input name="providerName" required minLength={2} maxLength={120} placeholder={garage.name} />
                  </Field>
                  <Field label="What is covered?" required hint="Be exact. Vague cover is worth nothing to the customer and nothing to you in a dispute.">
                    <Textarea name="covers" rows={3} required minLength={10} maxLength={2000}
                      placeholder="Front brake pads and discs we fitted, plus the labour to refit them if the noise or vibration returns." />
                  </Field>
                  <Field label="What is not covered?" hint="Optional, and worth writing.">
                    <Textarea name="excludes" rows={2} maxLength={2000}
                      placeholder="Damage from kerbing, track use, or pads glazed by riding the brakes downhill." />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Months" hint="Leave blank for none.">
                      <Input name="months" type="number" inputMode="numeric" min={0} max={120} placeholder="6" className="tnum" />
                    </Field>
                    <Field label="Distance limit" hint="Km.">
                      <Input name="kmLimit" type="number" inputMode="numeric" min={0} placeholder="10000" className="tnum" />
                    </Field>
                    <Field label="Odometer now" hint="Km.">
                      <Input name="odometer" type="number" inputMode="numeric" min={0} placeholder="62400" className="tnum" />
                    </Field>
                  </div>
                  <Field label="Your reference" hint="Optional — a part warranty card number, say.">
                    <Input name="reference" maxLength={60} placeholder="BOSCH-4471-2026" className="tnum" />
                  </Field>
                </ActionForm>
              )}
            </div>
          </Panel>

          <Callout tone="neutral" title="Whichever comes first">
            A warranty with both a month count and a distance limit ends at whichever the customer reaches first, and
            that is exactly how it is shown to them. Setting both honestly avoids the argument later.
          </Callout>
        </div>
      </div>
    </>
  );
}
