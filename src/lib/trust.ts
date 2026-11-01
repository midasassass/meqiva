import type { Paise } from "./money";

/* Shared types and small pure helpers for the trust features. */

export type ReviewVerdict = "necessary" | "advisable" | "can_wait" | "not_needed" | "needs_inspection";
export type ReviewStatus = "requested" | "in_review" | "answered" | "withdrawn";
export type WarrantyKind = "labour" | "part" | "platform";

export const VERDICT: Record<ReviewVerdict, { label: string; tone: "success" | "brand" | "warn" | "danger" | "neutral"; meaning: string }> = {
  necessary: { label: "Needed now", tone: "danger", meaning: "Leaving this is likely to cost more later, or is a safety issue." },
  advisable: { label: "Worth doing", tone: "warn", meaning: "Not urgent, but sensible while the vehicle is already in the workshop." },
  can_wait: { label: "Can wait", tone: "brand", meaning: "Keep an eye on it. Book it when something else brings the vehicle in." },
  not_needed: { label: "Not needed", tone: "success", meaning: "On the evidence given, this work does not appear necessary." },
  needs_inspection: { label: "Needs a look", tone: "neutral", meaning: "Nobody can judge this fairly without seeing the vehicle." },
};

export const REVIEW_STATUS: Record<ReviewStatus, { label: string; tone: "neutral" | "warn" | "success" }> = {
  requested: { label: "Waiting for a reviewer", tone: "warn" },
  in_review: { label: "Being looked at", tone: "warn" },
  answered: { label: "Answered", tone: "success" },
  withdrawn: { label: "Withdrawn", tone: "neutral" },
};

export const WARRANTY_KIND: Record<WarrantyKind, string> = {
  labour: "Workmanship",
  part: "Part",
  platform: "MEQIVA-backed",
};

export interface WarrantyLike {
  expires_on: string | null;
  km_limit: number | null;
  odometer_at_start: number | null;
}

export type WarrantyState = "active" | "expiring" | "expired" | "km_exceeded" | "open_ended";

/**
 * A warranty can lapse on either time or distance, whichever comes first. Both are
 * reported, because a customer who has driven 1,400 km in a fortnight is out of cover
 * even though the date says otherwise.
 */
export function warrantyState(w: WarrantyLike, todayIso: string, odometerNow?: number | null): WarrantyState {
  if (w.km_limit != null && w.odometer_at_start != null && odometerNow != null) {
    if (odometerNow - w.odometer_at_start >= w.km_limit) return "km_exceeded";
  }
  if (!w.expires_on) return "open_ended";
  const days = Math.round((Date.parse(`${w.expires_on}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / 86_400_000);
  if (days < 0) return "expired";
  if (days <= 14) return "expiring";
  return "active";
}

export const WARRANTY_STATE: Record<WarrantyState, { label: string; tone: "success" | "warn" | "danger" | "neutral" }> = {
  active: { label: "In cover", tone: "success" },
  expiring: { label: "Ending soon", tone: "warn" },
  expired: { label: "Lapsed", tone: "neutral" },
  km_exceeded: { label: "Distance used up", tone: "neutral" },
  open_ended: { label: "No end date", tone: "neutral" },
};

export function kmRemaining(w: WarrantyLike, odometerNow?: number | null): number | null {
  if (w.km_limit == null || w.odometer_at_start == null || odometerNow == null) return null;
  return Math.max(0, w.km_limit - (odometerNow - w.odometer_at_start));
}

export function daysRemaining(expiresOn: string | null, todayIso: string): number | null {
  if (!expiresOn) return null;
  return Math.round((Date.parse(`${expiresOn}T00:00:00Z`) - Date.parse(`${todayIso}T00:00:00Z`)) / 86_400_000);
}

/* ───────── Cost forecast ───────── */

export interface ForecastRow {
  package_id: number;
  package_name: string;
  due_reason: string;
  due_on: string;
  low_paise: Paise | null;
  median_paise: Paise | null;
  high_paise: Paise | null;
  garages: number;
}

export interface ForecastSummary {
  within12Months: ForecastRow[];
  overdue: ForecastRow[];
  /** Sum of medians for everything due inside a year, where a price is actually known. */
  twelveMonthPaise: Paise;
  pricedCount: number;
  unpricedCount: number;
}

export function summariseForecast(rows: ForecastRow[], todayIso: string): ForecastSummary {
  const horizon = Date.parse(`${todayIso}T00:00:00Z`) + 365 * 86_400_000;
  const overdue = rows.filter((r) => r.due_reason.startsWith("Overdue"));
  const within12Months = rows.filter((r) => Date.parse(`${r.due_on}T00:00:00Z`) <= horizon);
  const priced = within12Months.filter((r) => r.median_paise != null && r.garages > 0);
  return {
    overdue,
    within12Months,
    twelveMonthPaise: priced.reduce((a, r) => a + Number(r.median_paise), 0),
    pricedCount: priced.length,
    unpricedCount: within12Months.length - priced.length,
  };
}

/* ───────── Assistance ───────── */

export const ASSISTANCE_KIND: Record<string, string> = {
  towing: "Towing and recovery",
  battery: "Battery and jump start",
  tyre: "Puncture and tyre",
  fuel: "Fuel delivery",
  lockout: "Locked out",
  accident: "After an accident",
  ev_charge: "EV charging and recovery",
};

/* ───────── Inspection grades ───────── */

export const GRADE: Record<string, { label: string; tone: "success" | "brand" | "warn" | "danger"; meaning: string }> = {
  A: { label: "Grade A", tone: "success", meaning: "Nothing material found. Normal wear for the age and distance." },
  B: { label: "Grade B", tone: "brand", meaning: "Sound, with minor work to budget for in the next few months." },
  C: { label: "Grade C", tone: "warn", meaning: "Usable, but needs real money spent soon. Negotiate on the findings." },
  D: { label: "Grade D", tone: "danger", meaning: "Significant faults. Walk away unless the price reflects them." },
};
