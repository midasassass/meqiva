import Link from "next/link";
import { Badge, Card, Empty, Field, Input, PageTitle, Panel, Select } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { saveVehicle } from "@/server/customer";
import { fmtKm, fmtDate } from "@/lib/format";
import { serviceDue } from "@/lib/reminders";
import { istYmd } from "@/lib/availability";
import { requireUser } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Vehicles" };

export default async function Vehicles() {
  await requireUser();
  const sb = await supabaseServer();
  const today = istYmd(new Date());

  const [{ data: vehicles }, { data: models }] = await Promise.all([
    sb.from("vehicles")
      .select("id, year, reg_no, odometer_km, last_service_on, last_service_km, vehicle_models(name, category, vehicle_makes(name))")
      .order("created_at", { ascending: false }),
    sb.from("vehicle_models").select("id, name, category, vehicle_makes(name)").order("name"),
  ]);

  type V = { id: string; year: number | null; reg_no: string | null; odometer_km: number | null; last_service_on: string | null; last_service_km: number | null; vehicle_models: { name: string; category: string; vehicle_makes: { name: string } } };
  const list = (vehicles ?? []) as unknown as V[];
  const modelList = (models ?? []) as unknown as { id: number; name: string; category: string; vehicle_makes: { name: string } }[];

  return (
    <>
      <PageTitle title="Vehicles" sub="Each vehicle keeps its own service history, and prices depend on the exact model." />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <div>
          {list.length === 0 ? (
            <Empty title="No vehicles yet" body="Add one and you will see what each service costs at garages near you." />
          ) : (
            <ul className="grid gap-3">
              {list.map((v) => {
                const due = serviceDue({
                  vehicleId: v.id, category: v.vehicle_models.category, lastServiceOn: v.last_service_on,
                  lastServiceKm: v.last_service_km, odometerKm: v.odometer_km,
                }, today);
                return (
                  <li key={v.id}>
                    <Link href={`/app/vehicles/${v.id}`}>
                      <Card className="p-4 transition-colors hover:bg-surface2/50">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">
                              {v.vehicle_models.vehicle_makes.name} {v.vehicle_models.name}
                              {v.year && <span className="tnum font-normal text-ink2"> {v.year}</span>}
                            </p>
                            <p className="tnum mt-1 text-[12.5px] text-ink2">
                              {[v.reg_no, fmtKm(v.odometer_km), v.last_service_on && `last service ${fmtDate(v.last_service_on)}`]
                                .filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          {due.due && <Badge tone="warn">Service due</Badge>}
                        </div>
                        {due.due && <p className="mt-2 text-[12.5px] text-ink2">{due.reason}</p>}
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Panel title="Add a vehicle" description="Model and year decide which parts and prices apply.">
          <div className="p-4">
            <ActionForm action={saveVehicle} submitLabel="Add vehicle" pendingLabel="Saving…" resetOnSuccess fullWidth>
              <Field label="Make and model" required>
                <Select name="modelId" required>
                  {modelList.map((m) => (
                    <option key={m.id} value={m.id}>{m.vehicle_makes.name} {m.name}</option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Year"><Input name="year" type="number" inputMode="numeric" min={1980} max={2100} placeholder="2018" /></Field>
                <Field label="Odometer"><Input name="odometerKm" type="number" inputMode="numeric" min={0} placeholder="62000" /></Field>
              </div>
              <Field label="Registration number" hint="Optional. Helps the garage identify the vehicle on arrival.">
                <Input name="regNo" autoCapitalize="characters" placeholder="HR26 AB 1234" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Last serviced on"><Input name="lastServiceOn" type="date" /></Field>
                <Field label="Odometer then"><Input name="lastServiceKm" type="number" inputMode="numeric" min={0} /></Field>
              </div>
            </ActionForm>
          </div>
        </Panel>
      </div>
    </>
  );
}
