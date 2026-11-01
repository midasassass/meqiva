import { Badge, Empty, Field, PageTitle, Panel, Textarea } from "@/components/ui";
import { ActionButton, ActionForm } from "@/components/action-form";
import { recordDiagnostics, updateJobProgress } from "@/server/garage-ops";
import { fmtKm, fmtRelative } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "My jobs" };

/**
 * The technician screen. Deliberately plain and light — this runs on whatever phone
 * the workshop already has. It never loads costs, margins or anyone's money.
 */
export default async function Tech() {
  const u = await requireUser();
  const sb = await supabaseServer();

  const { data } = await sb.from("job_cards")
    .select("id, complaints, diagnostics, odometer_km, started_at, checked_in_at, custom, vehicles(reg_no, year, vehicle_models(name, vehicle_makes(name)))")
    .eq("technician_id", u.id).is("completed_at", null).order("checked_in_at");

  const jobs = (data ?? []) as unknown as {
    id: string; complaints: string | null; diagnostics: string | null; odometer_km: number | null;
    started_at: string | null; checked_in_at: string | null;
    vehicles: { reg_no: string | null; year: number | null; vehicle_models: { name: string; vehicle_makes: { name: string } } } | null;
  }[];

  return (
    <>
      <PageTitle title="My jobs" sub={jobs.length ? `${jobs.length} assigned to you` : undefined} />

      {jobs.length === 0 ? (
        <Empty title="Nothing assigned" body="When a service advisor puts a job on you, it shows up here." />
      ) : (
        <ul className="grid gap-4">
          {jobs.map((j) => (
            <li key={j.id}>
              <Panel>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {j.vehicles
                          ? `${j.vehicles.vehicle_models.vehicle_makes.name} ${j.vehicles.vehicle_models.name}`
                          : "Vehicle"}
                      </p>
                      <p className="tnum mt-0.5 text-[12.5px] text-ink2">
                        {[j.vehicles?.reg_no, j.vehicles?.year, fmtKm(j.odometer_km)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <Badge tone={j.started_at ? "brand" : "neutral"}>{j.started_at ? "Running" : "Not started"}</Badge>
                  </div>

                  <div className="mt-3 rounded-card bg-surface2 px-3 py-2.5">
                    <p className="text-xs text-ink2">Customer reported</p>
                    <p className="mt-0.5 text-sm leading-relaxed">{j.complaints ?? "Nothing recorded"}</p>
                  </div>

                  <p className="tnum mt-2 text-[11.5px] text-ink2">In the workshop since {fmtRelative(j.checked_in_at)}</p>
                </div>

                <div className="border-t border-line p-4">
                  <ActionForm action={recordDiagnostics} submitLabel="Save findings" variant="outline" size="sm">
                    <input type="hidden" name="jobId" value={j.id} />
                    <Field label="What did you find?" hint="A service advisor turns this into a quotation. You do not price the work.">
                      <Textarea name="diagnostics" rows={3} maxLength={4000} defaultValue={j.diagnostics ?? ""} />
                    </Field>
                  </ActionForm>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-line p-4">
                  {!j.started_at
                    ? <ActionButton action={updateJobProgress} label="Start work" variant="primary" size="lg" hidden={{ jobId: j.id, what: "start" }} />
                    : <ActionButton action={updateJobProgress} label="Mark finished" variant="primary" size="lg" hidden={{ jobId: j.id, what: "complete" }} />}
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-ink2">
        You cannot add chargeable work to a customer&rsquo;s bill from here. Report what you find and a service advisor
        sends the customer a fresh quotation to approve.
      </p>
    </>
  );
}
