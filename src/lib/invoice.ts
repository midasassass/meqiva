import type { Paise } from "./money";

/**
 * GST presentation. Intra-state supply splits the tax into CGST and SGST;
 * inter-state is IGST. Rounding keeps the two halves summing exactly to the
 * tax charged, so an invoice never disagrees with itself by a paisa.
 */

export interface GstSplit { cgst: Paise; sgst: Paise; igst: Paise }

export function splitGst(tax: Paise, intraState: boolean): GstSplit {
  if (!intraState) return { cgst: 0, sgst: 0, igst: tax };
  const cgst = Math.floor(tax / 2);
  return { cgst, sgst: tax - cgst, igst: 0 };
}

/** The supply is intra-state when the customer's place of supply matches the garage's state. */
export const isIntraState = (garageStateCode: string, placeOfSupplyCode: string | null | undefined) =>
  !placeOfSupplyCode || garageStateCode === placeOfSupplyCode;

export function invoiceNumber(prefix: string, yy: string, seq: number): string {
  if (!/^[A-Z0-9/-]{1,10}$/.test(prefix)) throw new Error("Invalid invoice prefix");
  return `${prefix}/${yy}/${String(seq).padStart(5, "0")}`;
}

export interface TaxBucket { rateBps: number; taxable: Paise; tax: Paise }

/** Group lines by GST rate — the rate-wise summary a tax invoice must show. */
export function taxSummary(lines: { gstRateBps: number; subtotalPaise: Paise; taxPaise: Paise }[]): TaxBucket[] {
  const map = new Map<number, TaxBucket>();
  for (const l of lines) {
    const b = map.get(l.gstRateBps) ?? { rateBps: l.gstRateBps, taxable: 0, tax: 0 };
    b.taxable += l.subtotalPaise;
    b.tax += l.taxPaise;
    map.set(l.gstRateBps, b);
  }
  return [...map.values()].sort((a, b) => a.rateBps - b.rateBps);
}

export const STATE_CODES: Record<string, string> = {
  "06": "Haryana", "07": "Delhi", "09": "Uttar Pradesh", "08": "Rajasthan",
  "27": "Maharashtra", "29": "Karnataka", "33": "Tamil Nadu", "36": "Telangana",
  "19": "West Bengal", "24": "Gujarat", "32": "Kerala", "03": "Punjab",
};

/** Amount in words, in the lakh/crore grouping and the phrasing Indian tax invoices use. */
export function amountInWords(paise: Paise): string {
  const ones = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  const two = (n: number): string =>
    n < 20 ? ones[n]! : `${tens[Math.floor(n / 10)]!}${n % 10 ? "-" + ones[n % 10]! : ""}`;

  const words = (n: number): string => {
    if (n === 0) return "zero";
    const parts: string[] = [];
    let rest = n;
    for (const [value, name] of [[10000000, "crore"], [100000, "lakh"], [1000, "thousand"], [100, "hundred"]] as const) {
      const q = Math.floor(rest / value);
      if (q > 0) { parts.push(`${words(q)} ${name}`); rest %= value; }
    }
    if (rest > 0) parts.push(two(rest));
    return parts.join(" ");
  };

  const titled = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
  const rupees = Math.floor(Math.abs(paise) / 100);
  const paisa = Math.abs(paise) % 100;
  const sign = paise < 0 ? "Minus " : "";
  const tail = paisa ? ` and ${titled(two(paisa))} Paise` : "";
  return `${sign}Rupees ${titled(words(rupees))}${tail} Only`;
}
