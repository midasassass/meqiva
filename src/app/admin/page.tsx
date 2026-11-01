import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, Empty, PageTitle, Panel, Section, Stat } from "@/components/ui";
import { Stamp, type Level } from "@/components/stamp";
import { formatINR } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Overview" };

export default async function AdminHome() {
  await requireRole("super_admin", "quality_auditor", "support_agent");
  const sb = await supabaseServer();
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();

  const head = { count: "exact" as const, head: true };
  const [users, active, pending, verified, lapsing, bookings, completed, tickets, violations, commission, invoices] =
    await Promise.all([
      sb.from("profiles").select("id", head),
      sb.from("garages").select("id", head).eq("status", "active"),
      sb.from("garages").select("id", head).eq("status", "pending"),
      sb.from("garages").select("id", head).in("verification", ["verified", "quality_assured"]),
      sb.from("garages").select("id, public_name, slug, verification, verification_expires_at")
        .not("verification_expires_at", "is", null)
        .lt("verification_expires_at", new Date(Date.now() + 30 * 864e5).toISOString())
        .order("verification_expires_at").limit(5),
      sb.from("bookings").select("id", head).gte("created_at", monthAgo),
      sb.from("bookings").select("id", head).eq("status", "completed").gte("created_at", monthAgo),
      sb.from("support_tickets").select("id", head).in("status", ["open", "in_progress"]),
      sb.from("pricing_violations").select("id", head).is("resolved_at", null),
      sb.from("commission_records").select("fee_paise, gst_paise").gte("created_at", monthAgo),
      sb.from("invoices").select("total_paise").gte("issued_at", monthAgo),
    ]);

  const commissionTotal = (commission.data ?? []).reduce((a, c) => a + Number(c.fee_paise) + Number(c.gst_paise), 0);
  const gmv = (invoices.data ?? []).reduce((a, i) => a + Number(i.total_paise), 0);
  const lapsingSoon = (lapsing.data ?? []) as unknown as { id: string; public_name: string; slug: string; verification: Level; verification_expires_at: string }[];

  const queue = [
    (pending.count ?? 0) > 0 && { label: `${pending.count} garage application${pending.count === 1 ? "" : "s"} awaiting review`, href: "/admin/garages?status=pending" },
    (violations.count ?? 0) > 0 && { label: `${violations.count} blocked pricing attempt${violations.count === 1 ? "" : "s"} to review`, href: "/admin/compliance" },
    (tickets.count ?? 0) > 0 && { label: `${tickets.count} open dispute${tickets.count === 1 ? "" : "s"}`, href: "/admin/tickets" },
    lapsingSoon.length > 0 && { label: `${lapsingSoon.length} verification${lapsingSoon.length === 1 ? "" : "s"} lapsing within 30 days`, href: "/admin/audits" },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <>
      <PageTitle title="Platform overview" sub="Last 30 days unless stated." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="People" value={users.count ?? 0} />
        <Stat label="Active garages" value={active.count ?? 0} hint={`${verified.count ?? 0} inspected`} />
        <Stat label="Bookings" value={bookings.count ?? 0} hint={`${completed.count ?? 0} completed`} />
        <Stat label="Commission accrued" value={formatINR(commissionTotal)} hint={`on ${formatINR(gmv)} invoiced`} />
      </div>

      <Section title="Queue">
        {queue.length === 0 ? (
          <Card className="text-sm text-ink2">Nothing waiting. Applications, disputes and compliance are all clear.</Card>
        ) : (
          <ul className="grid gap-2.5">
            {queue.map((q) => (
              <li key={q.href}>
                <Link href={q.href}>
                  <div className="flex items-center justify-between gap-4 rounded-card border border-line bg-surface px-4 py-3 transition-colors hover:bg-surface2/60">
                    <span className="text-sm font-medium">{q.label}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Verifications lapsing soon">
        {lapsingSoon.length === 0 ? (
          <Empty title="Nothing lapsing in the next 30 days" />
        ) : (
          <Panel>
            <ul className="divide-y divide-line">
              {lapsingSoon.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <Link href={`/admin/garages/${g.id}`} className="text-sm font-medium hover:underline">{g.public_name}</Link>
                    <p className="tnum text-xs text-ink2">expires {fmtDate(g.verification_expires_at)}</p>
                  </div>
                  <Stamp level={g.verification} expiresAt={g.verification_expires_at} />
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </Section>
    </>
  );
}
