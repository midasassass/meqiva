import { bps, type Paise } from "./money";

export type JobOrigin = "marketplace" | "walk_in" | "fleet";

export type CommissionRule =
  | { type: "fixed"; amountPaise: Paise }
  | { type: "pct_labour"; rateBps: number }
  | { type: "pct_total"; rateBps: number };

export interface CommissionInput {
  origin: JobOrigin;
  labourExTaxPaise: Paise;
  eligibleTotalExTaxPaise: Paise;
  completed: boolean;
  rule: CommissionRule | null;
  /** GST on the platform fee itself (bps); configurable, 0 if not applicable. */
  feeGstBps?: number;
}

export interface CommissionResult {
  feePaise: Paise;
  gstPaise: Paise;
  reason: string;
}

/**
 * Marketplace commission applies ONLY to completed marketplace-originated jobs.
 * Walk-in and fleet jobs never incur it, however the software is used.
 */
export function computeCommission(i: CommissionInput): CommissionResult {
  if (i.origin !== "marketplace") return { feePaise: 0, gstPaise: 0, reason: `No commission on ${i.origin} jobs.` };
  if (!i.completed) return { feePaise: 0, gstPaise: 0, reason: "Commission accrues on completion only." };
  if (!i.rule) return { feePaise: 0, gstPaise: 0, reason: "No commission rule configured." };

  const fee =
    i.rule.type === "fixed"
      ? i.rule.amountPaise
      : i.rule.type === "pct_labour"
        ? bps(i.labourExTaxPaise, i.rule.rateBps)
        : bps(i.eligibleTotalExTaxPaise, i.rule.rateBps);

  return { feePaise: fee, gstPaise: bps(fee, i.feeGstBps ?? 0), reason: "Marketplace-originated completed job." };
}
