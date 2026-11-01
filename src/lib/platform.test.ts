import { describe, expect, it } from "vitest";
import { ACCENT_PRESETS, contrastRatio, luminance, MIN_CONTRAST, parseHex, resolveTheme, themeVars } from "./theme";
import { resolveFeatures } from "./features";
import { DEFAULT_HOURS, istDayOfWeek, istYmd, nextAvailableDays, slotsForDay, type SlotQuery } from "./availability";
import { compareOffers, priceBand, type Offer } from "./compare";
import { parseCustom, schemaFor, type FieldDef } from "./fields";
import { amountInWords, invoiceNumber, isIntraState, splitGst, taxSummary } from "./invoice";
import { buildInsights, emptySnapshot } from "./insights";
import { serviceDue, dueVehicles } from "./reminders";
import { fmtPhone, initials, sentence } from "./format";
import { bandPosition, categoriesFor, deltaPct, fmtDuration, splitByCoverage, verdict, type GarageQuote } from "./estimate";

describe("per-garage theming", () => {
  it("picks a readable foreground for any accent", () => {
    for (const p of ACCENT_PRESETS) {
      const t = resolveTheme(p.hex);
      expect(contrastRatio(t.accent, t.accentFg)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("keeps a pale accent readable by using dark text", () => {
    const t = resolveTheme("#FFE27A");
    expect(t.accentFg).toBe("#15112b");
    expect(contrastRatio(t.accent, t.accentFg)).toBeGreaterThan(4.5);
  });
  it("nudges an unreadable custom colour until it clears AA, keeping the hue", () => {
    // Mid-tone colours fail against both white and dark text; the accent has to move.
    for (const hex of ["#8B5CF6", "#0B7FD4", "#00A3FF", "#FF4D8D", "#7A7A7A"]) {
      const t = resolveTheme(hex);
      expect(contrastRatio(t.accent, t.accentFg)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
    // Hue survives: a violet stays violet rather than collapsing to grey or black.
    const v = resolveTheme("#8B5CF6");
    const [r, g, b] = parseHex(v.accent)!;
    expect(b).toBeGreaterThan(r);
    expect(r).toBeGreaterThan(g);
  });
  it("leaves a colour alone when it already passes", () => {
    expect(resolveTheme("#5B35F0").accent).toBe("#5b35f0");
    expect(resolveTheme("#1F2544").accent).toBe("#1f2544");
  });
  it("falls back to the MEQIVA petrol on bad input", () => {
    expect(resolveTheme("not-a-colour").accent).toBe("#5b35f0");
    expect(resolveTheme(null).accent).toBe("#5b35f0");
    expect(resolveTheme("#GGGGGG").accent).toBe("#5b35f0");
  });
  it("computes luminance and exposes CSS variables", () => {
    expect(luminance("#ffffff")).toBeCloseTo(1, 3);
    expect(luminance("#000000")).toBeCloseTo(0, 3);
    expect(themeVars(resolveTheme("#5B35F0"))["--brand"]).toBe("#5b35f0");
  });
});

describe("feature resolution", () => {
  const platform = { camera_module: false, whatsapp: true, ai_insights: false };
  it("needs platform, plan and garage to all allow a feature", () => {
    const f = resolveFeatures({ platform, plan: { inventory: true, camera: true }, garage: {}, subscriptionActive: true });
    expect(f.inventory).toBe(true);
    expect(f.camera).toBe(false); // platform kill switch wins over the plan
  });
  it("lets a garage switch off something its plan allows", () => {
    expect(resolveFeatures({ platform, plan: { inventory: true }, garage: { inventory: false }, subscriptionActive: true }).inventory).toBe(false);
  });
  it("never lets a garage switch on what the plan excludes", () => {
    expect(resolveFeatures({ platform, plan: {}, garage: { fleet: true }, subscriptionActive: true }).fleet).toBe(false);
  });
  it("keeps the baseline working when a subscription lapses", () => {
    const f = resolveFeatures({ platform, plan: { inventory: true, crm: true }, subscriptionActive: false });
    expect(f.online_booking).toBe(true);
    expect(f.custom_fields).toBe(true);
    expect(f.inventory).toBe(false);
  });
});

const MONDAY_0930_IST = new Date("2026-11-02T04:00:00Z");

const baseQuery = (over: Partial<SlotQuery> = {}): SlotQuery => ({
  ymd: "2026-11-02",
  durationMinutes: 90,
  hours: DEFAULT_HOURS,
  holidays: [],
  busy: [],
  rules: { slotMinutes: 30, bufferMinutes: 15, minLeadMinutes: 120, maxAdvanceDays: 30, bays: 2, concurrentPerBay: 1, onlineBooking: true },
  now: MONDAY_0930_IST,
  ...over,
});

describe("slot availability", () => {
  it("reads IST calendar days correctly", () => {
    expect(istYmd(new Date("2026-11-01T19:00:00Z"))).toBe("2026-11-02"); // 00:30 IST next day
    expect(istDayOfWeek("2026-11-02")).toBe("mon");
    expect(istDayOfWeek("2026-11-01")).toBe("sun");
  });
  it("respects opening hours, notice period and service duration", () => {
    const s = slotsForDay(baseQuery());
    expect(s).toHaveLength(13);
    expect(s[0]!.start.toISOString()).toBe("2026-11-02T06:00:00.000Z");  // 11:30 IST = 09:30 + 2h notice
    expect(s.at(-1)!.start.toISOString()).toBe("2026-11-02T12:00:00.000Z"); // 17:30 IST, ends 19:00
  });
  it("offers nothing on a closed day or a holiday", () => {
    expect(slotsForDay(baseQuery({ ymd: "2026-11-01" }))).toEqual([]);           // Sunday, closed
    expect(slotsForDay(baseQuery({ holidays: ["2026-11-02"] }))).toEqual([]);
  });
  it("counts a partly booked bay as partly free, and a full workshop as unavailable", () => {
    const one = slotsForDay(baseQuery({ busy: [{ start: new Date("2026-11-02T06:30:00Z"), end: new Date("2026-11-02T08:00:00Z") }] }));
    expect(one.find((s) => s.start.toISOString() === "2026-11-02T06:00:00.000Z")?.free).toBe(1);

    const full = slotsForDay(baseQuery({ busy: [
      { start: new Date("2026-11-02T06:00:00Z"), end: new Date("2026-11-02T08:00:00Z") },
      { start: new Date("2026-11-02T06:00:00Z"), end: new Date("2026-11-02T08:00:00Z") },
    ] }));
    expect(full.some((s) => s.start.toISOString() === "2026-11-02T06:00:00.000Z")).toBe(false);
  });
  it("accounts for the buffer between jobs", () => {
    // A job ending 11:45 IST blocks the 11:30 slot only because of the 15 minute buffer.
    const busy = [{ start: new Date("2026-11-02T07:30:00Z"), end: new Date("2026-11-02T07:40:00Z") }];
    const withBuffer = slotsForDay(baseQuery({ busy: [...busy, ...busy], rules: { ...baseQuery().rules, bufferMinutes: 60 } }));
    const without = slotsForDay(baseQuery({ busy: [...busy, ...busy], rules: { ...baseQuery().rules, bufferMinutes: 0 } }));
    expect(withBuffer.length).toBeLessThan(without.length);
  });
  it("refuses bookings beyond the advance window and when online booking is off", () => {
    expect(slotsForDay(baseQuery({ ymd: "2027-06-01" }))).toEqual([]);
    expect(slotsForDay(baseQuery({ rules: { ...baseQuery().rules, onlineBooking: false } }))).toEqual([]);
  });
  it("skips closed days when listing the next available ones", () => {
    const days = nextAvailableDays({ ...baseQuery(), ymd: undefined } as unknown as Omit<SlotQuery, "ymd">, 7);
    expect(days.map((d) => d.ymd)).not.toContain("2026-11-08"); // Sunday
    expect(days[0]!.ymd).toBe("2026-11-02");
  });
});

const offer = (over: Partial<Offer>): Offer => ({
  garageId: "g", garageName: "G", slug: "g", locality: "Sector 29", verification: "verified",
  rating: 4.4, reviewCount: 20, distanceKm: 3, totalPaise: 300000, labourPaise: 80000, partsPaise: 180000,
  consumablesPaise: 10000, taxPaise: 30000, estMinutes: 90, warrantyDays: 30, pickupDrop: false,
  includedItems: ["Engine oil", "Oil filter", "Labour", "Multi-point inspection"],
  priceSource: "independent_garage_confirmed", ...over,
});

const PKG = { name: "Basic periodic service", requiredItems: ["Engine oil", "Oil filter", "Labour", "Multi-point inspection"] };

describe("like-for-like comparison", () => {
  it("separates a cheaper, narrower quote from the comparable ones", () => {
    const r = compareOffers([
      offer({ garageId: "full", totalPaise: 300000 }),
      offer({ garageId: "cheap", totalPaise: 190000, includedItems: ["Engine oil", "Labour"] }),
    ], PKG);
    expect(r.comparable.map((o) => o.garageId)).toEqual(["full"]);
    expect(r.limited[0]!.garageId).toBe("cheap");
    expect(r.limited[0]!.missingItems).toEqual(["Oil filter", "Multi-point inspection"]);
  });
  it("ignores case and spacing when matching scope", () => {
    const r = compareOffers([offer({ includedItems: ["engine  oil", "OIL FILTER", "labour", "Multi-point Inspection"] })], PKG);
    expect(r.comparable).toHaveLength(1);
    expect(r.comparable[0]!.scope).toBe("full");
  });
  it("ranks a cheaper comparable offer above a dearer one, all else equal", () => {
    const r = compareOffers([
      offer({ garageId: "dear", totalPaise: 420000 }),
      offer({ garageId: "keen", totalPaise: 260000 }),
    ], PKG);
    expect(r.comparable[0]!.garageId).toBe("keen");
  });
  it("prefers the better-verified garage when a price gap is trivial", () => {
    const r = compareOffers([
      offer({ garageId: "listed", verification: "listed", totalPaise: 299000 }),
      offer({ garageId: "assured", verification: "quality_assured", totalPaise: 300000 }),
    ], PKG);
    expect(r.comparable[0]!.garageId).toBe("assured");
  });
  it("does not let an uninspected garage outrank an audited one over a small saving", () => {
    const r = compareOffers([
      offer({ garageId: "listed", verification: "listed", totalPaise: 268000, rating: 4.1, reviewCount: 6, distanceKm: 8.4 }),
      offer({ garageId: "assured", verification: "quality_assured", totalPaise: 289500, rating: 4.4, reviewCount: 22, distanceKm: 3.2 }),
    ], PKG);
    expect(r.comparable[0]!.garageId).toBe("assured");
  });
  it("still puts a clearly cheaper comparable offer first", () => {
    const r = compareOffers([
      offer({ garageId: "listed", verification: "listed", totalPaise: 180000 }),
      offer({ garageId: "assured", verification: "quality_assured", totalPaise: 420000 }),
    ], PKG);
    expect(r.comparable[0]!.garageId).toBe("listed");
  });
  it("builds the price band from comparable offers only", () => {
    const r = compareOffers([
      offer({ garageId: "a", totalPaise: 250000 }),
      offer({ garageId: "b", totalPaise: 300000 }),
      offer({ garageId: "c", totalPaise: 350000 }),
      offer({ garageId: "d", totalPaise: 90000, includedItems: ["Labour"] }),
    ], PKG);
    expect(priceBand(r)).toEqual({ low: 250000, high: 350000, median: 300000 });
  });
  it("returns no band when nothing is comparable", () => {
    expect(priceBand(compareOffers([offer({ includedItems: [] })], PKG))).toBeNull();
  });
});

const defs: FieldDef[] = [
  { id: "1", entity: "job_card", key: "bay_note", label: "Bay note", type: "text", options: [], required: true, showToCustomer: false, sort: 0 },
  { id: "2", entity: "job_card", key: "fuel_level", label: "Fuel level", type: "select", options: ["Empty", "Quarter", "Half", "Full"], required: false, showToCustomer: true, sort: 1 },
  { id: "3", entity: "job_card", key: "extras", label: "Extras found", type: "multiselect", options: ["Wiper", "Horn", "Bulb"], required: false, showToCustomer: false, sort: 2 },
  { id: "4", entity: "job_card", key: "wash", label: "Wash included", type: "boolean", options: [], required: false, showToCustomer: true, sort: 3 },
];

describe("custom job card fields", () => {
  it("accepts a valid submission and coerces types", () => {
    const fd = new FormData();
    fd.set("custom.bay_note", "Bay 2, keys at reception");
    fd.set("custom.fuel_level", "Half");
    fd.append("custom.extras", "Wiper");
    fd.append("custom.extras", "Bulb");
    fd.set("custom.wash", "on");
    const r = parseCustom(fd, defs);
    expect(r.ok).toBe(true);
    expect(r.values).toMatchObject({ bay_note: "Bay 2, keys at reception", fuel_level: "Half", extras: ["Wiper", "Bulb"], wash: true });
  });
  it("names the missing required field", () => {
    const r = parseCustom(new FormData(), defs);
    expect(r.ok).toBe(false);
    expect(r.errors["bay_note"]).toBe("Bay note is required");
  });
  it("rejects a value outside the configured options", () => {
    const fd = new FormData();
    fd.set("custom.bay_note", "ok");
    fd.set("custom.fuel_level", "Brimming");
    expect(parseCustom(fd, defs).ok).toBe(false);
  });
  it("builds a schema that ignores unconfigured keys", () => {
    expect(schemaFor(defs).safeParse({ bay_note: "x", nonsense: 1 }).success).toBe(true);
  });
});

describe("GST and invoicing", () => {
  it("splits intra-state tax into halves that still sum exactly", () => {
    const s = splitGst(2881, true);
    expect(s.cgst + s.sgst).toBe(2881);
    expect(s.igst).toBe(0);
    expect(Math.abs(s.cgst - s.sgst)).toBeLessThanOrEqual(1);
  });
  it("uses IGST for an inter-state supply", () => {
    expect(splitGst(5000, false)).toEqual({ cgst: 0, sgst: 0, igst: 5000 });
    expect(isIntraState("06", "06")).toBe(true);
    expect(isIntraState("06", "07")).toBe(false);
    expect(isIntraState("06", null)).toBe(true);
  });
  it("formats invoice numbers and rejects a bad prefix", () => {
    expect(invoiceNumber("INV", "26", 42)).toBe("INV/26/00042");
    expect(() => invoiceNumber("bad prefix!", "26", 1)).toThrow();
  });
  it("summarises tax rate-wise", () => {
    const s = taxSummary([
      { gstRateBps: 1800, subtotalPaise: 100000, taxPaise: 18000 },
      { gstRateBps: 1800, subtotalPaise: 50000, taxPaise: 9000 },
      { gstRateBps: 2800, subtotalPaise: 20000, taxPaise: 5600 },
    ]);
    expect(s).toEqual([
      { rateBps: 1800, taxable: 150000, tax: 27000 },
      { rateBps: 2800, taxable: 20000, tax: 5600 },
    ]);
  });
  it("writes amounts in words using lakh and crore", () => {
    expect(amountInWords(231800)).toBe("Rupees Two Thousand Three Hundred Eighteen Only");
    expect(amountInWords(100)).toBe("Rupees One Only");
    expect(amountInWords(0)).toBe("Rupees Zero Only");
    expect(amountInWords(12345650)).toBe("Rupees One Lakh Twenty-Three Thousand Four Hundred Fifty-Six and Fifty Paise Only");
    expect(amountInWords(1_00_00_000_00)).toBe("Rupees One Crore Only");
  });
});

describe("insights", () => {
  it("says nothing when nothing needs attention", () => {
    expect(buildInsights(emptySnapshot)).toEqual([]);
  });
  it("puts blocked pricing and stopped work first", () => {
    const list = buildInsights({ ...emptySnapshot, mrpViolations: 1, dueForService: 4, unacceptedQuotes: 2, unacceptedValuePaise: 500000 });
    expect(list[0]!.id).toBe("mrp");
    expect(list[0]!.severity).toBe("urgent");
    expect(list[0]!.title).toBe("1 pricing attempt above MRP was blocked");
    expect(buildInsights({ ...emptySnapshot, mrpViolations: 3 })[0]!.title).toBe("3 pricing attempts above MRP were blocked");
    expect(list.map((i) => i.severity)).toEqual([...list.map((i) => i.severity)].sort((a, b) =>
      ({ urgent: 0, attention: 1, info: 2 })[a] - ({ urgent: 0, attention: 1, info: 2 })[b]));
  });
  it("grounds every card in a number from the garage's own data", () => {
    const list = buildInsights({ ...emptySnapshot, lowStock: [{ name: "Oil filter", stock: 1, reorderAt: 3 }] });
    expect(list).toHaveLength(1);
    expect(list[0]!.detail).toContain("Oil filter");
  });
  it("combines idle bays with customers who are due", () => {
    const list = buildInsights({ ...emptySnapshot, idleBaysToday: 2, dueForService: 5 });
    expect(list[0]!.id).toBe("idle");
    expect(list[0]!.title).toContain("2 bays");
  });
});

describe("service reminders", () => {
  const today = "2026-10-31";
  it("flags a vehicle past its distance interval", () => {
    const r = serviceDue({ vehicleId: "v", category: "sedan", lastServiceOn: "2026-06-01", lastServiceKm: 50000, odometerKm: 61000 }, today);
    expect(r.due).toBe(true);
    expect(r.basis).toBe("distance");
    expect(r.reason).toContain("11,000 km");
  });
  it("flags a vehicle past its time interval and counts how late it is", () => {
    const r = serviceDue({ vehicleId: "v", category: "sedan", lastServiceOn: "2025-09-01", lastServiceKm: null, odometerKm: null }, today);
    expect(r.due).toBe(true);
    expect(r.basis).toBe("time");
    expect(r.overdueDays).toBe(60); // 2025-09-01 + 12 months, measured to 2026-10-31
  });
  it("uses a shorter interval for two-wheelers", () => {
    expect(serviceDue({ vehicleId: "v", category: "motorcycle", lastServiceOn: "2026-03-01", lastServiceKm: null, odometerKm: null }, today).due).toBe(true);
    expect(serviceDue({ vehicleId: "v", category: "sedan", lastServiceOn: "2026-03-01", lastServiceKm: null, odometerKm: null }, today).due).toBe(false);
  });
  it("projects an upcoming service from usage without claiming it is due", () => {
    const r = serviceDue({ vehicleId: "v", category: "sedan", lastServiceOn: "2026-08-01", lastServiceKm: 50000, odometerKm: 59500, dailyKm: 40 }, today);
    expect(r.due).toBe(false);
    expect(r.basis).toBe("estimate");
  });
  it("says plainly when there is no history to go on", () => {
    const r = serviceDue({ vehicleId: "v", category: "suv", lastServiceOn: null, lastServiceKm: null, odometerKm: null }, today);
    expect(r.due).toBe(false);
    expect(r.basis).toBe("unknown");
  });
  it("sorts the overdue list by how late each one is", () => {
    const list = dueVehicles([
      { vehicleId: "a", category: "sedan", lastServiceOn: "2025-10-01", lastServiceKm: null, odometerKm: null },
      { vehicleId: "b", category: "sedan", lastServiceOn: "2024-10-01", lastServiceKm: null, odometerKm: null },
    ], today);
    expect(list.map((r) => r.vehicleId)).toEqual(["b", "a"]);
  });
});

describe("formatting", () => {
  it("groups Indian phone numbers and leaves anything else alone", () => {
    expect(fmtPhone("9876543210")).toBe("98765 43210");
    expect(fmtPhone("+919876543210")).toBe("98765 43210");
    expect(fmtPhone("12345")).toBe("12345");
    expect(fmtPhone(null)).toBe("—");
  });
  it("turns status keys into sentences", () => {
    expect(sentence("awaiting_customer_approval")).toBe("Awaiting customer approval");
    expect(initials("Ayush Kumar Jain")).toBe("AK");
  });
});

describe("estimate shaping", () => {
  const q = (over: Partial<GarageQuote>): GarageQuote => ({
    garageId: "g", name: "G", slug: "g", locality: "Sector 29", verification: "verified",
    pickupDrop: false, accentHex: "#5b35f0", covered: 2, requested: 2,
    labourPaise: 80000, partsPaise: 180000, consumablesPaise: 10000,
    subtotalPaise: 270000, taxPaise: 48600, totalPaise: 318600,
    estMinutes: 90, warrantyDays: 30, ...over,
  });
  const band = { lowPaise: 250000, medianPaise: 300000, highPaise: 400000, garages: 4 };

  it("separates a garage that priced everything from one that priced some", () => {
    const { full, partial } = splitByCoverage([
      q({ garageId: "a", covered: 2, requested: 2 }),
      q({ garageId: "b", covered: 1, requested: 2 }),
    ]);
    expect(full.map((x) => x.garageId)).toEqual(["a"]);
    expect(partial.map((x) => x.garageId)).toEqual(["b"]);
  });
  it("treats a garage with nothing requested as partial rather than complete", () => {
    expect(splitByCoverage([q({ covered: 0, requested: 0 })]).full).toHaveLength(0);
  });
  it("places a price within the band", () => {
    expect(bandPosition(250000, band)).toBe(0);
    expect(bandPosition(400000, band)).toBe(1);
    expect(bandPosition(325000, band)).toBeCloseTo(0.5, 2);
    expect(bandPosition(300000, null)).toBeNull();
  });
  it("reads a price against the median in plain language", () => {
    expect(verdict(260000, band)).toBe("below");
    expect(verdict(300000, band)).toBe("typical");
    expect(verdict(295000, band)).toBe("typical");
    expect(verdict(360000, band)).toBe("above");
    expect(verdict(300000, null)).toBeNull();
  });
  it("reports how far off the median a price is", () => {
    expect(deltaPct(330000, band)).toBe(10);
    expect(deltaPct(270000, band)).toBe(-10);
  });
  it("formats workshop time readably", () => {
    expect(fmtDuration(45)).toBe("45 min");
    expect(fmtDuration(60)).toBe("1 hr");
    expect(fmtDuration(105)).toBe("1 hr 45 min");
  });
  it("offers only categories the service makes sense for", () => {
    expect(categoriesFor("motorcycle")).toEqual(["motorcycle", "scooter"]);
    expect(categoriesFor("car")).toContain("suv");
    expect(categoriesFor("car")).not.toContain("scooter");
  });
});
