import { ActionButton } from "@/components/action-form";
import { Badge, Empty, PageTitle, Panel, SegmentedLinks, Stat, Table, Td, Tr } from "@/components/ui";
import { closeFollowUp } from "@/server/garage-ops";
import { formatINR } from "@/lib/money";
import { fmtDate, fmtPhone } from "@/lib/format";
import { serviceDue } from "@/lib/reminders";
import { istYmd } from "@/lib/availability";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Customers" };

export default async function Crm({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { sb, garage } = await requireGarageOrRedirect();
  const sp = await searchParams;
  const tab = sp.tab ?? "customers";
  const today = istYmd(new Date());

  const [jobsRes, followRes, lostRes] = await Promise.all([
    sb.from("job_cards")
      .select("id, customer_id, completed_at, profiles!job_cards_customer_id_fkey(full_name, phone), vehicles(id, odometer_km, last_service_on, last_service_km, reg_no, vehicle_models(name, category, vehicle_makes(name)))")
      .eq("garage_id", garage.id).order("checked_in_at", { ascending: false }).limit(300),
    sb.from("follow_ups")
      .select("id, kind, due_on, note, customer_id, profiles(full_name, phone)")
      .eq("garage_id", garage.id).is("closed_at", null).order("due_on").limit(100),
    sb.from("quotes").select("id, customer_total_paise, created_at, job_cards(profiles!job_cards_customer_id_fkey(full_name, phone))")
      .eq("garage_id", garage.id).eq("status", "issued").order("created_at", { ascending: false }).limit(50),
  ]);

  type Job = {
    id: string; customer_id: string | null; completed_at: string | null;
    profiles: { full_name: string | null; phone: string | null } | null;
    vehicles: { id: string; odometer_km: number | null; last_service_on: string | null; last_service_km: number | null; reg_no: string | null; vehicle_models: { name: string; category: string; vehicle_makes: { name: string } } } | null;
  };
  const jobs = (jobsRes.data ?? []) as unknown as Job[];
  const follows = (followRes.data ?? []) as unknown as { id: string; kind: string; due_on: string; note: string | null; profiles: { full_name: string | null; phone: string | null } | null }[];
  const lost = (lostRes.data ?? []) as unknown as { id: string; customer_total_paise: number; created_at: string; job_cards: { profiles: { full_name: string | null; phone: string | null } | null } | null }[];

  // One row per customer, with how many visits and when they were last in.
  const byCustomer = new Map<string, { name: string; phone: string | null; visits: number; last: string | null }>();
  for (const j of jobs) {
    if (!j.customer_id) continue;
    const e = byCustomer.get(j.customer_id) ?? { name: j.profiles?.full_name ?? "Customer", phone: j.profiles?.phone ?? null, visits: 0, last: null };
    e.visits += 1;
    if (j.completed_at && (!e.last || j.completed_at > e.last)) e.last = j.completed_at;
    byCustomer.set(j.customer_id, e);
  }

  const seen = new Set<string>();
  const dueVehicles = jobs
    .filter((j) => j.vehicles && !seen.has(j.vehicles.id) && seen.add(j.vehicles.id))
    .map((j) => ({
      job: j,
      due: serviceDue({
        vehicleId: j.vehicles!.id, category: j.vehicles!.vehicle_models.category,
        lastServiceOn: j.vehicles!.last_service_on, lastServiceKm: j.vehicles!.last_service_km,
        odometerKm: j.vehicles!.odometer_km,
      }, today),
    }))
    .filter((x) => x.due.due);

  const tabs = [
    { href: "/garage/crm", label: "Customers", count: byCustomer.size },
    { href: "/garage/crm?tab=due", label: "Due for service", count: dueVehicles.length },
    { href: "/garage/crm?tab=quotes", label: "Unaccepted quotes", count: lost.length },
    { href: "/garage/crm?tab=follow", label: "Follow-ups", count: follows.length },
  ];

  return (
    <>
      <PageTitle title="Customers" sub="Who comes back, who is due, and who never answered the quote." />
      <SegmentedLinks current={tab === "customers" ? "/garage/crm" : `/garage/crm?tab=${tab}`} items={tabs} />

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Customers" value={byCustomer.size} />
        <Stat label="Due for service" value={dueVehicles.length} tone={dueVehicles.length ? "warn" : "default"} />
        <Stat label="Quotes waiting" value={lost.length} />
        <Stat label="Open follow-ups" value={follows.length} />
      </div>

      <div className="mt-6">
        {tab === "customers" && (
          byCustomer.size === 0
            ? <Empty title="No customer records yet" body="A customer record is created the first time you open a job card for them." />
            : <Panel>
                <Table head={["Customer", "Phone", "Visits", "Last in"]}>
                  {[...byCustomer.entries()].map(([id, c]) => (
                    <Tr key={id}>
                      <Td className="font-medium">{c.name}</Td>
                      <Td className="tnum text-[13px] text-ink2">{fmtPhone(c.phone)}</Td>
                      <Td className="tnum">{c.visits}</Td>
                      <Td className="tnum text-right text-[13px] text-ink2">{c.last ? fmtDate(c.last) : "—"}</Td>
                    </Tr>
                  ))}
                </Table>
              </Panel>
        )}

        {tab === "due" && (
          dueVehicles.length === 0
            ? <Empty title="Nobody is due right now" body="Vehicles appear here from their mileage and their last service date." />
            : <Panel>
                <Table head={["Vehicle", "Customer", "Why"]}>
                  {dueVehicles.map(({ job, due }) => (
                    <Tr key={job.vehicles!.id}>
                      <Td>
                        <p className="font-medium">{job.vehicles!.vehicle_models.vehicle_makes.name} {job.vehicles!.vehicle_models.name}</p>
                        <p className="tnum text-xs text-ink2">{job.vehicles!.reg_no}</p>
                      </Td>
                      <Td className="text-[13px]">
                        {job.profiles?.full_name ?? "—"}
                        <span className="tnum block text-xs text-ink2">{fmtPhone(job.profiles?.phone)}</span>
                      </Td>
                      <Td className="text-[13px] text-ink2">{due.reason}</Td>
                    </Tr>
                  ))}
                </Table>
                <p className="border-t border-line px-4 py-3 text-xs text-ink2">
                  Reminders go out only to customers who have agreed to be contacted, and only through a channel MEQIVA
                  has credentials for.
                </p>
              </Panel>
        )}

        {tab === "quotes" && (
          lost.length === 0
            ? <Empty title="No quotes left hanging" body="Quotations you have sent that nobody has answered show up here." />
            : <Panel>
                <Table head={["Customer", "Sent", "Value"]}>
                  {lost.map((q) => (
                    <Tr key={q.id}>
                      <Td>
                        <p className="font-medium">{q.job_cards?.profiles?.full_name ?? "Customer"}</p>
                        <p className="tnum text-xs text-ink2">{fmtPhone(q.job_cards?.profiles?.phone)}</p>
                      </Td>
                      <Td className="tnum text-[13px] text-ink2">{fmtDate(q.created_at)}</Td>
                      <Td className="tnum text-right font-medium">{formatINR(Number(q.customer_total_paise))}</Td>
                    </Tr>
                  ))}
                </Table>
              </Panel>
        )}

        {tab === "follow" && (
          follows.length === 0
            ? <Empty title="No open follow-ups" body="Add one from a quote or a complaint and it appears here on its due date." />
            : <Panel>
                <ul className="divide-y divide-line">
                  {follows.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{f.profiles?.full_name ?? "Customer"}</p>
                        <p className="tnum text-xs text-ink2">
                          due {fmtDate(f.due_on)} · {f.kind.replace(/_/g, " ")}
                          {f.profiles?.phone && ` · ${fmtPhone(f.profiles.phone)}`}
                        </p>
                        {f.note && <p className="mt-0.5 text-[12.5px] text-ink2">{f.note}</p>}
                      </div>
                      <div className="flex gap-1.5">
                        <ActionButton action={closeFollowUp} label="Won" variant="outline" hidden={{ id: f.id, outcome: "won" }} />
                        <ActionButton action={closeFollowUp} label="Lost" variant="ghost" hidden={{ id: f.id, outcome: "lost" }} />
                        <ActionButton action={closeFollowUp} label="No answer" variant="ghost" hidden={{ id: f.id, outcome: "no_response" }} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
        )}
      </div>

      {dueVehicles.length > 0 && tab === "customers" && (
        <p className="mt-4 text-xs text-ink2">
          <Badge tone="warn">{dueVehicles.length}</Badge> vehicles are due for a service. Open the due tab to see who to call.
        </p>
      )}
    </>
  );
}
