import Link from "next/link";
import { Badge, ButtonLink, Empty, PageTitle, Panel, SegmentedLinks, Table, Td, Tr } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Quotations" };

const TONE: Record<string, "neutral" | "warn" | "success" | "danger"> = {
  draft: "neutral", issued: "warn", approved: "success", rejected: "danger", superseded: "neutral",
};

export default async function Quotes({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { sb, garage } = await requireGarageOrRedirect();
  const sp = await searchParams;

  let q = sb.from("quotes")
    .select("id, version, status, extra_work, customer_total_paise, contribution_paise, created_at, job_card_id, job_cards(vehicles(reg_no, vehicle_models(name, vehicle_makes(name))))")
    .eq("garage_id", garage.id).order("created_at", { ascending: false }).limit(100);
  if (sp.status) q = q.eq("status", sp.status);

  const { data } = await q;
  const rows = (data ?? []) as unknown as {
    id: string; version: number; status: string; extra_work: boolean; customer_total_paise: number;
    contribution_paise: number; created_at: string; job_card_id: string | null;
    job_cards: { vehicles: { reg_no: string | null; vehicle_models: { name: string; vehicle_makes: { name: string } } } | null } | null;
  }[];

  const unacceptedValue = rows.filter((r) => r.status === "issued").reduce((a, r) => a + Number(r.customer_total_paise), 0);

  return (
    <>
      <PageTitle
        title="Quotations"
        sub={unacceptedValue > 0 ? `${formatINR(unacceptedValue)} is sitting undecided with customers.` : undefined}
        right={<ButtonLink href="/garage/quotes/new" size="sm">New quotation</ButtonLink>}
      />
      <SegmentedLinks
        current={sp.status ? `/garage/quotes?status=${sp.status}` : "/garage/quotes"}
        items={[
          { href: "/garage/quotes", label: "All" },
          { href: "/garage/quotes?status=issued", label: "Waiting on customer" },
          { href: "/garage/quotes?status=approved", label: "Approved" },
          { href: "/garage/quotes?status=rejected", label: "Declined" },
          { href: "/garage/quotes?status=draft", label: "Drafts" },
        ]}
      />

      <div className="mt-5">
        {rows.length === 0 ? (
          <Empty title="No quotations here" body="Every quotation is attached to a job card, so approvals and the invoice always line up." action={<ButtonLink href="/garage/quotes/new">Build one</ButtonLink>} />
        ) : (
          <Panel>
            <Table head={["Vehicle", "Status", "Contribution", "Total"]}>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td>
                    {r.job_card_id ? (
                      <Link href={`/garage/jobs/${r.job_card_id}`} className="font-medium hover:underline">
                        {r.job_cards?.vehicles
                          ? `${r.job_cards.vehicles.vehicle_models.vehicle_makes.name} ${r.job_cards.vehicles.vehicle_models.name}`
                          : "Walk-in"}
                      </Link>
                    ) : <span className="font-medium">Walk-in</span>}
                    <p className="tnum text-xs text-ink2">
                      v{r.version} · {fmtDate(r.created_at)}{r.extra_work && " · extra work"}
                    </p>
                  </Td>
                  <Td><Badge tone={TONE[r.status] ?? "neutral"}>{r.status === "issued" ? "Waiting" : r.status}</Badge></Td>
                  <Td className="tnum text-[13px] text-ink2">{formatINR(Number(r.contribution_paise))}</Td>
                  <Td className="tnum text-right font-medium">{formatINR(Number(r.customer_total_paise))}</Td>
                </Tr>
              ))}
            </Table>
          </Panel>
        )}
      </div>
    </>
  );
}
