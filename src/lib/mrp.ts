import type { Paise } from "./money";

export type MrpIssueCode = "MRP_EXCEEDED" | "MRP_MISSING" | "MRP_INCONSISTENT" | "PACK_UNIDENTIFIED";

export interface MrpIssue {
  code: MrpIssueCode;
  message: string;
}

export interface MrpCheckInput {
  /** Is the part a retail-packaged good subject to a declared statutory MRP? */
  mrpApplies: boolean;
  /** Declared MRP per declared pack, tax-inclusive, in paise. */
  mrpPaise?: Paise | null;
  /** Customer selling price per unit actually charged, tax-inclusive. */
  sellingPaise: Paise;
  /** Declared pack quantity (e.g. 1 for a 1L can, 4 for a 4-pack). Required if mrpApplies. */
  packQty?: number | null;
  /** Units sold in this line, expressed in packs. */
  qty: number;
}

/**
 * Deterministic MRP compliance check. MRP is tax-inclusive, so GST must NOT be
 * added on top when this check applies. Discounts below MRP are always allowed.
 * Parts with no statutory MRP are not checked here (use approved-pricing rules).
 */
export function checkMrp(i: MrpCheckInput): MrpIssue[] {
  if (!i.mrpApplies) return [];
  const issues: MrpIssue[] = [];
  if (i.mrpPaise == null) {
    issues.push({ code: "MRP_MISSING", message: "Declared MRP is required for this packaged good." });
    return issues;
  }
  if (i.mrpPaise <= 0 || i.sellingPaise < 0 || i.qty <= 0) {
    issues.push({ code: "MRP_INCONSISTENT", message: "MRP, price or quantity is not valid." });
    return issues;
  }
  if (!i.packQty || i.packQty <= 0) {
    issues.push({ code: "PACK_UNIDENTIFIED", message: "Identify the declared package quantity." });
  }
  if (i.sellingPaise > i.mrpPaise) {
    issues.push({
      code: "MRP_EXCEEDED",
      message: "Selling price exceeds the declared MRP (MRP is tax-inclusive).",
    });
  }
  return issues;
}

export const hasBlockingMrpIssue = (issues: MrpIssue[]) => issues.length > 0;
