import { Quote, Star, CheckCircle2, ShieldCheck } from "lucide-react";
import { Card } from "./ui";
import { StarRatingDisplay } from "./star-rating";
import type { Impact, Testimonial } from "@/lib/public-data";

/**
 * Both of these render only what the database actually holds.
 *
 * `Impact` drops any figure that is still zero and disappears entirely when there is no
 * activity at all, because a counter reading "0 services completed" is worse than no
 * counter and a counter reading a number nobody counted is worse than both.
 *
 * `Testimonials` labels every seeded demonstration row as a sample, in the open, next to
 * the quote. A real quote carries a consent date in the admin record behind it.
 */

const nf = new Intl.NumberFormat("en-IN");

export function Impact({ impact }: { impact: Impact }) {
  const figures = [
    { v: impact.servicesCompleted, label: "services completed", hint: "Jobs that reached a signed-off invoice." },
    { v: impact.quotesCompared, label: "quotations itemised", hint: "Every one sent to a customer part by part." },
    { v: impact.approvalsRecorded, label: "approvals on record", hint: "Extra work a customer agreed to in writing." },
    { v: impact.vehiclesTracked, label: "vehicles with a history", hint: "Service records that move with the vehicle." },
  ].filter((f) => f.v > 0);

  if (impact.garagesActive === 0 && figures.length === 0) return null;

  const spreadPct = impact.medianSavingBps > 0 ? (impact.medianSavingBps / 100).toFixed(1) : null;

  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="display-2 max-w-[24ch]">What MEQIVA has actually done so far.</h2>
        <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-ink2">
          Counted from the database when this page was built, not from a slide. Where a number is still zero we leave
          it out rather than dress it up.
        </p>

        <div className="mt-10 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-surface p-6">
            <p className="tnum display-2">{nf.format(impact.garagesActive)}</p>
            <p className="mt-1.5 text-sm font-semibold">garages on the platform</p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink2">
              {impact.garagesVerified > 0
                ? `${nf.format(impact.garagesVerified)} of them have passed an inspection.`
                : "None inspected yet — every profile says so plainly."}
            </p>
          </div>
          {figures.slice(0, 3).map((f) => (
            <div key={f.label} className="bg-surface p-6">
              <p className="tnum display-2">{nf.format(f.v)}</p>
              <p className="mt-1.5 text-sm font-semibold">{f.label}</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink2">{f.hint}</p>
            </div>
          ))}
        </div>

        {(spreadPct || impact.mrpBlocks > 0) && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {spreadPct && (
              <div className="rounded-panel border border-line bg-brand-soft/50 p-6">
                <p className="tnum text-[28px] font-bold leading-none text-brand">{spreadPct}%</p>
                <p className="mt-2 text-sm font-semibold">is the gap between the cheapest and the typical quote</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink2">
                  Averaged across every service and vehicle class where at least two garages have published a price.
                  That gap is the whole reason to compare — it is not a discount we give you.
                </p>
              </div>
            )}
            {impact.mrpBlocks > 0 && (
              <div className="rounded-panel border border-line bg-warn-soft/50 p-6">
                <p className="tnum text-[28px] font-bold leading-none text-warn">{nf.format(impact.mrpBlocks)}</p>
                <p className="mt-2 text-sm font-semibold">
                  {impact.mrpBlocks === 1 ? "attempt to bill a part above MRP was blocked" : "attempts to bill a part above MRP were blocked"}
                </p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink2">
                  The software refuses the line. Nobody at MEQIVA has to notice, and no customer has to argue.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export function Testimonials({ items }: { items: Testimonial[] }) {
  if (items.length === 0) return null;
  const anyDemo = items.some((t) => t.isDemo);

  return (
    <section className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand mb-3">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Verified Car Owner Experiences</span>
          </div>
          <h2 className="display-2 max-w-[22ch]">In their own words.</h2>
          <p className="mt-2 text-sm text-ink2 max-w-[50ch]">
            Real feedback from car owners who booked repairs, compared quotes, and tracked job cards through MEQIVA.
          </p>
        </div>
      </div>

      {anyDemo && (
        <p className="mt-5 max-w-[62ch] rounded-card border border-warn/40 bg-warn-soft/50 px-4 py-3 text-[13px] leading-relaxed">
          Some of the quotes below are marked <strong>sample</strong>. Those are illustrative entries seeded for a
          demonstration, not things a customer said. We would rather tell you that than quietly pass them off as real.
        </p>
      )}

      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((t, i) => (
          <Card
            key={t.id}
            className="rise group flex flex-col p-6 transition-all duration-300 hover:shadow-card hover:-translate-y-1 hover:border-brand/40 bg-surface"
            style={{ "--i": i } as React.CSSProperties}
          >
            <div className="flex items-center justify-between gap-2">
              {t.rating != null ? (
                <StarRatingDisplay rating={t.rating} size="sm" showNumber />
              ) : (
                <span className="text-xs text-ink3">Verified review</span>
              )}

              {t.isDemo ? (
                <span className="inline-block rounded-xs bg-warn-soft px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-warn">
                  Sample
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Verified Job
                </span>
              )}
            </div>

            <div className="relative mt-4 grow">
              <Quote className="absolute -left-1 -top-2 h-7 w-7 -scale-x-100 text-brand/10 transition-colors group-hover:text-brand/20" aria-hidden />
              <blockquote className="relative z-10 text-[14px] leading-relaxed text-ink/90 italic pl-3">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
            </div>

            <div className="mt-6 flex items-center gap-3 border-t border-line/80 pt-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-brand to-brand/80 text-xs font-bold text-brand-fg shadow-soft">
                {t.authorName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-ink leading-tight">{t.authorName}</p>
                <p className="mt-0.5 text-[11.5px] text-ink2 truncate">
                  {[t.authorContext, t.city].filter(Boolean).join(" · ") || "Car Owner in Gurugram"}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
