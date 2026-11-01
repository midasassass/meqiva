import type { Paise } from "./money";
import type { Verification } from "./compare";

/** Fine-grained vehicle classes. Pricing is held per class, never guessed across them. */
export const VEHICLE_CATEGORIES = ["hatchback", "sedan", "suv", "mpv", "motorcycle", "scooter", "ev"] as const;
export type VehicleCategory = (typeof VEHICLE_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<VehicleCategory, string> = {
  hatchback: "Hatchback", sedan: "Sedan", suv: "SUV", mpv: "MPV",
  motorcycle: "Motorcycle", scooter: "Scooter", ev: "Electric",
};

export interface GarageQuote {
  garageId: string;
  name: string;
  slug: string;
  locality: string | null;
  verification: Verification;
  pickupDrop: boolean;
  accentHex: string;
  covered: number;
  requested: number;
  labourPaise: Paise;
  partsPaise: Paise;
  consumablesPaise: Paise;
  subtotalPaise: Paise;
  taxPaise: Paise;
  totalPaise: Paise;
  estMinutes: number;
  warrantyDays: number;
}

export interface MarketBand {
  lowPaise: Paise;
  medianPaise: Paise;
  highPaise: Paise;
  garages: number;
}

export interface EstimateResult {
  /** Garages that priced every service asked for. These are directly comparable. */
  full: GarageQuote[];
  /** Garages that priced some of it. Shown separately, never ranked against the full ones. */
  partial: GarageQuote[];
  band: MarketBand | null;
  requested: number;
}

/** Splits the raw rows by whether the garage covers everything that was asked for. */
export function splitByCoverage(quotes: GarageQuote[]): { full: GarageQuote[]; partial: GarageQuote[] } {
  const full: GarageQuote[] = [], partial: GarageQuote[] = [];
  for (const q of quotes) (q.requested > 0 && q.covered >= q.requested ? full : partial).push(q);
  return { full, partial };
}

/** Where one quote sits inside the market band, 0 (cheapest) to 1 (dearest). */
export function bandPosition(total: Paise, band: MarketBand | null): number | null {
  if (!band || band.highPaise === band.lowPaise) return null;
  const p = (total - band.lowPaise) / (band.highPaise - band.lowPaise);
  return Math.max(0, Math.min(1, p));
}

export type PriceVerdict = "below" | "typical" | "above";

/** Plain-language read on a price, relative to the market median. */
export function verdict(total: Paise, band: MarketBand | null): PriceVerdict | null {
  if (!band || band.medianPaise <= 0) return null;
  const delta = (total - band.medianPaise) / band.medianPaise;
  if (delta <= -0.06) return "below";
  if (delta >= 0.06) return "above";
  return "typical";
}

export const VERDICT_LABEL: Record<PriceVerdict, string> = {
  below: "Below the usual rate",
  typical: "About the usual rate",
  above: "Above the usual rate",
};

/** How far off the median, in whole percent — signed. */
export const deltaPct = (total: Paise, band: MarketBand | null): number | null =>
  !band || band.medianPaise <= 0 ? null : Math.round(((total - band.medianPaise) / band.medianPaise) * 100);

export const fmtDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
};

/** Maps the coarse label on a service package to the classes it can be priced for. */
export const categoriesFor = (coarse: string | null): VehicleCategory[] =>
  coarse === "motorcycle" ? ["motorcycle", "scooter"] : ["hatchback", "sedan", "suv", "mpv", "ev"];
