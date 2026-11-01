"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Button, Callout, Check, Field, Select, Textarea, cx } from "@/components/ui";
import { createBooking, type ActionState } from "@/server/booking";
import { formatINR } from "@/lib/money";
import { fmtTime } from "@/lib/format";

export function BookingForm({
  garageId, serviceId, durationMinutes, slots, vehicles, signedIn, pickupEnabled, pickupFeePaise, nextUrl,
}: {
  garageId: string; serviceId: string; durationMinutes: number;
  slots: { iso: string; free: number }[];
  vehicles: { id: string; label: string }[];
  signedIn: boolean; pickupEnabled: boolean; pickupFeePaise: number; nextUrl: string;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createBooking, {});
  const [slot, setSlot] = useState(slots[0]?.iso ?? "");

  if (!signedIn) {
    return (
      <div className="border-t border-line p-4">
        <Callout tone="neutral" title="Sign in to hold a slot">
          Your bookings, approvals and service history live in your account, so you can check later what was agreed.
        </Callout>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/login?next=${encodeURIComponent(nextUrl)}`}
            className="inline-flex h-11 items-center rounded-card bg-brand px-5 text-sm font-medium text-brand-fg hover:bg-brand-hover">
            Sign in
          </Link>
          <Link href={`/signup?next=${encodeURIComponent(nextUrl)}`}
            className="inline-flex h-11 items-center rounded-card border border-line-strong px-5 text-sm font-medium hover:bg-surface2">
            Create an account
          </Link>
        </div>
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="border-t border-line p-4">
        <Callout tone="warn" title="Add your vehicle first">
          Prices and service intervals depend on the exact model, so add it once and it is saved for next time.
        </Callout>
        <Link href="/app/vehicles"
          className="mt-3 inline-flex h-11 items-center rounded-card bg-brand px-5 text-sm font-medium text-brand-fg hover:bg-brand-hover">
          Add a vehicle
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4 border-t border-line p-4">
      <input type="hidden" name="garageId" value={garageId} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="durationMinutes" value={durationMinutes} />
      <input type="hidden" name="slotStart" value={slot} />

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium">Pick a time</legend>
        <div className="flex flex-wrap gap-1.5">
          {slots.map((s) => (
            <button key={s.iso} type="button" onClick={() => setSlot(s.iso)}
              aria-pressed={slot === s.iso}
              className={cx("tnum rounded-card border px-3 py-2 text-[13px] transition-colors",
                slot === s.iso ? "border-brand bg-brand-soft font-medium text-brand" : "border-line hover:bg-surface2")}>
              {fmtTime(s.iso)}
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="Which vehicle?" required>
        <Select name="vehicleId" required>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </Select>
      </Field>

      <Field label="Anything the garage should know?" hint="Noises, warning lights, when it started. Optional.">
        <Textarea name="note" rows={3} maxLength={1000} placeholder="Rattling from the front right over speed bumps, started last week." />
      </Field>

      {pickupEnabled && (
        <Check name="pickup" label="Collect the vehicle from me"
          hint={pickupFeePaise > 0 ? `${formatINR(pickupFeePaise)} added to the bill` : "No extra charge"} />
      )}

      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}

      <Button type="submit" size="lg" disabled={pending || !slot} className="w-full">
        {pending ? "Holding the slot…" : "Request this booking"}
      </Button>
      <p className="text-center text-xs text-ink2">
        The garage confirms before anything is charged. You can cancel free of charge within the stated window.
      </p>
    </form>
  );
}
