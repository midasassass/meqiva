import { ActionForm } from "@/components/action-form";
import { CustomFields } from "@/components/custom-fields";
import { Callout, Field, Input, PageTitle, Panel, Select, Textarea } from "@/components/ui";
import { createJobCard } from "@/server/garage-ops";
import { getFieldDefs } from "@/lib/garage-data";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "New job card" };

export default async function NewJob({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const { sb, garage } = await requireGarageOrRedirect();
  const sp = await searchParams;

  const [defs, techsRes, bookingRes] = await Promise.all([
    getFieldDefs(sb, garage.id, "job_card"),
    sb.from("garage_members").select("user_id, role, profiles(full_name)").eq("garage_id", garage.id),
    sp.booking
      ? sb.from("bookings").select("id, customer_id, vehicle_id, customer_note, origin, vehicles(reg_no, vehicle_models(name, vehicle_makes(name)))").eq("id", sp.booking).eq("garage_id", garage.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const techs = (techsRes.data ?? []) as unknown as { user_id: string; role: string; profiles: { full_name: string | null } | null }[];
  const booking = bookingRes.data as unknown as {
    id: string; customer_id: string | null; vehicle_id: string | null; customer_note: string | null; origin: string;
    vehicles: { reg_no: string | null; vehicle_models: { name: string; vehicle_makes: { name: string } } } | null;
  } | null;

  return (
    <>
      <PageTitle
        title={booking ? "Check in this booking" : "New job card"}
        sub={booking ? "Creating the job card from a MEQIVA booking. Origin is carried across automatically." : "For a walk-in or a customer who called."}
        back={{ href: "/garage/jobs", label: "Job cards" }}
      />

      {booking && (
        <Callout tone="neutral" title="Origin recorded as marketplace">
          Commission applies only to bookings MEQIVA sent you, and only once the job completes. A walk-in opened here
          carries no fee at all.
        </Callout>
      )}

      <div className="mt-5 max-w-2xl">
        <Panel>
          <div className="p-5">
            <ActionForm action={createJobCard} submitLabel="Open job card" pendingLabel="Creating…">
              {booking && <input type="hidden" name="bookingId" value={booking.id} />}
              {booking?.customer_id && <input type="hidden" name="customerId" value={booking.customer_id} />}
              {booking?.vehicle_id && <input type="hidden" name="vehicleId" value={booking.vehicle_id} />}

              {!booking && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Customer name"><Input name="walkInName" maxLength={120} placeholder="Who brought it in" /></Field>
                  <Field label="Phone"><Input name="walkInPhone" type="tel" maxLength={20} inputMode="tel" /></Field>
                </div>
              )}

              <Field label="What did they report?" required hint="In their words. This is what the customer will be shown.">
                <Textarea name="complaints" rows={3} required minLength={3} maxLength={2000}
                  defaultValue={booking?.customer_note ?? ""}
                  placeholder="Rattling from the front right over speed bumps, started last week." />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Odometer (km)"><Input name="odometerKm" type="number" inputMode="numeric" min={0} /></Field>
                <Field label="Assign to">
                  <Select name="technicianId" defaultValue="">
                    <option value="">Unassigned for now</option>
                    {techs.map((t) => (
                      <option key={t.user_id} value={t.user_id}>
                        {t.profiles?.full_name ?? "Team member"}{t.role === "technician" ? "" : ` (${t.role.replace("_", " ")})`}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              <CustomFields defs={defs} />
            </ActionForm>
          </div>
        </Panel>
      </div>
    </>
  );
}
