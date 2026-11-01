import { Card, Empty, PageTitle } from "@/components/ui";
import { fmtDateTime } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Finished" };

export default async function Done() {
  const u = await requireUser();
  const sb = await supabaseServer();
  const { data } = await sb.from("job_cards")
    .select("id, complaints, completed_at, vehicles(reg_no, vehicle_models(name, vehicle_makes(name)))")
    .eq("technician_id", u.id).not("completed_at", "is", null)
    .order("completed_at", { ascending: false }).limit(40);

  const jobs = (data ?? []) as unknown as {
    id: string; complaints: string | null; completed_at: string | null;
    vehicles: { reg_no: string | null; vehicle_models: { name: string; vehicle_makes: { name: string } } } | null;
  }[];

  return (
    <>
      <PageTitle title="Finished" sub="The last 40 jobs you completed." />
      {jobs.length === 0 ? (
        <Empty title="Nothing finished yet" />
      ) : (
        <ul className="grid gap-2.5">
          {jobs.map((j) => (
            <li key={j.id}>
              <Card className="p-3.5">
                <p className="text-sm font-medium">
                  {j.vehicles ? `${j.vehicles.vehicle_models.vehicle_makes.name} ${j.vehicles.vehicle_models.name}` : "Vehicle"}
                  {j.vehicles?.reg_no && <span className="tnum font-normal text-ink2"> · {j.vehicles.reg_no}</span>}
                </p>
                <p className="tnum mt-0.5 text-[12px] text-ink2">{fmtDateTime(j.completed_at)}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
