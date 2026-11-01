"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Clock, MapPin, Truck, Wrench } from "lucide-react";
import { Badge, Callout, Card, Empty, Select, Skeleton, cx } from "@/components/ui";
import { CountUp, LiveValue } from "@/components/motion";
import { Stamp } from "@/components/stamp";
import { fetchEstimate } from "@/server/estimate";
import { formatINR } from "@/lib/money";
import {
  CATEGORY_LABEL, bandPosition, deltaPct, fmtDuration, verdict, VERDICT_LABEL,
  type EstimateResult, type GarageQuote, type VehicleCategory,
} from "@/lib/estimate";

export interface ModelOption { id: number; label: string; category: VehicleCategory }
export interface PackageOption {
  id: number; slug: string; name: string; group: string;
  includes: string[]; minutes: number; categories: VehicleCategory[];
}
export interface AddonOption { id: number; name: string; description: string | null }

const EMPTY: EstimateResult = { full: [], partial: [], band: null, requested: 0 };

export function Estimator({ models, packages, addons, localities }: {
  models: ModelOption[]; packages: PackageOption[]; addons: AddonOption[]; localities: string[];
}) {
  const [modelId, setModelId] = useState<number | null>(models[0]?.id ?? null);
  const [category, setCategory] = useState<VehicleCategory>(models[0]?.category ?? "hatchback");
  const [locality, setLocality] = useState("");
  const [picked, setPicked] = useState<number[]>(() => (packages[0] ? [packages[0].id] : []));
  const [extras, setExtras] = useState<number[]>([]);
  const [result, setResult] = useState<EstimateResult>(EMPTY);
  const [pending, start] = useTransition();
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const model = models.find((m) => m.id === modelId) ?? null;
  const relevant = useMemo(() => packages.filter((p) => p.categories.includes(category)), [packages, category]);

  // Keep the selection honest when the vehicle class changes.
  useEffect(() => {
    setPicked((prev) => {
      const allowed = new Set(relevant.map((p) => p.id));
      const kept = prev.filter((id) => allowed.has(id));
      return kept.length ? kept : relevant[0] ? [relevant[0].id] : [];
    });
  }, [relevant]);

  const key = `${category}|${picked.join(",")}|${extras.join(",")}|${locality}`;

  useEffect(() => {
    if (picked.length + extras.length === 0) { setResult(EMPTY); return; }
    // Recompute straight away, then log the request once the person stops fiddling.
    start(async () => {
      setResult(await fetchEstimate({ category, packageIds: picked, addonIds: extras, locality: locality || null, modelId }));
    });
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      void fetchEstimate({ category, packageIds: picked, addonIds: extras, locality: locality || null, modelId, record: true });
    }, 2500);
    return () => { if (settle.current) clearTimeout(settle.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const toggle = (list: number[], set: (v: number[]) => void, id: number) =>
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  const band = result.band;
  const chosenCount = picked.length + extras.length;
  const grouped = useMemo(() => {
    const m = new Map<string, PackageOption[]>();
    for (const p of relevant) m.set(p.group, [...(m.get(p.group) ?? []), p]);
    return [...m.entries()];
  }, [relevant]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:items-start">
      {/* ── Choices ─────────────────────────────── */}
      <div className="space-y-5">
        <Card className="p-5">
          <h2 className="display-3">Your vehicle</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold">Make and model</span>
              <Select value={modelId ?? ""} onChange={(e) => {
                const id = Number(e.target.value);
                setModelId(id);
                const m = models.find((x) => x.id === id);
                if (m) setCategory(m.category);
              }}>
                {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </Select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold">Area</span>
              <Select value={locality} onChange={(e) => setLocality(e.target.value)}>
                <option value="">Anywhere in Gurugram</option>
                {localities.map((l) => <option key={l} value={l}>{l}</option>)}
              </Select>
            </label>
          </div>
          {model && (
            <p className="mt-3 flex items-center gap-2 text-[13px] text-ink2">
              <Badge tone="brand">{CATEGORY_LABEL[category]}</Badge>
              Prices below are what garages charge for a {CATEGORY_LABEL[category].toLowerCase()}.
            </p>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-end justify-between gap-3">
            <h2 className="display-3">What does it need?</h2>
            <span className="tnum text-[13px] text-ink2">{chosenCount} selected</span>
          </div>

          {grouped.map(([group, items]) => (
            <div key={group} className="mt-5">
              <p className="text-[11.5px] font-bold uppercase tracking-wide text-ink3">{group}</p>
              <div className="mt-2 grid gap-2">
                {items.map((p) => {
                  const on = picked.includes(p.id);
                  return (
                    <button key={p.id} type="button" onClick={() => toggle(picked, setPicked, p.id)}
                      aria-pressed={on}
                      className={cx("press flex w-full items-start gap-3 rounded-card border-2 p-3.5 text-left transition-all duration-200",
                        on ? "border-brand bg-brand-soft/50 shadow-soft" : "border-line bg-surface hover:border-line-strong")}>
                      <span className={cx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition-all duration-200",
                        on ? "border-brand bg-brand text-brand-fg" : "border-line-strong")}>
                        {on && <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{p.name}</span>
                        {p.includes.length > 0 && (
                          <span className="mt-1 block text-[12.5px] leading-relaxed text-ink2">
                            {p.includes.join(" · ")}
                          </span>
                        )}
                      </span>
                      <span className="tnum shrink-0 text-[12px] text-ink3">{fmtDuration(p.minutes)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {addons.length > 0 && (
            <div className="mt-6 border-t border-line pt-5">
              <p className="text-[11.5px] font-bold uppercase tracking-wide text-ink3">Add anything else</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {addons.map((a) => {
                  const on = extras.includes(a.id);
                  return (
                    <button key={a.id} type="button" onClick={() => toggle(extras, setExtras, a.id)}
                      aria-pressed={on} title={a.description ?? undefined}
                      className={cx("press rounded-full border-2 px-3.5 py-1.5 text-[13px] font-medium transition-all duration-200",
                        on ? "border-accent bg-accent text-accent-fg shadow-soft" : "border-line bg-surface text-ink2 hover:border-line-strong hover:text-ink")}>
                      {on && <span className="mr-1" aria-hidden>✓</span>}{a.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ── Live result ─────────────────────────── */}
      <aside className="lg:sticky lg:top-24">
        <Card className="overflow-hidden p-0">
          <div className="gradient-brand px-5 py-5 text-white">
            <p className="text-[12.5px] font-medium uppercase tracking-wide opacity-85">Typical total for your vehicle</p>
            {pending && !band ? (
              <Skeleton className="mt-2 h-11 w-40 bg-white/25" />
            ) : band ? (
              <>
                <LiveValue watch={band.medianPaise}>
                  <p className="font-display mt-1.5 text-[42px] font-bold leading-none tracking-tight">
                    <CountUp value={band.medianPaise} format={(n) => formatINR(Math.round(n))} />
                  </p>
                </LiveValue>
                <p className="tnum mt-2 text-sm opacity-90">
                  {formatINR(band.lowPaise)} – {formatINR(band.highPaise)} across{" "}
                  {band.garages} {band.garages === 1 ? "garage" : "garages"}
                </p>
              </>
            ) : (
              <p className="mt-2 text-[15px] font-medium leading-snug opacity-95">
                No garage has published a price for this combination yet.
              </p>
            )}
          </div>

          {band && band.garages > 1 && (
            <div className="border-b border-line px-5 py-4">
              <div className="relative h-2 rounded-full bg-gradient-to-r from-success/30 via-warn/30 to-danger/30">
                <span className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded-full bg-ink"
                  style={{ left: "50%" }} aria-hidden />
              </div>
              <div className="tnum mt-2 flex justify-between text-[11.5px] text-ink3">
                <span>Lowest {formatINR(band.lowPaise)}</span>
                <span>Highest {formatINR(band.highPaise)}</span>
              </div>
            </div>
          )}

          <div className="p-5">
            {result.full.length === 0 && !pending ? (
              <Empty
                icon={<Wrench className="h-5 w-5" aria-hidden />}
                title={chosenCount === 0 ? "Pick a service to start" : "Nobody prices all of this yet"}
                body={chosenCount === 0
                  ? "Tick what your vehicle needs and the total updates as you go."
                  : "MEQIVA is still onboarding workshops. Try fewer services, or widen the area."}
              />
            ) : (
              <>
                <p className="mb-3 text-[13px] font-semibold">
                  {result.full.length} {result.full.length === 1 ? "garage quotes" : "garages quote"} for all of it
                </p>
                <ul className={cx("grid gap-2.5 transition-opacity duration-200", pending && "opacity-50")}>
                  {result.full.slice(0, 6).map((q) => <QuoteRow key={q.garageId} q={q} band={band} />)}
                </ul>
              </>
            )}

            {result.partial.length > 0 && (
              <details className="mt-4 border-t border-line pt-4">
                <summary className="cursor-pointer text-[13px] font-medium text-ink2">
                  {result.partial.length} more cover only part of this
                </summary>
                <ul className="mt-3 grid gap-2.5">
                  {result.partial.slice(0, 4).map((q) => <QuoteRow key={q.garageId} q={q} band={band} partial />)}
                </ul>
              </details>
            )}
          </div>
        </Card>

        <Callout tone="neutral">
          Every figure is a price a garage published for this exact vehicle class. Nothing is averaged across car types
          or filled in where a garage has not quoted.
        </Callout>
      </aside>
    </div>
  );
}

function QuoteRow({ q, band, partial }: { q: GarageQuote; band: EstimateResult["band"]; partial?: boolean }) {
  const v = verdict(q.totalPaise, band);
  const d = deltaPct(q.totalPaise, band);
  const pos = bandPosition(q.totalPaise, band);

  return (
    <li>
      <Link href={`/garages/${q.slug}`}
        className={cx("lift block rounded-card border bg-surface p-3.5", partial ? "border-dashed border-line" : "border-line")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{q.name}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-ink2">
              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden />{q.locality ?? "Gurugram"}</span>
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" aria-hidden />{fmtDuration(q.estMinutes)}</span>
              {q.pickupDrop && <span className="inline-flex items-center gap-1"><Truck className="h-3 w-3" aria-hidden />Pickup</span>}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="tnum font-display text-[17px] font-bold leading-none">{formatINR(q.totalPaise)}</p>
            {v && !partial && (
              <p className={cx("tnum mt-1 text-[11px] font-semibold",
                v === "below" ? "text-success" : v === "above" ? "text-danger" : "text-ink3")}>
                {d === 0 ? VERDICT_LABEL.typical : `${d! > 0 ? "+" : ""}${d}% vs typical`}
              </p>
            )}
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-3">
          <Stamp level={q.verification} />
          {partial
            ? <span className="tnum text-[11px] font-medium text-warn">Prices {q.covered} of {q.requested}</span>
            : pos != null && (
              <span className="h-1 w-20 overflow-hidden rounded-full bg-surface2" aria-hidden>
                <span className="block h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${Math.max(4, pos * 100)}%` }} />
              </span>
            )}
        </div>
      </Link>
    </li>
  );
}

