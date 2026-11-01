import type { ReactNode } from "react";
import { formatINR, type Paise } from "@/lib/money";
import { cx } from "./ui";

/**
 * The estimate sheet — the object the whole brand is built around. Dotted leaders
 * and tabular figures belong here and in invoices, nowhere else in the product.
 */

export interface EstimateLine {
  description: string;
  note?: string | null;
  qty?: number;
  amountPaise: Paise;
  /** Marks a line as covered by a printed MRP, which is already tax-inclusive. */
  mrpPaise?: Paise | null;
}

export function EstimateSheet({
  heading, subheading, lines, subtotalPaise, taxPaise, totalPaise, footnote, aside, dense, className,
}: {
  heading: string;
  subheading?: string;
  lines: EstimateLine[];
  subtotalPaise: Paise;
  taxPaise: Paise;
  totalPaise: Paise;
  footnote?: ReactNode;
  aside?: ReactNode;
  dense?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("rounded-panel border border-line bg-surface", className)}>
      <header className="border-b border-line px-5 py-4">
        <p className="text-[15px] font-semibold leading-tight">{heading}</p>
        {subheading && <p className="mt-1 text-[13px] text-ink2">{subheading}</p>}
      </header>

      <div className={cx("px-5", dense ? "py-3" : "py-4")}>
        <ul className={cx("space-y-2.5", dense && "space-y-2")}>
          {lines.map((l, i) => (
            <li key={i}>
              <div className="leader text-sm">
                <span className="min-w-0">
                  {l.description}
                  {l.qty != null && l.qty !== 1 && <span className="tnum text-ink2"> ×{l.qty}</span>}
                </span>
                <span className="tnum font-medium">{formatINR(l.amountPaise)}</span>
              </div>
              {(l.note || l.mrpPaise != null) && (
                <p className="mt-0.5 text-[11.5px] text-ink2">
                  {l.mrpPaise != null && <span className="tnum">Printed MRP {formatINR(l.mrpPaise)}, tax included. </span>}
                  {l.note}
                </p>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-2 border-t border-line pt-3">
          <div className="leader text-[13px] text-ink2">
            <span>Subtotal</span><span className="tnum">{formatINR(subtotalPaise)}</span>
          </div>
          <div className="leader text-[13px] text-ink2">
            <span>GST</span><span className="tnum">{formatINR(taxPaise)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-line pt-3">
            <span className="text-sm font-medium">You pay</span>
            <span className="tnum text-2xl font-semibold tracking-tight">{formatINR(totalPaise)}</span>
          </div>
        </div>
      </div>

      {(footnote || aside) && (
        <footer className="rounded-b-panel border-t border-line bg-surface2/60 px-5 py-3">
          {footnote && <p className="text-[12px] leading-relaxed text-ink2">{footnote}</p>}
          {aside}
        </footer>
      )}
    </div>
  );
}

/** Compact price breakdown used inside comparison rows. */
export function PriceBreakdown({ parts, labour, consumables, tax }: {
  parts: Paise; labour: Paise; consumables: Paise; tax: Paise;
}) {
  const rows: [string, Paise][] = [["Parts", parts], ["Labour", labour], ["Consumables", consumables], ["GST", tax]];
  return (
    <dl className="grid grid-cols-2 gap-x-5 gap-y-1 text-[12.5px] sm:grid-cols-4">
      {rows.filter(([, v]) => v > 0).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2 sm:block">
          <dt className="text-ink2">{k}</dt>
          <dd className="tnum font-medium">{formatINR(v)}</dd>
        </div>
      ))}
    </dl>
  );
}
