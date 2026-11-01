import Link from "next/link";
import { Badge, ButtonLink, Empty, PageTitle, Panel, SegmentedLinks } from "@/components/ui";
import { fmtRelative } from "@/lib/format";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Job cards" };

export default async function Jobs({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { sb, garage } = await requireGarageOrRedirect();
  const sp = await searchParams;
  const filter = sp.filter ?? "open";

  let q = sb.from("job_cards")
    .select("id, origin, complaints, checked_in_at, started_at, completed_at, qc_passed, profiles!job_cards_technician_id_fkey(full_name), vehicles(reg_no, vehicle_models(name, vehicle_makes(name)))")
    .eq("garage_id", garage.id).order("checked_in_at", { ascending: false }).limit(100);
  if (filter === "open") q = q.is("completed_at", null);
  else if (filter === "done") q = q.not("completed_at", "is", null);
  else if (filter === "marketplace") q = q.eq("origin", "marketplace");
  else if (filter === "walk_in") q = q.eq("origin", "walk_in");

  const { data } = await q;
  const rows = (data ?? []) as unknown as {
    id: string; origin: string; complaints: string | null; checked_in_at: string | null;
    started_at: string | null; completed_at: string | null; qc_passed: boolean | null;
    profiles: { full_name: string | null } | null;
    vehicles: { reg_no: string | null; vehicle_models: { name: string; vehicle_makes: { name: string } } } | null;
  }[];

  return (
    <>
      <PageTitle
        title="Job cards"
        sub="Marketplace and walk-in work in one place. Origin is recorded on each card and decides commission."
        right={<ButtonLink href="/garage/jobs/new" size="sm">New job card</ButtonLink>}
      />
      <SegmentedLinks
        current={`/garage/jobs${filter === "open" ? "" : `?filter=${filter}`}`}
        items={[
          { href: "/garage/jobs", label: "Open" },
          { href: "/garage/jobs?filter=done", label: "Completed" },
          { href: "/garage/jobs?filter=marketplace", label: "From MEQIVA" },
          { href: "/garage/jobs?filter=walk_in", label: "Walk-ins" },
        ]}
      />

      <div className="mt-5">
        {rows.length === 0 ? (
          <Empty
            title="No job cards here"
            body="Open one for a walk-in, or check a booking in to create it automatically."
            action={<ButtonLink href="/garage/jobs/new">New job card</ButtonLink>}
          />
        ) : (
          <Panel>
            <ul className="divide-y divide-line">
              {rows.map((j) => (
                <li key={j.id}>
                  <Link href={`/garage/jobs/${j.id}`} className="flex items-start justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-surface2/60">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {j.vehicles
                          ? `${j.vehicles.vehicle_models.vehicle_makes.name} ${j.vehicles.vehicle_models.name}${j.vehicles.reg_no ? ` · ${j.vehicles.reg_no}` : ""}`
                          : "Walk-in vehicle"}
                      </p>
                      <p className="mt-0.5 truncate text-[12.5px] text-ink2">{j.complaints ?? "No complaint recorded"}</p>
                      <p className="tnum mt-1 text-[11.5px] text-ink2">
                        {j.profiles?.full_name ?? "Unassigned"} · in {fmtRelative(j.checked_in_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={j.completed_at ? "success" : j.started_at ? "brand" : "neutral"}>
                        {j.completed_at ? "Completed" : j.started_at ? "In progress" : "Queued"}
                      </Badge>
                      <Badge tone={j.origin === "marketplace" ? "warn" : "outline"}>
                        {j.origin === "marketplace" ? "MEQIVA" : j.origin === "fleet" ? "Fleet" : "Walk-in"}
                      </Badge>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </>
  );
}
