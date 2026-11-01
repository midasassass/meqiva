import { ActionButton, ActionForm } from "@/components/action-form";
import { Field, Input, Panel } from "@/components/ui";
import { addHoliday, removeHoliday, saveHours } from "@/server/garage-settings";
import { getHours } from "@/lib/garage-data";
import { fmtDate } from "@/lib/format";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Opening hours" };

const DAYS = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"],
  ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
] as const;

export default async function Hours() {
  const { sb, garage } = await requireGarageOrRedirect();
  const [hours, holidaysRes] = await Promise.all([
    getHours(sb, garage.id),
    sb.from("garage_holidays").select("id, on_date, reason").eq("garage_id", garage.id).order("on_date"),
  ]);
  const byDay = new Map(hours.map((h) => [h.day, h]));
  const holidays = holidaysRes.data ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
      <Panel title="Weekly hours" description="Bookable slots are generated from these, your bay count and how long each job takes.">
        <div className="p-5">
          <ActionForm action={saveHours} submitLabel="Save hours" pendingLabel="Saving…">
            <div className="space-y-2">
              {DAYS.map(([day, label]) => {
                const h = byDay.get(day);
                return (
                  <div key={day} className="grid grid-cols-[6.5rem_1fr_1fr_auto] items-center gap-2 border-b border-line pb-2 last:border-0">
                    <span className="text-[13px] font-medium">{label}</span>
                    <Input type="time" name={`opens.${day}`} defaultValue={h?.opens ?? "09:30"} aria-label={`${label} opening time`} />
                    <Input type="time" name={`closes.${day}`} defaultValue={h?.closes ?? "19:00"} aria-label={`${label} closing time`} />
                    <label className="flex items-center gap-1.5 text-[12.5px] text-ink2">
                      <input type="checkbox" name={`closed.${day}`} defaultChecked={!!h?.closed} className="h-4 w-4 accent-[var(--brand)]" />
                      Closed
                    </label>
                  </div>
                );
              })}
            </div>
          </ActionForm>
        </div>
      </Panel>

      <div className="space-y-6">
        <Panel title="Closed dates" description="Festivals, maintenance days, anything else. No slots are offered on these.">
          <div className="p-4">
            <ActionForm action={addHoliday} submitLabel="Mark as closed" variant="outline" resetOnSuccess fullWidth>
              <Field label="Date" required><Input name="onDate" type="date" required /></Field>
              <Field label="Reason" hint="Only you see this."><Input name="reason" maxLength={120} placeholder="Diwali" /></Field>
            </ActionForm>
          </div>
          {holidays.length === 0 ? (
            <div className="border-t border-line p-4">
              <p className="text-[13px] text-ink2">No closed dates set.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {holidays.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div>
                    <p className="tnum text-[13px] font-medium">{fmtDate(h.on_date)}</p>
                    {h.reason && <p className="text-xs text-ink2">{h.reason}</p>}
                  </div>
                  <ActionButton action={removeHoliday} label="Remove" variant="ghost" hidden={{ id: String(h.id) }} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <p className="text-xs text-ink2">
          Times are in India Standard Time. A customer never sees a slot outside these hours, on a closed date, or when
          every bay is already taken.
        </p>
      </div>
    </div>
  );
}
