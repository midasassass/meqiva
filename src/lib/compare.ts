/**
 * Like-for-like comparison. A cheaper quote that leaves out required work is not
 * comparable to one that includes it, so offers are grouped by scope before price.
 * This is the rule that stops the marketplace becoming a race to the bottom.
 */

import type { Paise } from "./money";

export type PriceSource = "manufacturer_indicative" | "authorized_centre_confirmed" | "independent_garage_confirmed";
export type Verification = "none" | "listed" | "verified" | "quality_assured";

export interface Offer {
  garageId: string;
  garageName: string;
  slug: string;
  locality: string | null;
  verification: Verification;
  rating: number | null;
  reviewCount: number;
  distanceKm: number | null;
  totalPaise: Paise;
  labourPaise: Paise;
  partsPaise: Paise;
  consumablesPaise: Paise;
  taxPaise: Paise;
  estMinutes: number;
  warrantyDays: number;
  pickupDrop: boolean;
  includedItems: string[];
  priceSource: PriceSource;
  sourceEffectiveOn?: string | null;
  availableFrom?: Date | null;
  sponsored?: boolean;
}

export type Scope = "full" | "limited";

export interface RankedOffer extends Offer {
  scope: Scope;
  missingItems: string[];
  extraItems: string[];
  /** Internal ordering score. Never shown as a rating. */
  score: number;
}

export interface CompareResult {
  comparable: RankedOffer[];
  limited: RankedOffer[];
  packageName: string;
  requiredItems: string[];
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

const VERIFICATION_WEIGHT: Record<Verification, number> = {
  none: 0, listed: 0.25, verified: 0.65, quality_assured: 1,
};

export interface CompareOptions {
  /** 0–1. Higher favours cheaper offers. The remaining weight goes to trust signals. */
  priceWeight?: number;
  maxResults?: number;
}

/**
 * Price matters most, but not so much that a garage nobody has inspected outranks an
 * audited one over a few hundred rupees. Weights sum to 1.
 */
const W = { trust: 0.25, rating: 0.15, distance: 0.1, confirmed: 0.05 };
const DEFAULT_PRICE_WEIGHT = 1 - (W.trust + W.rating + W.distance + W.confirmed);

export function compareOffers(
  offers: Offer[],
  pkg: { name: string; requiredItems: string[] },
  opts: CompareOptions = {},
): CompareResult {
  const required = pkg.requiredItems.map(norm);
  const priceWeight = opts.priceWeight ?? DEFAULT_PRICE_WEIGHT;

  const ranked: RankedOffer[] = offers.map((o) => {
    const have = new Set(o.includedItems.map(norm));
    const missing = pkg.requiredItems.filter((r) => !have.has(norm(r)));
    const extra = o.includedItems.filter((x) => !required.includes(norm(x)));
    return { ...o, scope: missing.length ? "limited" : "full", missingItems: missing, extraItems: extra, score: 0 };
  });

  const group = (list: RankedOffer[]) => {
    if (!list.length) return list;
    const min = Math.min(...list.map((o) => o.totalPaise)) || 1;
    const scored = list.map((o) => {
      // Price score is the ratio to the cheapest, not a position within the spread.
      // Normalising against the spread would make a 2% gap in a two-garage list look
      // as decisive as a 2x gap, which is how a cheap unverified quote wins by accident.
      const cheapness = o.totalPaise > 0 ? Math.min(1, min / o.totalPaise) : 1;
      const trust = VERIFICATION_WEIGHT[o.verification];
      const rating = o.rating != null && o.reviewCount >= 3 ? (o.rating - 1) / 4 : 0.5;
      const near = o.distanceKm == null ? 0.5 : Math.max(0, 1 - o.distanceKm / 15);
      const confirmed = o.priceSource === "manufacturer_indicative" ? 0 : 1;
      return {
        ...o,
        score: Math.round(
          (priceWeight * cheapness + W.trust * trust + W.rating * rating + W.distance * near + W.confirmed * confirmed) * 1000,
        ) / 1000,
      };
    });
    // Sponsored placement is labelled in the UI and never alters the score or verification.
    return scored.sort((a, b) => b.score - a.score || a.totalPaise - b.totalPaise);
  };

  const comparable = group(ranked.filter((o) => o.scope === "full"));
  const limited = group(ranked.filter((o) => o.scope === "limited"));
  const cap = opts.maxResults ?? 12;
  return { comparable: comparable.slice(0, cap), limited: limited.slice(0, cap), packageName: pkg.name, requiredItems: pkg.requiredItems };
}

/** Spread across comparable offers only — a limited-scope price is not part of the range. */
export function priceBand(r: CompareResult): { low: Paise; high: Paise; median: Paise } | null {
  if (!r.comparable.length) return null;
  const sorted = r.comparable.map((o) => o.totalPaise).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  return { low: sorted[0]!, high: sorted[sorted.length - 1]!, median };
}

export const SOURCE_LABEL: Record<PriceSource, string> = {
  manufacturer_indicative: "Manufacturer guide price",
  authorized_centre_confirmed: "Authorised centre quote",
  independent_garage_confirmed: "Garage quote",
};
