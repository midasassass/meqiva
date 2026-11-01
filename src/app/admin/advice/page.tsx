import { Scale } from "lucide-react";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Callout, Card, Empty, Field, PageTitle, RadioCards, SegmentedLinks, Stat, Textarea } from "@/components/ui";
import { answerRepairReview } from "@/server/trust";
import { takeRepairReview } from "@/server/trust-admin";
import { REVIEW_STATUS, VERDICT, type ReviewStatus, type ReviewVerdict } from "@/lib/trust";
import { formatINR } from "@/lib/money";
import { fmtDateTime, fmtKm, fmtRelative } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Repair reviews" };

export default async function AdminAdvice({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole("super_admin", "quality_auditor");
  const { status } = await searchParams;
  const sb = await supabaseServer();

  const { data } = await sb.from("repair_reviews")
    .select(`id, question, quoted_total_paise, status, verdict, rationale, responded_at, created_at,
             vehicles(reg_no, odometer_km, last_service_on, vehicle_models(name, category, vehicle_makes(name))),
             profiles!repair_reviews_customer_id_fkey(full_name)`)
    .order("created_at", { ascending: false }).limit(120);

  const all = (data ?? []) as unknown as {
    id: string; question: string; quoted_total_paise: number | null; status: ReviewStatus;
    verdict: ReviewVerdict | null; rationale: string | null; responded_at: string | null; created_at: string;
    vehicles: {
      reg_no: string | null; odometer_km: number | null; last_service_on: string | null;
      vehicle_models: { name: string; category: string; vehicle_makes: { name: string } };
    } | null;
    profiles: { full_name: string | null } | null;
  }[];

  const waiting = all.filter((r) => r.status === "requested");
  const mine = all.filter((r) => r.status === "in_review");
  const answered = all.filter((r) => r.status === "answered");

  const tab = status === "answered" ? "answered" : status === "in_review" ? "in_review" : "requested";
  const shown = tab === "answered" ? answered : tab === "in_review" ? mine : waiting;

  return (
    <>
      <PageTitle
        title="Repair reviews"
        sub="Customers asking whether work they have been quoted for is really needed. Your answer is the product — a careless one costs someone money or safety."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Waiting" value={String(waiting.length)} tone={waiting.length > 0 ? "warn" : undefined} />
        <Stat label="Being looked at" value={String(mine.length)} />
        <Stat label="Answered" value={String(answered.length)} tone="success" />
      </div>

      <SegmentedLinks
        current={`/admin/advice${tab === "requested" ? "" : `?status=${tab}`}`}
        items={[
          { href: "/admin/advice", label: "Waiting", count: waiting.length },
          { href: "/admin/advice?status=in_review", label: "In review", count: mine.length },
          { href: "/admin/advice?status=answered", label: "Answered", count: answered.length },
        ]}
      />

      <div className="mt-6 space-y-4">
        {shown.length === 0 ? (
          <Empty title="Nothing here" body="Requests appear the moment a customer sends one." icon={<Scale className="h-5 w-5" aria-hidden />} />
        ) : (
          shown.map((r, i) => {
            const v = r.vehicles;
            const verdict = r.verdict ? VERDICT[r.verdict] : null;
            return (
              <Card key={r.id} className="rise overflow-hidden" style={{ "--i": i } as React.CSSProperties}>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-semibold">
                      {v ? `${v.vehicle_models.vehicle_makes.name} ${v.vehicle_models.name}` : "No vehicle linked"}
                      {v?.reg_no && <span className="tnum font-normal text-ink2"> · {v.reg_no}</span>}
                    </p>
                    <p className="tnum mt-0.5 text-[12px] text-ink2">
                      {r.profiles?.full_name ?? "Customer"}
                      {v?.odometer_km != null && ` · ${fmtKm(v.odometer_km)}`}
                      {v?.last_service_on && ` · last serviced ${fmtDateTime(v.last_service_on)}`}
                      {` · asked ${fmtRelative(r.created_at)}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge tone={REVIEW_STATUS[r.status].tone}>{REVIEW_STATUS[r.status].label}</Badge>
                    {r.quoted_total_paise != null && (
                      <p className="tnum mt-1.5 text-[13px] font-semibold">{formatINR(Number(r.quoted_total_paise))} quoted</p>
                    )}
                  </div>
                </div>

                <div className="p-5">
                  <p className="rounded-card bg-surface2 px-3.5 py-3 text-[13.5px] leading-relaxed">{r.question}</p>

                  {r.status === "requested" && (
                    <div className="mt-4">
                      <ActionButton action={takeRepairReview} label="Take this one" variant="outline" hidden={{ id: r.id }} />
                    </div>
                  )}

                  {r.status === "in_review" && (
                    <div className="mt-4 border-t border-line pt-4">
                      <ActionForm action={answerRepairReview} submitLabel="Send the answer" pendingLabel="Sending…">
                        <input type="hidden" name="id" value={r.id} />
                        <Field label="Your verdict" required>
                          <RadioCards
                            name="verdict" columns={1}
                            options={(Object.keys(VERDICT) as ReviewVerdict[]).map((k) => ({
                              value: k, label: VERDICT[k].label, hint: VERDICT[k].meaning,
                            }))}
                          />
                        </Field>
                        <Field label="Why" required
                          hint="Written for the customer, not for us. Say what you based it on and what would change your view.">
                          <Textarea name="rationale" rows={5} required minLength={20} maxLength={4000}
                            placeholder="At 62,000 km, suspension link bushes going is normal and the looseness you describe fits it, so that part is worth doing. An engine mount at this age is less usual — ask them to show you the movement with the bonnet open and the engine under load before agreeing to it." />
                        </Field>
                      </ActionForm>
                    </div>
                  )}

                  {verdict && r.rationale && (
                    <div className="mt-4 border-t border-line pt-4">
                      <Badge tone={verdict.tone}>{verdict.label}</Badge>
                      <p className="mt-2.5 text-[13.5px] leading-relaxed">{r.rationale}</p>
                      <p className="mt-2 text-[11.5px] text-ink2">Answered {fmtDateTime(r.responded_at)}</p>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <div className="mt-8">
        <Callout tone="warn" title="Where the limits are">
          You are reading a description, not inspecting a vehicle. Where that is not enough to judge, &ldquo;needs a
          look&rdquo; is the correct answer and saying so protects both the customer and MEQIVA. Never guess towards
          &ldquo;not needed&rdquo; on a safety item — brakes, steering, tyres, suspension — without a reason you would
          defend out loud.
        </Callout>
      </div>
    </>
  );
}
