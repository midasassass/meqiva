"use client";
import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Callout, Card, Check, Field, Input, Select, Textarea, cx } from "@/components/ui";
import { saveQuote } from "@/server/garage-ops";
import type { ActionState } from "@/server/booking";
import { computeQuote, type LineKind, type QuoteLine } from "@/lib/quote";
import { formatINR, toPaise } from "@/lib/money";

export interface PartOption {
  id: string; label: string; sell: number; cost: number;
  mrpApplies: boolean; mrp: number | null; packQty: number; gstPct: number; stock: number;
}

interface Draft {
  uid: string; kind: LineKind; description: string; qty: string; price: string; cost: string; gst: string;
  mrpApplies: boolean; mrp: string; pack: string; partId?: string;
}

const uid = () => Math.random().toString(36).slice(2);
const blank = (kind: LineKind, gst: number): Draft => ({
  uid: uid(), kind, description: "", qty: "1", price: "", cost: "", gst: String(gst),
  mrpApplies: false, mrp: "", pack: "1",
});
const safe = (s: string) => { try { return s ? toPaise(s) : 0; } catch { return 0; } };

export function QuoteBuilder({
  jobCardId, parts, defaultGstPct, defaultLabourRate, lowMarginPct, targetMarginPct, defaultWarrantyDays,
}: {
  jobCardId: string; parts: PartOption[]; defaultGstPct: number; defaultLabourRate: number;
  lowMarginPct: number; targetMarginPct: number; defaultWarrantyDays: number;
}) {
  const [lines, setLines] = useState<Draft[]>([
    blank("part", defaultGstPct),
    { ...blank("labour", defaultGstPct), description: "Labour", price: String(defaultLabourRate), cost: String(Math.round(defaultLabourRate * 0.4)) },
  ]);
  const [extraWork, setExtraWork] = useState(false);
  const [state, dispatch, pending] = useActionState<ActionState, FormData>(saveQuote, {});

  const patch = (id: string, p: Partial<Draft>) => setLines((ls) => ls.map((l) => (l.uid === id ? { ...l, ...p } : l)));

  const pickPart = (id: string, partId: string) => {
    const p = parts.find((x) => x.id === partId);
    if (!p) return patch(id, { partId: undefined });
    patch(id, {
      partId: p.id, description: p.label, price: String(p.sell), cost: String(p.cost),
      gst: String(p.gstPct), mrpApplies: p.mrpApplies, mrp: p.mrp != null ? String(p.mrp) : "", pack: String(p.packQty),
    });
  };

  const result = useMemo(() => {
    const q: QuoteLine[] = lines.map((l) => ({
      id: l.uid, kind: l.kind, description: l.description || "Item", qty: Math.max(0.01, Number(l.qty) || 1),
      unitPricePaise: safe(l.price), unitCostPaise: safe(l.cost), gstRateBps: Math.round((Number(l.gst) || 0) * 100),
      mrpApplies: l.mrpApplies, mrpPaise: l.mrp ? safe(l.mrp) : null, packQty: Number(l.pack) || null,
    }));
    return computeQuote(q, { lowMarginPct, requiredKinds: extraWork ? [] : ["labour"] });
  }, [lines, lowMarginPct, extraWork]);

  const t = result.totals;
  const payload = JSON.stringify(lines.map((l) => ({
    kind: l.kind, description: l.description || "Item", qty: Number(l.qty) || 1,
    unitPrice: Number(l.price) || 0, unitCost: Number(l.cost) || 0, gstPct: Number(l.gst) || 0,
    mrpApplies: l.mrpApplies, mrp: l.mrp ? Number(l.mrp) : undefined,
    packQty: Number(l.pack) || 1, partId: l.partId,
  })));

  return (
    <form action={dispatch} className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
      <input type="hidden" name="jobCardId" value={jobCardId} />
      <input type="hidden" name="lines" value={payload} />

      <div className="space-y-3">
        {lines.map((l) => {
          const issues = result.mrpIssues[l.uid];
          return (
            <Card key={l.uid} className="space-y-3 p-4">
              <div className="flex gap-2">
                <div className="w-28 shrink-0 sm:w-36">
                  <Select aria-label="Line type" value={l.kind} onChange={(e) => patch(l.uid, { kind: e.target.value as LineKind })}>
                    <option value="part">Part</option>
                    <option value="labour">Labour</option>
                    <option value="consumable">Consumable</option>
                    <option value="inspection">Inspection</option>
                    <option value="other">Other</option>
                  </Select>
                </div>
                <Input aria-label="Description" placeholder="What is it?" value={l.description}
                  onChange={(e) => patch(l.uid, { description: e.target.value })} />
                <button type="button" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((x) => x.uid !== l.uid))}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-card text-ink2 transition-colors hover:bg-surface2 hover:text-danger">
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {l.kind === "part" && parts.length > 0 && (
                <Select aria-label="Pick from your stock" value={l.partId ?? ""} onChange={(e) => pickPart(l.uid, e.target.value)}>
                  <option value="">Pick from your stock, or type it above</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>{p.label} — {p.stock} in stock</option>
                  ))}
                </Select>
              )}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Input aria-label="Quantity" inputMode="decimal" placeholder="Qty" value={l.qty} onChange={(e) => patch(l.uid, { qty: e.target.value })} />
                <Input aria-label="Customer price in rupees" inputMode="decimal" placeholder="Price ₹" value={l.price} onChange={(e) => patch(l.uid, { price: e.target.value })} />
                <Input aria-label="Your cost in rupees" inputMode="decimal" placeholder="Your cost ₹" value={l.cost} onChange={(e) => patch(l.uid, { cost: e.target.value })} />
                <Input aria-label="GST percent" inputMode="decimal" placeholder="GST %" value={l.gst} onChange={(e) => patch(l.uid, { gst: e.target.value })} />
              </div>

              {l.kind === "part" && (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-[13px] text-ink2">
                    <input type="checkbox" checked={l.mrpApplies} onChange={(e) => patch(l.uid, { mrpApplies: e.target.checked })}
                      className="h-4 w-4 accent-[var(--brand)]" />
                    Packaged good with a printed MRP — price already includes tax
                  </label>
                  {l.mrpApplies && (
                    <div className="grid grid-cols-2 gap-2">
                      <Input aria-label="Printed MRP per pack" inputMode="decimal" placeholder="MRP ₹ per pack" value={l.mrp} onChange={(e) => patch(l.uid, { mrp: e.target.value })} />
                      <Input aria-label="Pack quantity" inputMode="numeric" placeholder="Pack qty" value={l.pack} onChange={(e) => patch(l.uid, { pack: e.target.value })} />
                    </div>
                  )}
                </div>
              )}

              {issues?.map((i) => <p key={i.code} role="alert" className="text-[13px] text-danger">{i.message}</p>)}
            </Card>
          );
        })}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, blank("part", defaultGstPct)])}>
            <Plus className="h-4 w-4" aria-hidden /> Part
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, blank("labour", defaultGstPct)])}>
            <Plus className="h-4 w-4" aria-hidden /> Labour
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, blank("consumable", defaultGstPct)])}>
            <Plus className="h-4 w-4" aria-hidden /> Consumable
          </Button>
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-6">
        <Card className="space-y-3 p-5">
          <Row k="Subtotal" v={formatINR(t.subtotalExTax)} />
          <Row k="GST" v={formatINR(t.tax)} />
          <div className="border-t border-line pt-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-medium">Customer pays</span>
              <span className="tnum text-2xl font-semibold tracking-tight">{formatINR(t.customerTotal)}</span>
            </div>
          </div>

          <div className="space-y-2 border-t border-line pt-3">
            <Row k="Direct costs" v={formatINR(t.partsCost + t.labourCost + t.otherDirectCost)} muted />
            <Row k="Contribution" v={formatINR(t.contributionPaise)} muted />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-ink2">Margin</span>
              <Badge tone={t.contributionMarginPct >= targetMarginPct ? "success" : t.contributionMarginPct >= lowMarginPct ? "warn" : "danger"}>
                {t.contributionMarginPct}%
              </Badge>
            </div>
            <p className="text-[11.5px] leading-relaxed text-ink2">
              Contribution is before rent, salaries and overheads. It is not profit, and the customer never sees it.
            </p>
          </div>

          {result.warnings.filter((w) => !w.blocking).map((w, i) => (
            <p key={i} className="text-[12px] text-warn">{w.message}</p>
          ))}
        </Card>

        <Card className="space-y-3 p-5">
          <Check name="extraWork" label="This is extra work found during the job" checked={extraWork}
            onChange={(e) => setExtraWork(e.target.checked)}
            hint="It will need a fresh approval from the customer before it can be billed." />
          {extraWork && (
            <Field label="Why is it needed?" required>
              <Textarea name="reason" rows={3} maxLength={1000} required
                placeholder="Anti-roll bar link has play and is knocking over bumps. Photographs attached to the job card." />
            </Field>
          )}
          <Field label="Warranty note" hint="Appears on the quotation the customer reads.">
            <Input name="warrantyNote" maxLength={500} defaultValue={`${defaultWarrantyDays}-day warranty on labour`} />
          </Field>

          {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
          {state.ok && state.message && <p role="status" className="text-sm text-success">{state.message}</p>}

          <div className="space-y-2">
            <Button type="submit" name="publish" value="on" size="lg" className="w-full"
              disabled={pending || !result.canIssue || t.customerTotal === 0}>
              {pending ? "Sending…" : "Send to the customer"}
            </Button>
            <Button type="submit" variant="outline" className="w-full" disabled={pending || t.customerTotal === 0}>
              Save as draft
            </Button>
          </div>

          {!result.canIssue && (
            <Callout tone="danger" title="Cannot be sent yet">
              {result.warnings.find((w) => w.blocking)?.message}
            </Callout>
          )}
        </Card>
      </aside>
    </form>
  );
}

const Row = ({ k, v, muted }: { k: string; v: string; muted?: boolean }) => (
  <div className="flex justify-between gap-4 text-[13px]">
    <span className="text-ink2">{k}</span>
    <span className={cx("tnum", !muted && "font-medium")}>{v}</span>
  </div>
);
