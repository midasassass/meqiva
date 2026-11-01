import { addTax, splitInclusive, type Paise } from "./money";
import { checkMrp, type MrpIssue } from "./mrp";

export type LineKind = "part" | "labour" | "consumable" | "other" | "inspection";

export interface QuoteLine {
  id: string;
  kind: LineKind;
  description: string;
  qty: number;
  /** Customer unit price. Tax-inclusive when `mrpApplies`, otherwise tax-exclusive. */
  unitPricePaise: Paise;
  /** Garage direct cost per unit (parts purchase cost, technician cost, etc.). */
  unitCostPaise: Paise;
  gstRateBps: number;
  discountPaise?: Paise;
  mrpApplies?: boolean;
  mrpPaise?: Paise | null;
  packQty?: number | null;
}

export interface QuoteWarning {
  lineId?: string;
  code: string;
  message: string;
  blocking: boolean;
}

export interface QuoteTotals {
  subtotalExTax: Paise;
  tax: Paise;
  customerTotal: Paise;
  partsCost: Paise;
  labourCost: Paise;
  otherDirectCost: Paise;
  /** Revenue ex-tax minus direct costs. NOT net profit: excludes overheads. */
  contributionPaise: Paise;
  contributionMarginPct: number;
  marketplaceFeePaise: Paise;
  netContributionPaise: Paise;
}

export interface QuoteResult {
  totals: QuoteTotals;
  warnings: QuoteWarning[];
  mrpIssues: Record<string, MrpIssue[]>;
  canIssue: boolean;
}

export interface QuoteOptions {
  marketplaceFeePaise?: Paise;
  lowMarginPct?: number;
  requiredKinds?: LineKind[];
}

export function computeQuote(lines: QuoteLine[], opts: QuoteOptions = {}): QuoteResult {
  let subtotal = 0, tax = 0, partsCost = 0, labourCost = 0, otherCost = 0;
  const warnings: QuoteWarning[] = [];
  const mrpIssues: Record<string, MrpIssue[]> = {};
  const seen = new Set<string>();

  for (const l of lines) {
    const gross = l.unitPricePaise * l.qty - (l.discountPaise ?? 0);
    if (gross < 0) {
      warnings.push({ lineId: l.id, code: "NEGATIVE_LINE", message: "Discount exceeds line value.", blocking: true });
    }
    const inclusive = !!l.mrpApplies;
    if (inclusive) {
      const s = splitInclusive(gross, l.gstRateBps);
      subtotal += s.base;
      tax += s.tax;
    } else {
      const t = addTax(gross, l.gstRateBps);
      subtotal += t.base;
      tax += t.tax;
    }

    const cost = l.unitCostPaise * l.qty;
    if (l.kind === "part") partsCost += cost;
    else if (l.kind === "labour") labourCost += cost;
    else otherCost += cost;

    const issues = checkMrp({
      mrpApplies: !!l.mrpApplies,
      mrpPaise: l.mrpPaise,
      packQty: l.packQty,
      // Compare per-pack selling price (after any discount) against per-pack MRP.
      sellingPaise: l.qty > 0 ? Math.round(gross / l.qty) : 0,
      qty: l.qty,
    });
    if (issues.length) {
      mrpIssues[l.id] = issues;
      for (const i of issues) warnings.push({ lineId: l.id, code: i.code, message: i.message, blocking: true });
    }

    const key = `${l.kind}|${l.description.trim().toLowerCase()}`;
    if (seen.has(key)) {
      warnings.push({ lineId: l.id, code: "DUPLICATE_LINE", message: `Duplicate line: ${l.description}`, blocking: false });
    }
    seen.add(key);
  }

  for (const k of opts.requiredKinds ?? []) {
    if (!lines.some((l) => l.kind === k)) {
      warnings.push({ code: "MISSING_REQUIRED", message: `Missing required ${k} line.`, blocking: false });
    }
  }

  const directCost = partsCost + labourCost + otherCost;
  const contribution = subtotal - directCost;
  const marginPct = subtotal > 0 ? Math.round((contribution / subtotal) * 10000) / 100 : 0;
  const fee = opts.marketplaceFeePaise ?? 0;

  if (subtotal > 0 && marginPct < (opts.lowMarginPct ?? 10)) {
    warnings.push({ code: "LOW_CONTRIBUTION", message: `Contribution margin is only ${marginPct}%.`, blocking: false });
  }

  return {
    totals: {
      subtotalExTax: subtotal,
      tax,
      customerTotal: subtotal + tax,
      partsCost,
      labourCost,
      otherDirectCost: otherCost,
      contributionPaise: contribution,
      contributionMarginPct: marginPct,
      marketplaceFeePaise: fee,
      netContributionPaise: contribution - fee,
    },
    warnings,
    mrpIssues,
    canIssue: !warnings.some((w) => w.blocking),
  };
}
