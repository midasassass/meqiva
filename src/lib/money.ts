/**
 * All money in MEQIVA is an integer number of paise (1 INR = 100 paise).
 * Never use floating point for stored or computed currency.
 */
export type Paise = number;

export function toPaise(rupees: string | number): Paise {
  const s = typeof rupees === "number" ? rupees.toFixed(2) : rupees.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) throw new Error(`Invalid rupee amount: ${rupees}`);
  const neg = s.startsWith("-");
  const [whole = "0", frac = ""] = s.replace("-", "").split(".");
  const p = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return neg ? -p : p;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
export function formatINR(paise: Paise): string {
  return inr.format(paise / 100);
}

/** Integer rate in basis points (1800 = 18%). Rounds half away from zero. */
export function bps(amount: Paise, rateBps: number): Paise {
  const raw = (amount * rateBps) / 10000;
  return Math.sign(raw) * Math.round(Math.abs(raw));
}

/** Split a tax-inclusive amount into base + tax. */
export function splitInclusive(total: Paise, rateBps: number): { base: Paise; tax: Paise } {
  const base = Math.round((total * 10000) / (10000 + rateBps));
  return { base, tax: total - base };
}

/** Add tax on top of a tax-exclusive amount. */
export function addTax(base: Paise, rateBps: number): { base: Paise; tax: Paise; total: Paise } {
  const tax = bps(base, rateBps);
  return { base, tax, total: base + tax };
}
