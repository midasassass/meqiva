import { Scale } from "lucide-react";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Callout, Card, Empty, Field, Input, PageTitle, Panel, Select, Textarea } from "@/components/ui";
import { requestRepairReview, withdrawRepairReview } from "@/server/trust";
import { REVIEW_STATUS, VERDICT, type ReviewStatus, type ReviewVerdict } from "@/lib/trust";
import { formatINR } from "@/lib/money";
import { fmtDateTime } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Is this repair needed?" };

export default async function Advice() {
  await requireUser();
  const sb = await supabaseServer();

  const [reviewsRes, vehiclesRes] = await Promise.all([
    sb.from("repair_reviews")
      .select("id, question, quoted_total_paise, status, verdict, rationale, responded_at, created_at, vehicles(reg_no, vehicle_models(name, vehicle_makes(name)))")
      .order("created_at", { ascending: false }).limit(30),
    sb.from("vehicles").select("id, reg_no, vehicle_models(name, vehicle_makes(name))").order("created_at", { ascending: false }),
  ]);

  const reviews = (reviewsRes.data ?? []) as unknown as {
    id: string; question: string; quoted_total_paise: number | null; status: ReviewStatus;
    verdict: ReviewVerdict | null; rationale: string | null; responded_at: string | null; created_at: string;
    vehicles: { reg_no: string | null; vehicle_models: { name: string; vehicle_makes: { name: string } } } | null;
  }[];
  const vehicles = (vehiclesRes.data ?? []) as unknown as {
    id: string; reg_no: string | null; vehicle_models: { name: string; vehicle_makes: { name: string } };
  }[];

  return (
    <>
      <PageTitle
        title="Is this repair really needed?"
        sub="A garage has quoted you for something and you are not sure. Send it here and a MEQIVA reviewer gives you an honest view — not the workshop that quoted."
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <div className="space-y-4">
          {reviews.length === 0 ? (
            <Empty
              title="Nothing sent for review yet"
              body="Next time a workshop says something needs doing and you are unsure, paste what they told you into the form and we will look at it."
            />
          ) : (
            reviews.map((r, i) => {
              const v = r.verdict ? VERDICT[r.verdict] : null;
              return (
                <Card key={r.id} className="rise p-5" style={{ "--i": i } as React.CSSProperties}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {r.vehicles
                          ? `${r.vehicles.vehicle_models.vehicle_makes.name} ${r.vehicles.vehicle_models.name}`
                          : "Your question"}
                      </p>
                      <p className="tnum mt-0.5 text-[12px] text-ink2">
                        Sent {fmtDateTime(r.created_at)}
                        {r.quoted_total_paise != null && ` · quoted ${formatINR(Number(r.quoted_total_paise))}`}
                      </p>
                    </div>
                    <Badge tone={REVIEW_STATUS[r.status].tone}>{REVIEW_STATUS[r.status].label}</Badge>
                  </div>

                  <p className="mt-3 rounded-card bg-surface2 px-3.5 py-3 text-[13.5px] leading-relaxed">{r.question}</p>

                  {v && r.rationale && (
                    <div className="mt-4 border-t border-line pt-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={v.tone}>{v.label}</Badge>
                        <span className="text-[12px] text-ink2">{v.meaning}</span>
                      </div>
                      <p className="mt-2.5 text-[13.5px] leading-relaxed">{r.rationale}</p>
                      <p className="tnum mt-2 text-[11.5px] text-ink2">
                        Answered {fmtDateTime(r.responded_at)} by a MEQIVA quality auditor.
                      </p>
                    </div>
                  )}

                  {(r.status === "requested" || r.status === "in_review") && (
                    <div className="mt-4">
                      <ActionButton action={withdrawRepairReview} label="Withdraw" variant="ghost" hidden={{ id: r.id }} />
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>

        <div className="space-y-5">
          <Panel title="Ask about a quote" tone="brand">
            <div className="p-5">
              <ActionForm action={requestRepairReview} submitLabel="Send for review" pendingLabel="Sending…" resetOnSuccess fullWidth>
                <Field label="Which vehicle?" hint="Optional, but it helps us judge.">
                  <Select name="vehicleId" defaultValue="">
                    <option value="">Not listed / another vehicle</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vehicle_models.vehicle_makes.name} {v.vehicle_models.name}{v.reg_no ? ` · ${v.reg_no}` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="What have they told you?" required
                  hint="Copy what the workshop said, word for word if you can. Include the vehicle's age and running.">
                  <Textarea name="question" rows={6} required minLength={10} maxLength={4000}
                    placeholder="2018 Honda City, 62,000 km. They say both front suspension links and the engine mount need replacing, ₹14,500 in total. The car does feel a bit loose over bumps but it drives fine otherwise." />
                </Field>
                <Field label="Amount quoted" hint="In rupees. Optional.">
                  <Input name="quotedTotal" type="number" inputMode="decimal" min={0} step="1" placeholder="14500" />
                </Field>
              </ActionForm>
            </div>
          </Panel>

          <Callout tone="neutral" icon={<Scale className="h-4 w-4" aria-hidden />} title="What this is, and what it is not">
            A MEQIVA reviewer reads what you were told and gives a view on whether the work looks necessary, worth
            doing, or something that can wait. It is an opinion formed from a description — not an inspection, and not
            a guarantee. If the honest answer is that nobody can judge without seeing the vehicle, that is what you
            will be told.
          </Callout>

          <p className="text-[12px] leading-relaxed text-ink2">
            The workshop that quoted you never sees this request or the answer.
          </p>
        </div>
      </div>
    </>
  );
}
