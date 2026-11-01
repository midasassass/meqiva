import Link from "next/link";
import { Badge, ButtonLink, Card, Empty, PageTitle, SegmentedLinks } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { fmtDateTime, sentence } from "@/lib/format";
import { requireUser } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Bookings" };

const LIVE = ["requested", "awaiting_garage_confirmation", "confirmed", "vehicle_arrived", "inspection_in_progress",
  "awaiting_customer_approval", "awaiting_parts", "service_in_progress", "quality_check", "ready_for_delivery"];

const TONE = (s: string) =>
  s === "awaiting_customer_approval" ? "warn" : s === "completed" ? "success" : s === "cancelled" ? "neutral" : s === "disputed" ? "danger" : "brand";

export default async function Bookings({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireUser();
  const sp = await searchParams;
  const filter = sp.filter === "past" ? "past" : "active";

  const sb = await supabaseServer();
  let q = sb.from("bookings")
    .select("id, status, slot_start, quoted_total_paise, garages(public_name), vehicles(vehicle_models(name, vehicle_makes(name)))")
    .order("slot_start", { ascending: false }).limit(50);
  q = filter === "active" ? q.in("status", LIVE) : q.in("status", ["completed", "cancelled", "disputed"]);
  const { data } = await q;

  const rows = (data ?? []) as unknown as {
    id: string; status: string; slot_start: string | null; quoted_total_paise: number | null;
    garages: { public_name: string };
    vehicles: { vehicle_models: { name: string; vehicle_makes: { name: string } } } | null;
  }[];

  return (
    <>
      <PageTitle title="Bookings" right={<ButtonLink href="/find" size="sm">Book a service</ButtonLink>} />
      <SegmentedLinks
        current={filter === "past" ? "/app/bookings?filter=past" : "/app/bookings"}
        items={[{ href: "/app/bookings", label: "Active" }, { href: "/app/bookings?filter=past", label: "Past" }]}
      />

      <div className="mt-5">
        {rows.length === 0 ? (
          <Empty
            title={filter === "active" ? "Nothing booked right now" : "No past bookings"}
            body={filter === "active" ? "Compare garages and book a service with the full price shown up front." : undefined}
            action={filter === "active" ? <ButtonLink href="/find">Compare garages</ButtonLink> : undefined}
          />
        ) : (
          <ul className="grid gap-3">
            {rows.map((b) => (
              <li key={b.id}>
                <Link href={`/app/bookings/${b.id}`}>
                  <Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-surface2/50">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{b.garages.public_name}</p>
                      <p className="tnum mt-0.5 text-[12.5px] text-ink2">
                        {b.vehicles && `${b.vehicles.vehicle_models.vehicle_makes.name} ${b.vehicles.vehicle_models.name} · `}
                        {fmtDateTime(b.slot_start)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {b.quoted_total_paise != null && <span className="tnum text-sm font-medium">{formatINR(Number(b.quoted_total_paise))}</span>}
                      <Badge tone={TONE(b.status)}>{sentence(b.status)}</Badge>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
