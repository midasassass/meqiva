import Link from "next/link";
import { Badge, ButtonLink, Callout, Card, Empty, PageTitle, Panel, Section, Stat } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { fmtDateTime, sentence } from "@/lib/format";
import { serviceDue } from "@/lib/reminders";
import { requireUser } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { istYmd } from "@/lib/availability";

export const metadata = { title: "Home" };

const LIVE = ["requested", "awaiting_garage_confirmation", "confirmed", "vehicle_arrived", "inspection_in_progress",
  "awaiting_customer_approval", "awaiting_parts", "service_in_progress", "quality_check", "ready_for_delivery"];

export default async function CustomerHome() {
  const u = await requireUser();
  const sb = await supabaseServer();
  const today = istYmd(new Date());

  const [vehiclesRes, bookingsRes, pendingRes, spendRes] = await Promise.all([
    sb.from("vehicles").select("id, year, odometer_km, last_service_on, last_service_km, vehicle_models(name, category, vehicle_makes(name))"),
    sb.from("bookings").select("id, status, slot_start, garages(public_name, slug)").in("status", LIVE).order("slot_start").limit(5),
    sb.from("quote_publications").select("id, total_paise, extra_work, booking_id, published_at").eq("customer_id", u.id).eq("extra_work", true).order("published_at", { ascending: false }).limit(10),
    sb.from("invoices").select("total_paise").eq("customer_id", u.id),
  ]);

  type V = { id: string; year: number | null; odometer_km: number | null; last_service_on: string | null; last_service_km: number | null; vehicle_models: { name: string; category: string; vehicle_makes: { name: string } } };
  const vehicles = (vehiclesRes.data ?? []) as unknown as V[];
  const live = (bookingsRes.data ?? []) as unknown as { id: string; status: string; slot_start: string | null; garages: { public_name: string; slug: string } }[];

  // An approval is outstanding when the customer has not yet decided on a published extra-work quote.
  const pubIds = (pendingRes.data ?? []).map((p) => p.id);
  let awaiting: typeof pendingRes.data = [];
  if (pubIds.length) {
    const { data: decided } = await sb.from("customer_approvals").select("publication_id").in("publication_id", pubIds);
    const done = new Set((decided ?? []).map((d) => d.publication_id));
    awaiting = (pendingRes.data ?? []).filter((p) => !done.has(p.id));
  }

  const due = vehicles
    .map((v) => ({ v, r: serviceDue({
      vehicleId: v.id, category: v.vehicle_models.category, lastServiceOn: v.last_service_on,
      lastServiceKm: v.last_service_km, odometerKm: v.odometer_km }, today) }))
    .filter((x) => x.r.due);

  const spend = (spendRes.data ?? []).reduce((a, r) => a + Number(r.total_paise), 0);
  const first = u.fullName?.split(" ")[0];

  return (
    <>
      <PageTitle
        title={first ? `Hello, ${first}` : "Your account"}
        sub="Your vehicles, what is being worked on, and anything waiting on you."
        right={<ButtonLink href="/find">Book a service</ButtonLink>}
      />

      {awaiting.length > 0 && (
        <Callout tone="warn" title={`${awaiting.length} ${awaiting.length === 1 ? "approval is" : "approvals are"} waiting on you`}>
          A garage has found extra work and stopped until you decide.{" "}
          {awaiting.map((a) => (
            <Link key={a.id} href={`/app/bookings/${a.booking_id}`} className="font-medium text-ink underline">
              Review {formatINR(Number(a.total_paise))}
            </Link>
          ))}
        </Callout>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Vehicles" value={vehicles.length} />
        <Stat label="In progress" value={live.length} />
        <Stat label="Due for service" value={due.length} tone={due.length ? "warn" : "default"} />
        <Stat label="Spent through MEQIVA" value={formatINR(spend)} />
      </div>

      <Section title="Being worked on">
        {live.length === 0 ? (
          <Empty
            title="Nothing in the workshop"
            body="When you book a service it appears here, and you can follow each step as it happens."
            action={<ButtonLink href="/find">Compare garages</ButtonLink>}
          />
        ) : (
          <ul className="grid gap-3">
            {live.map((b) => (
              <li key={b.id}>
                <Link href={`/app/bookings/${b.id}`}>
                  <Card className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-surface2/50">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{b.garages.public_name}</p>
                      <p className="tnum mt-0.5 text-[12.5px] text-ink2">{fmtDateTime(b.slot_start)}</p>
                    </div>
                    <Badge tone={b.status === "awaiting_customer_approval" ? "warn" : "brand"}>{sentence(b.status)}</Badge>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {due.length > 0 && (
        <Section title="Due for service">
          <Panel>
            <ul className="divide-y divide-line">
              {due.map(({ v, r }) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0">
                    <Link href={`/app/vehicles/${v.id}`} className="font-medium hover:underline">
                      {v.vehicle_models.vehicle_makes.name} {v.vehicle_models.name}
                    </Link>
                    <p className="mt-0.5 text-[12.5px] text-ink2">{r.reason}</p>
                  </div>
                  <ButtonLink href="/find" size="sm" variant="outline">Book it in</ButtonLink>
                </li>
              ))}
            </ul>
          </Panel>
        </Section>
      )}
    </>
  );
}
