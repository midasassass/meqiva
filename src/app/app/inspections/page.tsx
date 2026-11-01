import { ClipboardCheck } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Badge, Callout, Card, Empty, Field, Input, PageTitle, Panel, RadioCards, Section } from "@/components/ui";
import { orderInspection } from "@/server/trust";
import { GRADE } from "@/lib/trust";
import { formatINR } from "@/lib/money";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Used-car inspection" };

type StatusMeta = { label: string; tone: "neutral" | "brand" | "warn" | "success" };
const FALLBACK_STATUS: StatusMeta = { label: "Being scheduled", tone: "warn" };
const STATUS: Record<string, StatusMeta> = {
  requested: { label: "Being scheduled", tone: "warn" },
  scheduled: { label: "Scheduled", tone: "brand" },
  in_progress: { label: "Inspector on site", tone: "brand" },
  reported: { label: "Report ready", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export default async function Inspections({ searchParams }: { searchParams: Promise<{ placed?: string }> }) {
  await requireUser();
  const { placed } = await searchParams;
  const sb = await supabaseServer();

  const [pkgRes, orderRes] = await Promise.all([
    sb.from("inspection_packages").select("id, slug, name, description, checkpoints, price_paise, duration_minutes")
      .eq("active", true).order("price_paise"),
    sb.from("inspection_orders")
      .select(`id, vehicle_description, registration, inspect_at, scheduled_for, status, price_paise, created_at,
               inspection_packages(name, checkpoints),
               inspection_reports(overall_grade, headline, recommendation, estimated_spend_paise, inspector_name, published_at)`)
      .order("created_at", { ascending: false }).limit(20),
  ]);

  const packages = (pkgRes.data ?? []) as {
    id: number; slug: string; name: string; description: string | null;
    checkpoints: number; price_paise: number; duration_minutes: number;
  }[];
  const orders = (orderRes.data ?? []) as unknown as {
    id: string; vehicle_description: string; registration: string | null; inspect_at: string | null;
    scheduled_for: string | null; status: string; price_paise: number; created_at: string;
    inspection_packages: { name: string; checkpoints: number } | null;
    inspection_reports: {
      overall_grade: string | null; headline: string | null; recommendation: string | null;
      estimated_spend_paise: number | null; inspector_name: string | null; published_at: string | null;
    } | null;
  }[];

  return (
    <>
      <PageTitle
        title="Before you buy a used car"
        sub="A MEQIVA inspector goes to the seller, checks the vehicle against a fixed list, and sends you a graded report — so you negotiate on findings instead of on feel."
      />

      {placed && (
        <Callout tone="success" title="Order placed">
          We will confirm a time with the seller and tell you when the inspector is going. You pay after the report
          reaches you, not before.
        </Callout>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:items-start">
        <div className="space-y-5">
          <Section title="Your inspections">
            {orders.length === 0 ? (
              <Empty
                title="Nothing ordered yet"
                body="Found a car you like? Order an inspection before you pay the token amount. Most sellers agree — the ones who refuse are telling you something."
                icon={<ClipboardCheck className="h-5 w-5" aria-hidden />}
              />
            ) : (
              <div className="space-y-4">
                {orders.map((o, i) => {
                  const st = STATUS[o.status] ?? FALLBACK_STATUS;
                  const rep = o.inspection_reports;
                  const grade = rep?.overall_grade ? GRADE[rep.overall_grade] : null;

                  return (
                    <Card key={o.id} className="rise overflow-hidden" style={{ "--i": i } as React.CSSProperties}>
                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
                        <div className="min-w-0">
                          <p className="text-[14.5px] font-semibold">{o.vehicle_description}</p>
                          <p className="tnum mt-0.5 text-[12px] text-ink2">
                            {o.inspection_packages?.name}
                            {o.registration && ` · ${o.registration}`}
                            {` · ordered ${fmtDate(o.created_at)}`}
                          </p>
                          {o.scheduled_for && (
                            <p className="mt-1 text-[12.5px] text-ink2">Inspector visiting {fmtDateTime(o.scheduled_for)}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge tone={st.tone}>{st.label}</Badge>
                          <p className="tnum mt-1.5 text-[13px] font-semibold">{formatINR(Number(o.price_paise))}</p>
                        </div>
                      </div>

                      {rep?.published_at && grade && (
                        <div className="p-5">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={grade.tone}>{grade.label}</Badge>
                            <span className="text-[12px] text-ink2">{grade.meaning}</span>
                          </div>
                          {rep.headline && <p className="mt-3 text-[15px] font-semibold leading-snug">{rep.headline}</p>}
                          {rep.recommendation && (
                            <p className="mt-2 text-[13.5px] leading-relaxed text-ink2">{rep.recommendation}</p>
                          )}
                          {rep.estimated_spend_paise != null && (
                            <p className="tnum mt-3 rounded-card bg-warn-soft px-3.5 py-2.5 text-[13px] font-semibold text-warn">
                              Budget about {formatINR(Number(rep.estimated_spend_paise))} for what was found.
                            </p>
                          )}
                          <p className="mt-3 text-[11.5px] text-ink2">
                            Inspected by {rep.inspector_name ?? "a MEQIVA inspector"} · report {fmtDate(rep.published_at)}
                          </p>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </Section>

          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(GRADE).map(([k, g]) => (
              <div key={k} className="rounded-card border border-line bg-surface p-4">
                <Badge tone={g.tone}>{g.label}</Badge>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink2">{g.meaning}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <Panel title="Order an inspection" tone="brand">
            <div className="p-5">
              {packages.length === 0 ? (
                <p className="text-[13px] text-ink2">
                  No inspection packages are published yet. They appear here the moment they go live.
                </p>
              ) : (
                <ActionForm action={orderInspection} submitLabel="Place the order" pendingLabel="Placing…" fullWidth>
                  <Field label="Which inspection?" required>
                    <RadioCards
                      name="packageId"
                      defaultValue={String(packages[0]?.id ?? "")}
                      options={packages.map((p) => ({
                        value: String(p.id),
                        label: `${p.name} — ${formatINR(Number(p.price_paise))}`,
                        hint: `${p.checkpoints} checkpoints · about ${Math.round(p.duration_minutes / 60)} hr on site${p.description ? ` · ${p.description}` : ""}`,
                      }))}
                    />
                  </Field>
                  <Field label="Which vehicle?" required hint="Make, model, year and roughly how much it has run.">
                    <Input name="vehicleDescription" required minLength={4} maxLength={200}
                      placeholder="2019 Maruti Baleno Zeta petrol, about 48,000 km" />
                  </Field>
                  <Field label="Registration number" hint="Optional, but it lets us check the record too.">
                    <Input name="registration" maxLength={15} placeholder="HR 26 XX 1234" className="tnum uppercase" />
                  </Field>
                  <Field label="Seller's phone number" hint="We call them to fix a time. We never pass on your number.">
                    <Input name="sellerContact" maxLength={120} placeholder="98XXXXXXXX" />
                  </Field>
                  <Field label="Where is the vehicle?" hint="An address or landmark is enough.">
                    <Input name="inspectAt" maxLength={300} placeholder="Near Huda City Centre metro, Sector 29" />
                  </Field>
                </ActionForm>
              )}
            </div>
          </Panel>

          <Callout tone="neutral" title="The inspector works for you">
            Our inspector is not the seller&apos;s workshop and does not earn anything from the sale going through.
            If the car is bad, the report says the car is bad.
          </Callout>
        </div>
      </div>
    </>
  );
}
