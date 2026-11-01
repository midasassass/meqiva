"use client";
import { useActionState } from "react";
import { Button, Callout, Textarea } from "@/components/ui";
import { EstimateSheet } from "@/components/estimate";
import { decideQuote } from "@/server/customer";
import type { ActionState } from "@/server/booking";
import { fmtDateTime } from "@/lib/format";

export interface PublicationLine { description: string; qty?: number; line_total_paise: number; mrp_paise?: number | null; kind?: string }

/**
 * The approval screen. It shows the reason, the work, the revised total and the
 * deadline — then records a decision that neither side can edit afterwards.
 */
export function ApprovalCard({ publication, bookingId }: {
  bookingId: string;
  publication: {
    id: string; version: number; reason: string | null; lines: PublicationLine[];
    subtotal_paise: number; tax_paise: number; total_paise: number;
    warranty_note: string | null; expires_at: string | null;
  };
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(decideQuote, {});

  if (state.ok) {
    return <Callout tone={state.message?.startsWith("Approved") ? "success" : "neutral"} title="Decision recorded">{state.message}</Callout>;
  }

  return (
    <div className="rounded-panel border-2 border-warn bg-surface">
      <div className="border-b border-line bg-warn-soft px-5 py-3">
        <p className="text-sm font-semibold text-warn">The garage has found extra work</p>
        <p className="mt-0.5 text-[12.5px] text-warn/80">
          Nothing below is charged unless you accept it. Work on the approved items continues either way.
        </p>
      </div>

      {publication.reason && (
        <div className="border-b border-line px-5 py-3">
          <p className="text-[13px] font-medium">Why</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-ink2">{publication.reason}</p>
        </div>
      )}

      <EstimateSheet
        className="border-0"
        heading={`Additional work — version ${publication.version}`}
        subheading={publication.expires_at ? `Valid until ${fmtDateTime(publication.expires_at)}` : undefined}
        lines={publication.lines.map((l) => ({
          description: l.description, qty: l.qty, amountPaise: Number(l.line_total_paise), mrpPaise: l.mrp_paise ?? null,
        }))}
        subtotalPaise={Number(publication.subtotal_paise)}
        taxPaise={Number(publication.tax_paise)}
        totalPaise={Number(publication.total_paise)}
        footnote={publication.warranty_note ?? undefined}
      />

      <form action={action} className="space-y-3 border-t border-line px-5 py-4">
        <input type="hidden" name="publicationId" value={publication.id} />
        <input type="hidden" name="bookingId" value={bookingId} />
        <Textarea name="reason" rows={2} maxLength={500} placeholder="Optional note to the garage — for example, do the brakes but leave the wipers." />
        {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" name="decision" value="approved" disabled={pending} size="lg">
            {pending ? "Recording…" : "Approve this work"}
          </Button>
          <Button type="submit" name="decision" value="rejected" variant="outline" size="lg" disabled={pending}>
            Decline
          </Button>
        </div>
      </form>
    </div>
  );
}
