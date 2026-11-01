"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { EstimateSheet } from "./estimate";
import { Select, cx } from "./ui";
import { computeQuote, type QuoteLine } from "@/lib/quote";

/**
 * The hero runs the production quote engine on an illustrative rate card, so what a
 * visitor sees here is assembled exactly the way a real garage quotation is — including
 * the rule that GST is never added on top of a printed MRP.
 *
 * It is labelled as an example. Real prices come from garages, on the comparison page.
 */

export interface HeroModel { id: number; label: string; category: string }

const FALLBACK_MODELS: HeroModel[] = [
  { id: 1, label: "Maruti Suzuki Swift", category: "hatchback" },
  { id: 2, label: "Hyundai Creta", category: "suv" },
  { id: 3, label: "Honda City", category: "sedan" },
  { id: 4, label: "Tata Nexon", category: "suv" },
  { id: 5, label: "Toyota Innova Crysta", category: "mpv" },
  { id: 6, label: "Royal Enfield Classic 350", category: "motorcycle" },
];

const SIZE_FACTOR: Record<string, number> = {
  hatchback: 1, sedan: 1.15, suv: 1.4, mpv: 1.45, ev: 1.2, motorcycle: 0.35, scooter: 0.3,
};

interface Spec { id: string; label: string; minutes: number; lines: { d: string; base: number; kind: QuoteLine["kind"]; mrp?: boolean }[] }

const SERVICES: Spec[] = [
  { id: "periodic-basic", label: "Basic periodic service", minutes: 90, lines: [
    { d: "Engine oil", base: 118000, kind: "part", mrp: true },
    { d: "Oil filter", base: 35000, kind: "part", mrp: true },
    { d: "Labour", base: 50000, kind: "labour" },
    { d: "Multi-point inspection", base: 0, kind: "other" },
  ] },
  { id: "periodic-full", label: "Comprehensive service", minutes: 180, lines: [
    { d: "Engine oil", base: 118000, kind: "part", mrp: true },
    { d: "Oil filter", base: 35000, kind: "part", mrp: true },
    { d: "Air filter", base: 48000, kind: "part", mrp: true },
    { d: "Cabin filter", base: 52000, kind: "part", mrp: true },
    { d: "Labour", base: 95000, kind: "labour" },
    { d: "Exterior wash and interior vacuum", base: 25000, kind: "consumable" },
  ] },
  { id: "brake-front", label: "Front brake pads", minutes: 90, lines: [
    { d: "Front brake pad set", base: 240000, kind: "part", mrp: true },
    { d: "Labour", base: 60000, kind: "labour" },
    { d: "Brake inspection", base: 0, kind: "other" },
  ] },
  { id: "ac-service", label: "AC service and regas", minutes: 120, lines: [
    { d: "Refrigerant", base: 160000, kind: "part", mrp: true },
    { d: "AC filter", base: 52000, kind: "part", mrp: true },
    { d: "Labour", base: 90000, kind: "labour" },
    { d: "Cooling performance check", base: 0, kind: "other" },
  ] },
  { id: "battery-replace", label: "Battery replacement", minutes: 45, lines: [
    { d: "Battery", base: 540000, kind: "part", mrp: true },
    { d: "Labour", base: 25000, kind: "labour" },
    { d: "Charging system check", base: 0, kind: "other" },
  ] },
];

/** Round to the nearest ten rupees so an illustrative figure never looks like a real quotation. */
const round10 = (paise: number) => Math.round(paise / 1000) * 1000;

export function HeroEstimate({ models }: { models?: HeroModel[] }) {
  const list = models?.length ? models : FALLBACK_MODELS;
  const [modelId, setModelId] = useState(String(list[0]!.id));
  const [serviceId, setServiceId] = useState(SERVICES[0]!.id);

  const model = list.find((m) => String(m.id) === modelId) ?? list[0]!;
  const service = SERVICES.find((s) => s.id === serviceId) ?? SERVICES[0]!;
  const factor = SIZE_FACTOR[model.category] ?? 1;

  const { lines, result } = useMemo(() => {
    const q: QuoteLine[] = service.lines.map((l, i) => {
      const unit = round10(l.base * factor);
      return {
        id: `l${i}`, kind: l.kind, description: l.d, qty: 1,
        unitPricePaise: unit, unitCostPaise: 0, gstRateBps: 1800,
        mrpApplies: !!l.mrp, mrpPaise: l.mrp ? unit : null, packQty: l.mrp ? 1 : null,
      };
    });
    return { lines: q, result: computeQuote(q) };
  }, [service, factor]);

  const t = result.totals;
  const href = `/find?model=${model.id}&service=${service.id}`;

  return (
    <div className="settle">
      <EstimateSheet
        heading={`${model.label} — ${service.label}`}
        subheading={`Example breakdown · about ${service.minutes >= 60 ? `${Math.round(service.minutes / 60 * 10) / 10} hours` : `${service.minutes} minutes`} in the workshop`}
        lines={lines.map((l) => ({
          description: l.description,
          amountPaise: l.unitPricePaise,
          mrpPaise: l.mrpApplies ? l.mrpPaise : null,
          note: l.unitPricePaise === 0 ? "Included at no charge" : null,
        }))}
        subtotalPaise={t.subtotalExTax}
        taxPaise={t.tax}
        totalPaise={t.customerTotal}
        footnote="An illustration of how a MEQIVA estimate is laid out, not a quotation. Real prices come from garages near you, and GST is never added on top of a printed MRP."
      />

      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="sr-only">Your vehicle</span>
          <Select value={modelId} onChange={(e) => setModelId(e.target.value)}>
            {list.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </Select>
        </label>
        <label className="block">
          <span className="sr-only">Service needed</span>
          <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            {SERVICES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </Select>
        </label>
        <Link href={href}
          className={cx("inline-flex h-11 items-center justify-center rounded-card bg-brand px-5 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover")}>
          See real prices
        </Link>
      </div>
    </div>
  );
}
