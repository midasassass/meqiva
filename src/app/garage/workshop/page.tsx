import Link from "next/link";
import { Badge, Card, Empty, PageTitle, Panel, Stat, cx } from "@/components/ui";
import { fmtRelative, fmtTime, sentence } from "@/lib/format";
import { istYmd } from "@/lib/availability";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Workshop board" };

export default async function Workshop() {
  const { sb, garage } = await requireGarageOrRedirect();
  const now = new Date();
  const today = istYmd(now);
  const dayStart = new Date(`${today}T00:00:00+05:30`);

  const [baysRes, jobsRes, bookingsRes] = await Promise.all([
    sb.from("service_bays").select("id, name").eq("garage_id", garage.id).eq("active", true).order("name"),
    sb.from("job_cards")
      .select("id, complaints, started_at, completed_at, checked_in_at, qc_passed, booking_id, technician_id, profiles!job_cards_technician_id_fkey(full_name), vehicles(reg_no, vehicle_models(name, vehicle_makes(name)))")
      .eq("garage_id", garage.id).is("completed_at", null).order("checked_in_at"),
    sb.from("bookings")
      .select("id, status, slot_start, slot_end, bay_id, vehicles(reg_no, vehicle_models(name, vehicle_makes(name)))")
      .eq("garage_id", garage.id).gte("slot_start", dayStart.toISOString())
      .not("status", "in", "(cancelled,completed)").order("slot_start"),
  ]);

  type Job = {
    id: string; complaints: string | null; started_at: string | null; checked_in_at: string | null;
    booking_id: string | null; technician_id: string | null;
    profiles: { full_name: string | null } | null;
    vehicles: { reg_no: string | null; vehicle_models: { name: string; vehicle_makes: { name: string } } } | null;
  };
  const jobs = (jobsRes.data ?? []) as unknown as Job[];
  const bays = baysRes.data ?? [];
  const bookings = (bookingsRes.data ?? []) as unknown as {
    id: string; status: string; slot_start: string | null; bay_id: string | null;
    vehicles: { reg_no: string | null; vehicle_models: { name: string; vehicle_makes: { name: string } } } | null;
  }[];

  const running = jobs.filter((j) => j.started_at);
  const queued = jobs.filter((j) => !j.started_at);
  const waiting = bookings.filter((b) => b.status === "awaiting_parts" || b.status === "awaiting_customer_approval");

  const label = (v: Job["vehicles"]) =>
    v ? `${v.vehicle_models.vehicle_makes.name} ${v.vehicle_models.name}${v.reg_no ? ` · ${v.reg_no}` : ""}` : "Vehicle";

  return (
    <>
      <PageTitle title="Workshop board" sub="What is on the floor right now." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Bays" value={garage.baysCount} hint={`${Math.max(0, garage.baysCount - running.length)} free`} />
        <Stat label="Running" value={running.length} />
        <Stat label="Queued" value={queued.length} />
        <Stat label="Held up" value={waiting.length} tone={waiting.length ? "warn" : "default"} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Panel title="In progress" className="lg:col-span-2">
          {running.length === 0 ? (
            <div className="p-5"><Empty title="Nothing started yet" body="Jobs appear here once a technician starts work." /></div>
          ) : (
            <ul className="divide-y divide-line">
              {running.map((j) => (
                <li key={j.id}>
                  <Link href={`/garage/jobs/${j.id}`} className="block px-4 py-3.5 transition-colors hover:bg-surface2/60">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{label(j.vehicles)}</p>
                        <p className="mt-0.5 truncate text-[12.5px] text-ink2">{j.complaints ?? "No complaint recorded"}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[12.5px] text-ink2">{j.profiles?.full_name ?? "Unassigned"}</p>
                        <p className="tnum text-[11.5px] text-ink2">started {fmtRelative(j.started_at)}</p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Waiting to start">
            {queued.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-ink2">Nothing queued.</p>
            ) : (
              <ul className="divide-y divide-line">
                {queued.map((j) => (
                  <li key={j.id} className="px-4 py-3">
                    <Link href={`/garage/jobs/${j.id}`} className="text-[13px] font-medium hover:underline">{label(j.vehicles)}</Link>
                    <p className="tnum mt-0.5 text-[11.5px] text-ink2">in {fmtRelative(j.checked_in_at)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Arriving today">
            {bookings.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-ink2">Nothing booked for the rest of today.</p>
            ) : (
              <ul className="divide-y divide-line">
                {bookings.slice(0, 8).map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                    <span className="tnum w-14 shrink-0 text-[12.5px] text-ink2">{fmtTime(b.slot_start)}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {b.vehicles ? `${b.vehicles.vehicle_models.vehicle_makes.name} ${b.vehicles.vehicle_models.name}` : "Vehicle"}
                    </span>
                    <Badge tone={b.status === "awaiting_customer_approval" ? "warn" : "neutral"}>{sentence(b.status)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {bays.length > 0 && (
        <div className="mt-8">
          <Panel title="Bays" description="A bay can only hold one booking at a time — the database refuses an overlap.">
            <ul className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
              {bays.map((bay, i) => {
                const job = running[i];
                return (
                  <li key={bay.id} className={cx("bg-surface p-4", !job && "bg-surface2/40")}>
                    <p className="text-[13px] font-medium">{bay.name}</p>
                    <p className="mt-1 text-[12.5px] text-ink2">{job ? label(job.vehicles) : "Free"}</p>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      )}

      {bays.length === 0 && (
        <Card className="mt-8 text-[13px] text-ink2">
          No bays are set up yet. Add them so MEQIVA can work out how many jobs you can genuinely take at once.
        </Card>
      )}
    </>
  );
}
