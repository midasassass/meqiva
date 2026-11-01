import { ActionForm } from "@/components/action-form";
import { Callout, Check, Field, Input, Panel, Select } from "@/components/ui";
import { updateBookingRules } from "@/server/garage-settings";
import { getSettings } from "@/lib/garage-data";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Booking rules" };

export default async function BookingRules() {
  const { sb, garage } = await requireGarageOrRedirect();
  const s = await getSettings(sb, garage.id);

  return (
    <div className="space-y-6">
      <Callout tone="neutral" title="These rules decide what a customer can pick">
        MEQIVA never offers a slot you cannot honour. Capacity comes from your bay count
        ({garage.baysCount} {garage.baysCount === 1 ? "bay" : "bays"}), the job duration on each service, and what is
        already booked.
      </Callout>

      <Panel title="Booking rules">
        <div className="p-5">
          <ActionForm action={updateBookingRules} submitLabel="Save rules" pendingLabel="Saving…">
            <Check name="onlineBooking" label="Take bookings online" defaultChecked={s?.online_booking ?? true}
              hint="Switch off and your profile stays visible, but nobody can book a slot." />
            <Check name="autoConfirm" label="Confirm bookings automatically" defaultChecked={s?.auto_confirm ?? false}
              hint="Otherwise each request waits for someone on your team to accept it." />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Minimum notice (minutes)" hint="How soon before a slot someone can still book it.">
                <Input name="minLeadMinutes" type="number" inputMode="numeric" min={0} max={10080} defaultValue={s?.min_lead_minutes ?? 120} />
              </Field>
              <Field label="Book up to (days ahead)">
                <Input name="maxAdvanceDays" type="number" inputMode="numeric" min={1} max={365} defaultValue={s?.max_advance_days ?? 30} />
              </Field>
              <Field label="Slot length" hint="How finely the day is divided.">
                <Select name="slotMinutes" defaultValue={String(s?.slot_minutes ?? 30)}>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">1 hour</option>
                </Select>
              </Field>
              <Field label="Buffer between jobs (minutes)" hint="Time to clean up and move the vehicle out.">
                <Input name="bufferMinutes" type="number" inputMode="numeric" min={0} max={240} defaultValue={s?.buffer_minutes ?? 15} />
              </Field>
              <Field label="Jobs at once per bay" hint="Usually one. Raise it only if your bays genuinely overlap work.">
                <Input name="concurrentJobsPerBay" type="number" inputMode="numeric" min={1} max={5} defaultValue={s?.concurrent_jobs_per_bay ?? 1} />
              </Field>
              <Field label="Deposit (% of estimate)" hint="Taken at booking and adjusted against the final bill. Zero means none.">
                <Input name="depositPct" type="number" inputMode="decimal" min={0} max={100} step="0.5" defaultValue={(s?.deposit_bps ?? 0) / 100} />
              </Field>
              <Field label="Free cancellation window (hours)">
                <Input name="cancellationWindowHours" type="number" inputMode="numeric" min={0} max={168} defaultValue={s?.cancellation_window_hours ?? 6} />
              </Field>
              <Field label="No-show fee (₹)" hint="Disclosed to the customer before they confirm.">
                <Input name="noShowFee" type="number" inputMode="decimal" min={0} step="1" defaultValue={(s?.no_show_fee_paise ?? 0) / 100} />
              </Field>
            </div>

            <div className="border-t border-line pt-4">
              <Check name="pickupEnabled" label="Offer pickup and drop" defaultChecked={s?.pickup_enabled ?? false} />
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Pickup fee (₹)"><Input name="pickupFee" type="number" inputMode="decimal" min={0} step="1" defaultValue={(s?.pickup_fee_paise ?? 0) / 100} /></Field>
                <Field label="Pickup radius (km)"><Input name="pickupRadiusKm" type="number" inputMode="decimal" min={0} max={100} step="0.5" defaultValue={s?.pickup_radius_km ?? 5} /></Field>
              </div>
            </div>
          </ActionForm>
        </div>
      </Panel>
    </div>
  );
}
