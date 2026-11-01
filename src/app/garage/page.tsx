import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ButtonLink, Card, Empty, PageTitle, Panel, Section, Stat, cx } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { fmtTime, sentence } from "@/lib/format";
import { buildInsights, type GarageSnapshot } from "@/lib/insights";
import { serviceDue } from "@/lib/reminders";
import { istYmd } from "@/lib/availability";
import { requireGarage } from "@/lib/session";

export const metadata = { title: "Overview" };

const SEVERITY = {
  urgent: "border-l-danger",
  attention: "border-l-warn",
  info: "border-l-line-strong",
} as const;

export default async function GarageOverview() {
  const { sb, garage } = await requireGarage();
  if (!garage) return null;

  const now = new Date();
  const today = istYmd(now);
  const dayStart = new Date(`${today}T00:00:00+05:30`);
  const dayEnd = new Date(dayStart.getTime() + 864e5);
  const weekAgo = new Date(now.getTime() - 7 * 864e5).toISOString();

  const [bookingsToday, jobs, quotesRes, partsRes, invoicesRes, ticketsRes, vehiclesRes, violationsRes, subRes] =
    await Promise.all([
      sb.from("bookings").select("id, status, slot_start, vehicles(vehicle_models(name, vehicle_makes(name)))")
        .eq("garage_id", garage.id).gte("slot_start", dayStart.toISOString()).lt("slot_start", dayEnd.toISOString())
        .neq("status", "cancelled").order("slot_start"),
      sb.from("job_cards").select("id, started_at, completed_at, technician_id, booking_id")
        .eq("garage_id", garage.id).is("completed_at", null),
      sb.from("quotes").select("id, customer_total_paise, status, created_at").eq("garage_id", garage.id).eq("status", "issued").gte("created_at", weekAgo),
      sb.from("parts").select("name, stock, reorder_at").eq("garage_id", garage.id),
      sb.from("invoices").select("total_paise, paid_paise, issued_at").eq("garage_id", garage.id).is("voided_at", null).gte("issued_at", weekAgo),
      sb.from("support_tickets").select("id", { count: "exact", head: true }).eq("garage_id", garage.id).in("status", ["open", "in_progress"]),
      sb.from("vehicles").select("id, odometer_km, last_service_on, last_service_km, vehicle_models(category), job_cards!inner(garage_id)")
        .eq("job_cards.garage_id", garage.id).limit(300),
      sb.from("pricing_violations").select("id", { count: "exact", head: true }).eq("garage_id", garage.id).is("resolved_at", null),
      sb.from("subscriptions").select("status, current_period_end, subscription_plans(name)").eq("garage_id", garage.id).maybeSingle(),
    ]);

  const todays = (bookingsToday.data ?? []) as unknown as {
    id: string; status: string; slot_start: string | null;
    vehicles: { vehicle_models: { name: string; vehicle_makes: { name: string } } } | null;
  }[];

  const openJobs = jobs.data ?? [];
  const parts = partsRes.data ?? [];
  const invoices = invoicesRes.data ?? [];
  const billed = invoices.reduce((a, r) => a + Number(r.total_paise), 0);
  const collected = invoices.reduce((a, r) => a + Number(r.paid_paise), 0);

  const vehicles = (vehiclesRes.data ?? []) as unknown as {
    id: string; odometer_km: number | null; last_service_on: string | null; last_service_km: number | null;
    vehicle_models: { category: string };
  }[];
  const dueCount = vehicles.filter((v) => serviceDue({
    vehicleId: v.id, category: v.vehicle_models.category, lastServiceOn: v.last_service_on,
    lastServiceKm: v.last_service_km, odometerKm: v.odometer_km,
  }, today).due).length;

  const sub = subRes.data as { status: string; current_period_end: string | null; subscription_plans: { name: string } | null } | null;
  const daysLeft = sub?.current_period_end
    ? Math.ceil((new Date(sub.current_period_end).getTime() - now.getTime()) / 864e5) : null;

  const busyBays = new Set(openJobs.filter((j) => j.started_at).map((j) => j.id)).size;

  const snapshot: GarageSnapshot = {
    unacceptedQuotes: quotesRes.data?.length ?? 0,
    unacceptedValuePaise: (quotesRes.data ?? []).reduce((a, q) => a + Number(q.customer_total_paise), 0),
    lowStock: parts.filter((p) => p.stock <= p.reorder_at).map((p) => ({ name: p.name, stock: p.stock, reorderAt: p.reorder_at })),
    pendingApprovals: todays.filter((b) => b.status === "awaiting_customer_approval").length,
    overdueJobs: 0,
    awaitingParts: todays.filter((b) => b.status === "awaiting_parts").length,
    uncollectedPaise: Math.max(0, billed - collected),
    dueForService: dueCount,
    openComplaints: ticketsRes.count ?? 0,
    bayUtilisationPct: garage.baysCount > 0 ? Math.min(100, (busyBays / garage.baysCount) * 100) : null,
    idleBaysToday: Math.max(0, garage.baysCount - busyBays),
    lowMarginCategories: [],
    mrpViolations: violationsRes.count ?? 0,
    subscriptionDaysLeft: daysLeft,
  };

  const insights = buildInsights(snapshot);

  return (
    <>
      <PageTitle
        title="Today"
        sub={sub?.subscription_plans?.name ? `${sub.subscription_plans.name} plan` : undefined}
        right={<>
          <ButtonLink href="/garage/jobs/new" size="sm" variant="outline">Walk-in job</ButtonLink>
          <ButtonLink href="/garage/quotes/new" size="sm">New quotation</ButtonLink>
        </>}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Booked today" value={todays.length} />
        <Stat label="Open job cards" value={openJobs.length} />
        <Stat label="Billed this week" value={formatINR(billed)} hint={`${formatINR(collected)} collected`} />
        <Stat label="Low stock" value={snapshot.lowStock.length} tone={snapshot.lowStock.length ? "warn" : "default"} />
      </div>

      <Section title="What needs you">
        {insights.length === 0 ? (
          <Card className="text-sm text-ink2">Nothing is waiting. Bays, stock and approvals are all clear.</Card>
        ) : (
          <ul className="grid gap-2.5">
            {insights.map((x) => (
              <li key={x.id}>
                <Link href={x.href}>
                  <div className={cx("flex items-start justify-between gap-4 rounded-card border border-l-[3px] border-line bg-surface px-4 py-3 transition-colors hover:bg-surface2/60", SEVERITY[x.severity])}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{x.title}</p>
                      {x.detail && <p className="mt-0.5 text-[12.5px] text-ink2">{x.detail}</p>}
                    </div>
                    <span className="flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-brand">
                      {x.action}<ArrowRight className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink2">
          Every card above is worked out from your own records. No AI provider is needed for these.
        </p>
      </Section>

      <Section title="Today's diary">
        {todays.length === 0 ? (
          <Empty title="Nothing booked for today" body="Walk-ins can be added straight to a job card." action={<ButtonLink href="/garage/jobs/new" variant="outline">Create a walk-in job</ButtonLink>} />
        ) : (
          <Panel>
            <ul className="divide-y divide-line">
              {todays.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="tnum w-16 shrink-0 text-[13px] text-ink2">{fmtTime(b.slot_start)}</span>
                    <span className="truncate text-sm">
                      {b.vehicles ? `${b.vehicles.vehicle_models.vehicle_makes.name} ${b.vehicles.vehicle_models.name}` : "Vehicle"}
                    </span>
                  </div>
                  <Link href={`/garage/bookings`} className="shrink-0 text-[12.5px] text-ink2 hover:text-ink">
                    {sentence(b.status)}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </Section>
    </>
  );
}
