/**
 * Which vehicles are due for service. Uses whichever signal is available — elapsed
 * months or distance run — and says which one triggered it, so a reminder can
 * always be explained to the customer.
 */

export interface ServiceInterval { months: number; km: number }

export const DEFAULT_INTERVALS: Record<string, ServiceInterval> = {
  hatchback: { months: 12, km: 10000 },
  sedan: { months: 12, km: 10000 },
  suv: { months: 12, km: 10000 },
  mpv: { months: 12, km: 10000 },
  motorcycle: { months: 6, km: 5000 },
  scooter: { months: 6, km: 4000 },
  ev: { months: 12, km: 15000 },
};

export interface VehicleDueInput {
  vehicleId: string;
  category: string;
  lastServiceOn: string | null;
  lastServiceKm: number | null;
  odometerKm: number | null;
  /** Average km per day, if enough history exists to estimate it. */
  dailyKm?: number | null;
  interval?: ServiceInterval;
}

export interface DueResult {
  vehicleId: string;
  due: boolean;
  dueOn: string | null;
  reason: string;
  basis: "time" | "distance" | "estimate" | "unknown";
  overdueDays: number;
}

const addMonths = (ymd: string, months: number): string => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};

const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

export function serviceDue(v: VehicleDueInput, today: string): DueResult {
  const interval = v.interval ?? DEFAULT_INTERVALS[v.category] ?? { months: 12, km: 10000 };
  const base = { vehicleId: v.vehicleId, overdueDays: 0 };

  // Distance is the stronger signal when we have both readings.
  if (v.odometerKm != null && v.lastServiceKm != null) {
    const run = v.odometerKm - v.lastServiceKm;
    if (run >= interval.km) {
      return { ...base, due: true, dueOn: today, basis: "distance",
        reason: `${run.toLocaleString("en-IN")} km since the last service, against a ${interval.km.toLocaleString("en-IN")} km interval` };
    }
    if (v.dailyKm && v.dailyKm > 0) {
      const daysLeft = Math.ceil((interval.km - run) / v.dailyKm);
      const dueOn = new Date(Date.parse(`${today}T00:00:00Z`) + daysLeft * 86_400_000).toISOString().slice(0, 10);
      if (daysLeft <= 30) {
        return { ...base, due: false, dueOn, basis: "estimate",
          reason: `About ${daysLeft} days to the next ${interval.km.toLocaleString("en-IN")} km service at current usage` };
      }
    }
  }

  if (v.lastServiceOn) {
    const dueOn = addMonths(v.lastServiceOn, interval.months);
    const diff = daysBetween(today, dueOn);
    if (diff >= 0) {
      return { ...base, due: true, dueOn, basis: "time", overdueDays: diff,
        reason: diff === 0 ? `Due today, ${interval.months} months after the last service`
          : `${diff} days past the ${interval.months}-month interval` };
    }
    return { ...base, due: false, dueOn, basis: "time",
      reason: `Next service around ${dueOn}` };
  }

  return { ...base, due: false, dueOn: null, basis: "unknown", reason: "No service history recorded yet" };
}

export const dueVehicles = (list: VehicleDueInput[], today: string) =>
  list.map((v) => serviceDue(v, today)).filter((r) => r.due)
      .sort((a, b) => b.overdueDays - a.overdueDays);
