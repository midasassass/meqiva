import { describe, expect, it } from "vitest";
import { addTax, bps, formatINR, splitInclusive, toPaise } from "./money";
import { checkMrp } from "./mrp";
import { computeQuote, type QuoteLine } from "./quote";
import { computeCommission } from "./commission";
import { canTransition, assertTransition, nextStatuses } from "./booking";
import { can } from "./permissions";
import { unapprovedBillable } from "./approvals";
import { applyMovement } from "./inventory";
import { verifyWebhookSignature, paymentMode, cameraMode } from "./payments";
import { createHmac } from "node:crypto";

describe("money", () => {
  it("parses rupees to integer paise without float drift", () => {
    expect(toPaise("499.90")).toBe(49990);
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise("-5")).toBe(-500);
    expect(() => toPaise("abc")).toThrow();
  });
  it("formats INR", () => expect(formatINR(123456)).toContain("1,234.56"));
  it("computes bps and tax split", () => {
    expect(bps(10000, 1800)).toBe(1800);
    expect(splitInclusive(11800, 1800)).toEqual({ base: 10000, tax: 1800 });
    expect(addTax(10000, 1800)).toEqual({ base: 10000, tax: 1800, total: 11800 });
  });
});

describe("MRP engine", () => {
  const base = { mrpApplies: true, mrpPaise: 50000, packQty: 1, qty: 1 };
  it("blocks selling above MRP", () => {
    expect(checkMrp({ ...base, sellingPaise: 50100 }).map((i) => i.code)).toContain("MRP_EXCEEDED");
  });
  it("allows discount below MRP and selling at MRP", () => {
    expect(checkMrp({ ...base, sellingPaise: 45000 })).toEqual([]);
    expect(checkMrp({ ...base, sellingPaise: 50000 })).toEqual([]);
  });
  it("flags missing MRP and missing pack", () => {
    expect(checkMrp({ ...base, mrpPaise: null, sellingPaise: 100 })[0]?.code).toBe("MRP_MISSING");
    expect(checkMrp({ ...base, packQty: null, sellingPaise: 100 })[0]?.code).toBe("PACK_UNIDENTIFIED");
  });
  it("does not apply to goods with no statutory MRP", () => {
    expect(checkMrp({ mrpApplies: false, sellingPaise: 999999, qty: 1 })).toEqual([]);
  });
});

const oil: QuoteLine = {
  id: "oil", kind: "part", description: "Engine oil 3.5L", qty: 1, unitPricePaise: 118000, unitCostPaise: 80000,
  gstRateBps: 1800, mrpApplies: true, mrpPaise: 118000, packQty: 1,
};
const labour: QuoteLine = {
  id: "lab", kind: "labour", description: "Oil change labour", qty: 1, unitPricePaise: 50000, unitCostPaise: 20000, gstRateBps: 1800,
};

describe("quote engine", () => {
  it("does not add GST on top of tax-inclusive MRP parts, but adds it on labour", () => {
    const r = computeQuote([oil, labour]);
    // oil 118000 incl 18% => base 100000, tax 18000. labour 50000 + 9000 tax.
    expect(r.totals.customerTotal).toBe(118000 + 59000);
    expect(r.totals.subtotalExTax).toBe(100000 + 50000);
    expect(r.canIssue).toBe(true);
  });
  it("blocks a quote that exceeds MRP", () => {
    const r = computeQuote([{ ...oil, unitPricePaise: 130000 }]);
    expect(r.canIssue).toBe(false);
    expect(r.mrpIssues["oil"]?.[0]?.code).toBe("MRP_EXCEEDED");
  });
  it("labels contribution, not profit, and subtracts marketplace fee", () => {
    const r = computeQuote([oil, labour], { marketplaceFeePaise: 5000 });
    expect(r.totals.contributionPaise).toBe(150000 - 100000);
    expect(r.totals.netContributionPaise).toBe(45000);
    expect(r.totals.contributionMarginPct).toBeCloseTo(33.33, 1);
  });
  it("warns on duplicates, low margin and missing required lines", () => {
    const cheap = { ...labour, id: "a", unitPricePaise: 21000 };
    const r = computeQuote([cheap, { ...cheap, id: "b" }], { requiredKinds: ["part"] });
    const codes = r.warnings.map((w) => w.code);
    expect(codes).toEqual(expect.arrayContaining(["DUPLICATE_LINE", "LOW_CONTRIBUTION", "MISSING_REQUIRED"]));
  });
});

describe("commission", () => {
  const rule = { type: "pct_labour", rateBps: 1000 } as const;
  const base = { labourExTaxPaise: 50000, eligibleTotalExTaxPaise: 150000, completed: true, rule };
  it("charges only completed marketplace jobs", () => {
    expect(computeCommission({ ...base, origin: "marketplace" }).feePaise).toBe(5000);
    expect(computeCommission({ ...base, origin: "walk_in" }).feePaise).toBe(0);
    expect(computeCommission({ ...base, origin: "fleet" }).feePaise).toBe(0);
    expect(computeCommission({ ...base, origin: "marketplace", completed: false }).feePaise).toBe(0);
  });
  it("supports fixed and total-percentage rules", () => {
    expect(computeCommission({ ...base, origin: "marketplace", rule: { type: "fixed", amountPaise: 9900 } }).feePaise).toBe(9900);
    expect(computeCommission({ ...base, origin: "marketplace", rule: { type: "pct_total", rateBps: 500 } }).feePaise).toBe(7500);
  });
});

describe("booking state machine", () => {
  it("allows the happy path with correct actors", () => {
    expect(canTransition("awaiting_garage_confirmation", "confirmed", "garage_owner")).toBe(true);
    expect(canTransition("quality_check", "ready_for_delivery", "service_advisor")).toBe(true);
  });
  it("rejects unauthorised transitions", () => {
    expect(canTransition("awaiting_garage_confirmation", "confirmed", "customer")).toBe(false);
    expect(canTransition("quality_check", "ready_for_delivery", "technician")).toBe(false);
    expect(() => assertTransition("requested", "completed", "admin")).toThrow();
    expect(nextStatuses("cancelled", "admin")).toEqual([]);
  });
  it("supports failed QC rework and post-completion disputes", () => {
    expect(canTransition("quality_check", "service_in_progress", "garage_owner")).toBe(true);
    expect(canTransition("completed", "disputed", "customer")).toBe(true);
  });
  it("lets garage reject a request", () => {
    expect(canTransition("awaiting_garage_confirmation", "cancelled", "garage_owner")).toBe(true);
  });
});

describe("permissions", () => {
  it("keeps finance and pricing away from technicians", () => {
    expect(can("technician", "finance.view")).toBe(false);
    expect(can("technician", "pricing.edit")).toBe(false);
    expect(can("technician", "quote.approve_extra_work")).toBe(false);
    expect(can("customer", "quote.approve_extra_work")).toBe(true);
    expect(can("quality_auditor", "platform.admin")).toBe(false);
  });
});

describe("extra-work approvals", () => {
  const items = [{ id: "x", description: "Brake pads", totalPaise: 400000, extraWork: true }];
  it("flags unapproved extra work", () => expect(unapprovedBillable(items, [])).toHaveLength(1));
  it("flags approvals lower than billed amount", () => {
    expect(unapprovedBillable(items, [{ itemId: "x", quoteVersion: 2, amountPaise: 300000, approvedAt: "" }])).toHaveLength(1);
  });
  it("passes when approved", () => {
    expect(unapprovedBillable(items, [{ itemId: "x", quoteVersion: 2, amountPaise: 400000, approvedAt: "" }])).toHaveLength(0);
  });
});

describe("inventory", () => {
  it("never goes negative and supports returns", () => {
    expect(applyMovement(5, { kind: "job_consume", qty: 2 })).toBe(3);
    expect(applyMovement(3, { kind: "job_return", qty: 2 })).toBe(5);
    expect(() => applyMovement(1, { kind: "outward", qty: 2 })).toThrow("Insufficient stock");
    expect(applyMovement(4, { kind: "adjustment", qty: -1 })).toBe(3);
  });
});

describe("payments and integrations", () => {
  it("verifies webhook signatures", () => {
    const body = '{"id":"evt_1"}';
    const sig = createHmac("sha256", "s3cret").update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig, "s3cret")).toBe(true);
    expect(verifyWebhookSignature(body, sig, "wrong")).toBe(false);
    expect(verifyWebhookSignature(body, "", "s3cret")).toBe(false);
  });
  it("reports integration modes honestly", () => {
    expect(paymentMode({})).toBe("sandbox");
    expect(paymentMode({ PAYMENT_PROVIDER: "razorpay" })).toBe("unavailable");
    expect(paymentMode({ PAYMENT_PROVIDER: "razorpay", RAZORPAY_KEY_ID: "a", RAZORPAY_KEY_SECRET: "b" })).toBe("live");
    expect(cameraMode({})).toBe("unavailable");
  });
});
