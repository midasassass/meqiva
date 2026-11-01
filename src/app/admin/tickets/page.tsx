import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Badge, Empty, Field, PageTitle, Panel, SegmentedLinks, Select, Textarea } from "@/components/ui";
import { updateTicket } from "@/server/admin";
import { fmtDateTime, sentence } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Disputes" };

const OPEN = ["open", "in_progress", "awaiting_customer", "awaiting_garage"];

export default async function Tickets({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireRole("super_admin", "support_agent", "quality_auditor");
  const sp = await searchParams;
  const view = sp.view ?? "open";
  const sb = await supabaseServer();

  let q = sb.from("support_tickets")
    .select("id, category, priority, description, status, resolution, created_at, booking_id, garages(id, public_name), profiles!support_tickets_customer_id_fkey(full_name)")
    .order("created_at", { ascending: false }).limit(100);
  q = view === "open" ? q.in("status", OPEN) : q.in("status", ["resolved", "closed"]);

  const { data } = await q;
  const rows = (data ?? []) as unknown as {
    id: string; category: string; priority: string; description: string; status: string;
    resolution: string | null; created_at: string; booking_id: string | null;
    garages: { id: string; public_name: string } | null;
    profiles: { full_name: string | null } | null;
  }[];

  return (
    <>
      <PageTitle title="Disputes" sub="Raised by a customer on a booking. The garage is notified first; MEQIVA steps in when it is not resolved." />
      <SegmentedLinks
        current={view === "open" ? "/admin/tickets" : "/admin/tickets?view=closed"}
        items={[{ href: "/admin/tickets", label: "Open", count: rows.length }, { href: "/admin/tickets?view=closed", label: "Closed" }]}
      />

      <div className="mt-5">
        {rows.length === 0 ? (
          <Empty title={view === "open" ? "No open disputes" : "Nothing closed yet"} />
        ) : (
          <ul className="grid gap-4">
            {rows.map((t) => (
              <li key={t.id}>
                <Panel>
                  <div className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{t.category}</p>
                        <p className="tnum mt-0.5 text-[12.5px] text-ink2">
                          {t.profiles?.full_name ?? "Customer"}
                          {t.garages && <> · <Link href={`/admin/garages/${t.garages.id}`} className="underline">{t.garages.public_name}</Link></>}
                          {` · ${fmtDateTime(t.created_at)}`}
                        </p>
                      </div>
                      <Badge tone={t.status === "resolved" || t.status === "closed" ? "success" : t.status === "open" ? "danger" : "warn"}>
                        {sentence(t.status)}
                      </Badge>
                    </div>
                    <p className="mt-3 rounded-card bg-surface2 px-3 py-2.5 text-[13.5px] leading-relaxed">{t.description}</p>
                    {t.resolution && (
                      <p className="mt-2 text-[13px] text-ink2"><span className="font-medium text-ink">Outcome: </span>{t.resolution}</p>
                    )}
                  </div>

                  <div className="border-t border-line p-4">
                    <ActionForm action={updateTicket} submitLabel="Update ticket" variant="outline" size="sm">
                      <input type="hidden" name="id" value={t.id} />
                      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                        <Field label="Status">
                          <Select name="status" defaultValue={t.status}>
                            <option value="open">Open</option>
                            <option value="in_progress">In progress</option>
                            <option value="awaiting_customer">Waiting on customer</option>
                            <option value="awaiting_garage">Waiting on garage</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </Select>
                        </Field>
                        <Field label="Outcome" hint="What was agreed, and what either side has to do.">
                          <Textarea name="resolution" rows={2} maxLength={4000} defaultValue={t.resolution ?? ""} />
                        </Field>
                      </div>
                    </ActionForm>
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-6 max-w-[70ch] text-xs text-ink2">
        MEQIVA can mediate, require a garage to re-do work under its own warranty, coordinate a refund through the
        payment partner and suspend a garage. It cannot decide a legal dispute or pay a claim it has not agreed to
        underwrite.
      </p>
    </>
  );
}
