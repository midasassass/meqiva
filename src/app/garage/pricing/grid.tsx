"use client";
import { useActionState, useMemo, useState } from "react";
import { ChevronDown, Copy } from "lucide-react";
import { Badge, Button, Card, Input, Select, cx } from "@/components/ui";
import { savePriceRow, spreadPricing } from "@/server/pricing";
import type { ActionState } from "@/server/booking";
import { CATEGORY_LABEL, VEHICLE_CATEGORIES, type VehicleCategory } from "@/lib/estimate";
import { formatINR } from "@/lib/money";

export interface MatrixRow {
  vehicle_category: VehicleCategory;
  labour_paise: number; parts_paise: number; consumables_paise: number;
  gst_rate_bps: number; est_minutes: number; warranty_days: number;
}
export interface PackageRow {
  id: number; name: string; appliesTo: VehicleCategory[]; requiredItems: string[];
  typicalMinutes: number;
  /** Market median per class, so a garage prices against something real rather than a hunch. */
  market: Partial<Record<VehicleCategory, { medianPaise: number; garages: number }>>;
  rows: MatrixRow[];
}

interface Cell { on: boolean; labour: string; parts: string; consumables: string; minutes: string; warranty: string }

const toR = (p: number) => (p / 100).toString();
const num = (s: string) => { const n = Number(s); return Number.isFinite(n) && n > 0 ? n : 0; };

export function PricingGrid({ pkg }: { pkg: PackageRow }) {
  const existing = new Map(pkg.rows.map((r) => [r.vehicle_category, r]));
  const [open, setOpen] = useState(pkg.rows.length === 0);
  const [gst, setGst] = useState(String((pkg.rows[0]?.gst_rate_bps ?? 1800) / 100));

  const [cells, setCells] = useState<Record<string, Cell>>(() =>
    Object.fromEntries(pkg.appliesTo.map((c) => {
      const r = existing.get(c);
      return [c, r
        ? { on: true, labour: toR(r.labour_paise), parts: toR(r.parts_paise), consumables: toR(r.consumables_paise), minutes: String(r.est_minutes), warranty: String(r.warranty_days) }
        : { on: false, labour: "", parts: "", consumables: "", minutes: String(pkg.typicalMinutes), warranty: "30" }];
    })),
  );

  const [save, saveAction, saving] = useActionState<ActionState, FormData>(savePriceRow, {});
  const [spread, spreadAction, spreading] = useActionState<ActionState, FormData>(spreadPricing, {});

  const patch = (c: string, p: Partial<Cell>) => setCells((s) => ({ ...s, [c]: { ...s[c]!, ...p } }));

  const totals = useMemo(() => {
    const gstRate = 1 + (Number(gst) || 0) / 100;
    return Object.fromEntries(pkg.appliesTo.map((c) => {
      const cell = cells[c]!;
      const base = num(cell.labour) + num(cell.parts) + num(cell.consumables);
      return [c, Math.round(base * gstRate * 100)];
    }));
  }, [cells, gst, pkg.appliesTo]);

  const pricedCount = pkg.appliesTo.filter((c) => cells[c]?.on).length;

  return (
    <Card className="overflow-hidden p-0">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="press flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-surface2/60">
        <div className="min-w-0">
          <p className="display-3">{pkg.name}</p>
          <p className="mt-0.5 text-[12.5px] text-ink2">
            {pricedCount > 0
              ? `Priced for ${pricedCount} of ${pkg.appliesTo.length} vehicle types`
              : "Not priced yet — customers will not see you for this service"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Badge tone={pricedCount === 0 ? "warn" : pricedCount === pkg.appliesTo.length ? "success" : "brand"}>
            {pricedCount}/{pkg.appliesTo.length}
          </Badge>
          <ChevronDown className={cx("h-4 w-4 text-ink2 transition-transform duration-200", open && "rotate-180")} aria-hidden />
        </div>
      </button>

      {open && (
        <div className="border-t border-line">
          {pkg.requiredItems.length > 0 && (
            <p className="border-b border-line bg-surface2/50 px-5 py-2.5 text-[12px] text-ink2">
              A complete {pkg.name.toLowerCase()} covers {pkg.requiredItems.join(", ").toLowerCase()}.
            </p>
          )}

          <form action={saveAction} className="px-5 py-4">
            <input type="hidden" name="packageId" value={pkg.id} />

            <label className="mb-4 flex items-center gap-2 text-[13px]">
              <span className="font-semibold">GST</span>
              <Input name="gstPct" value={gst} onChange={(e) => setGst(e.target.value)}
                inputMode="decimal" className="h-9 w-20" aria-label="GST percent" />
              <span className="text-ink2">% — applies to every row below</span>
            </label>

            <div className="space-y-2">
              {pkg.appliesTo.map((c) => {
                const cell = cells[c]!;
                const mkt = pkg.market[c];
                const total = totals[c] ?? 0;
                const delta = mkt && mkt.medianPaise > 0 && total > 0
                  ? Math.round(((total - mkt.medianPaise) / mkt.medianPaise) * 100) : null;
                return (
                  <div key={c} className={cx("rounded-card border p-3 transition-colors",
                    cell.on ? "border-line bg-surface" : "border-dashed border-line bg-surface2/40")}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
                        <input type="checkbox" name={`offer.${c}`} checked={cell.on}
                          onChange={(e) => patch(c, { on: e.target.checked })}
                          className="h-4 w-4 accent-[var(--brand)]" />
                        {CATEGORY_LABEL[c]}
                      </label>
                      {cell.on && (
                        <div className="flex items-center gap-2 text-right">
                          <span className="tnum text-[15px] font-bold">{formatINR(total)}</span>
                          {mkt ? (
                            <Badge tone={delta == null ? "neutral" : delta > 12 ? "warn" : delta < -12 ? "brand" : "success"}>
                              {delta == null ? `${mkt.garages} quoting`
                                : delta === 0 ? "at market"
                                : `${delta > 0 ? "+" : ""}${delta}% vs ${mkt.garages} others`}
                            </Badge>
                          ) : <Badge tone="neutral">first to price this</Badge>}
                        </div>
                      )}
                    </div>

                    {cell.on && (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                        {([
                          ["labour", "Labour ₹"], ["parts", "Parts ₹"], ["consumables", "Consumables ₹"],
                          ["minutes", "Minutes"], ["warranty", "Warranty days"],
                        ] as const).map(([k, label]) => (
                          <label key={k} className="block">
                            <span className="mb-1 block text-[11px] text-ink2">{label}</span>
                            <Input name={`${k === "warranty" ? "warranty" : k}.${c}`} value={cell[k]}
                              onChange={(e) => patch(c, { [k]: e.target.value } as Partial<Cell>)}
                              inputMode="decimal" className="h-9" aria-label={`${label} for ${CATEGORY_LABEL[c]}`} />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {save.error && <p role="alert" className="mt-3 text-sm text-danger">{save.error}</p>}
            {save.ok && save.message && <p role="status" className="mt-3 text-sm text-success">{save.message}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save this service"}</Button>
              <span className="text-[12px] text-ink2">Untick a vehicle type to stop offering it.</span>
            </div>
          </form>

          <div className="border-t border-line bg-surface2/40 px-5 py-3">
            <form action={spreadAction} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="packageId" value={pkg.id} />
              <label className="text-[12.5px]">
                <span className="mb-1 block text-ink2">Copy prices from</span>
                <Select name="from" defaultValue={pkg.appliesTo[0]} className="h-9 w-40">
                  {pkg.appliesTo.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                </Select>
              </label>
              <label className="text-[12.5px]">
                <span className="mb-1 block text-ink2">Adjust by</span>
                <Input name="uplift" defaultValue="15" inputMode="numeric" className="h-9 w-20" aria-label="Percentage adjustment" />
              </label>
              <span className="pb-2 text-[12.5px] text-ink2">%</span>
              <Button type="submit" variant="outline" size="sm" disabled={spreading}>
                <Copy className="h-3.5 w-3.5" aria-hidden />{spreading ? "Copying…" : "Copy across"}
              </Button>
              {spread.error && <p role="alert" className="w-full text-[12.5px] text-danger">{spread.error}</p>}
              {spread.ok && spread.message && <p role="status" className="w-full text-[12.5px] text-success">{spread.message}</p>}
            </form>
          </div>
        </div>
      )}
    </Card>
  );
}
