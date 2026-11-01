import Link from "next/link";
import { Badge, ButtonLink, Empty, PageTitle, Panel, SegmentedLinks } from "@/components/ui";
import { ActionButton } from "@/components/action-form";
import { moveBooking } from "@/server/booking";
import { formatINR } from "@/lib/money";
import { fmtDateTime, fmtPhone, sentence } from "@/lib/format";
import { nextStatuses, type BookingStatus } from "@/lib/booking";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Bookings" };

const LIVE = ["requested", "awaiting_garage_confirmation", "confirmed", "vehicle_arrived", "inspection_in_progress",
  "awaiting_customer_approval", "awaiting_parts", "service_in_progress", "quality_check", "ready_for_delivery"];

const NEXT_LABEL: Partial<Record<BookingStatus, string>> = {
  confirmed: "Accept", vehicle_arrived: "Vehicle arrived", inspection_in_progress: "Start inspection",
  service_in_progress: "Start work", awaiting_parts: "Waiting on parts", quality_check: "Send to quality check",
  ready_for_delivery: "Ready for collection", completed: "Complete", cancelled: "Decline",
  awaiting_customer_approval: "Needs customer approval",
};

export default async function GarageBookings({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { sb, garage } = await requireGarageOrRedirect();
  const sp = await searchParams;
  const filter = sp.filter ?? "live";

  let q = sb.from("bookings")
    .select("id, status, origin, slot_start, quoted_total_paise, customer_note, pickup_requested, walk_in_name, profiles(full_name, phone), vehicles(reg_no, vehicle_models(name, vehicle_makes(name)))")
    .eq("garage_id", garage.id).order("slot_start", { ascending: true, nullsFirst: false }).limit(100);
  if (filter === "live") q = q.in("status", LIVE);
  else if (filter === "new") q = q.eq("status", "awaiting_garage_confirmation");
  else q = q.in("status", ["completed", "cancelled", "disputed"]);

  const { data } = await q;
  const rows = (data ?? []) as unknown as {
    id: string; status: BookingStatus; origin: string; slot_start: string | null; quoted_total_paise: number | null;
    customer_note: string | null; pickup_requested: boolean; walk_in_name: string | null;
    profiles: { full_name: string | null; phone: string | null } | null;
    vehicles: { reg_no: string | null; vehicle_models: { name: string; vehicle_makes: { name: string } } } | null;
  }[];

  return (
    <>
      <PageTitle title="Bookings" sub="Accept, move along, or check in to open a job card." />
      <SegmentedLinks
        current={filter === "live" ? "/garage/bookings" : `/garage/bookings?filter=${filter}`}
        items={[
          { href: "/garage/bookings", label: "Live" },
          { href: "/garage/bookings?filter=new", label: "Needs a decision" },
          { href: "/garage/bookings?filter=past", label: "Past" },
        ]}
      />

      <div className="mt-5">
        {rows.length === 0 ? (
          <Empty title="Nothing here" body="New requests from MEQIVA land in this list, and you accept or decline them." />
        ) : (
          <ul className="grid gap-3">
            {rows.map((b) => {
              const options = nextStatuses(b.status, garage.isOwner ? "garage_owner" : "service_advisor");
              return (
                <li key={b.id}>
                  <Panel>
                    <div className="flex flex-wrap items-start justify-between gap-4 p-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">
                            {b.vehicles
                              ? `${b.vehicles.vehicle_models.vehicle_makes.name} ${b.vehicles.vehicle_models.name}`
                              : "Vehicle"}
                          </p>
                          <Badge tone={b.origin === "marketplace" ? "warn" : "outline"}>
                            {b.origin === "marketplace" ? "MEQIVA" : "Walk-in"}
                          </Badge>
                          {b.pickup_requested && <Badge tone="outline">Pickup</Badge>}
                        </div>
                        <p className="tnum mt-1 text-[12.5px] text-ink2">
                          {b.profiles?.full_name ?? b.walk_in_name ?? "Customer"}
                          {b.profiles?.phone && ` · ${fmtPhone(b.profiles.phone)}`}
                          {` · ${fmtDateTime(b.slot_start)}`}
                          {b.vehicles?.reg_no && ` · ${b.vehicles.reg_no}`}
                        </p>
                        {b.customer_note && <p className="mt-1.5 text-[13px] text-ink2">{b.customer_note}</p>}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <Badge tone={b.status === "awaiting_customer_approval" ? "warn" : "brand"}>{sentence(b.status)}</Badge>
                        {b.quoted_total_paise != null && (
                          <span className="tnum text-sm font-medium">{formatINR(Number(b.quoted_total_paise))}</span>
                        )}
                      </div>
                    </div>

                    {options.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
                        {options.map((to) => (
                          <ActionButton key={to} action={moveBooking} label={NEXT_LABEL[to] ?? sentence(to)}
                            variant={to === "cancelled" ? "ghost" : "outline"}
                            hidden={{ bookingId: b.id, to }}
                            confirm={to === "cancelled" ? "Decline this booking? The customer is told straight away." : undefined} />
                        ))}
                        {b.status === "vehicle_arrived" && (
                          <ButtonLink href={`/garage/jobs/new?booking=${b.id}`} size="sm">Open job card</ButtonLink>
                        )}
                      </div>
                    )}
                  </Panel>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-6 text-xs text-ink2">
        Each move is checked by the database against who you are and where the booking currently stands, so a status
        can never jump somewhere it should not. <Link href="/garage/workshop" className="underline">Workshop board</Link>
      </p>
    </>
  );
}
