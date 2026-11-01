import Link from "next/link";
import { Badge, Empty, PageTitle, Panel, SegmentedLinks, Stat, Table, Td, Tr } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Invoices" };

export default async function Invoices({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string }> }) {
  const { sb, garage } = await requireGarageOrRedirect();
  const sp = await searchParams;

  const [invRes, commRes] = await Promise.all([
    sb.from("invoices")
      .select("id, number, total_paise, paid_paise, cgst_paise, sgst_paise, igst_paise, issued_at, job_card_id")
      .eq("garage_id", garage.id).is("voided_at", null).order("issued_at", { ascending: false }).limit(200),
    sb.from("commission_records").select("id, fee_paise, gst_paise, created_at, booking_id")
      .eq("garage_id", garage.id).order("created_at", { ascending: false }).limit(100),
  ]);

  const all = invRes.data ?? [];
  const commissions = commRes.data ?? [];
  const invoices = sp.status === "unpaid" ? all.filter((i) => Number(i.paid_paise) < Number(i.total_paise)) : all;

  const billed = all.reduce((a, i) => a + Number(i.total_paise), 0);
  const collected = all.reduce((a, i) => a + Number(i.paid_paise), 0);
  const commissionTotal = commissions.reduce((a, c) => a + Number(c.fee_paise) + Number(c.gst_paise), 0);

  if (sp.tab === "commission") {
    return (
      <>
        <PageTitle title="Marketplace commission" sub="Charged only on completed bookings MEQIVA sent you." />
        <SegmentedLinks current="/garage/invoices?tab=commission"
          items={[{ href: "/garage/invoices", label: "Invoices" }, { href: "/garage/invoices?tab=commission", label: "Commission" }]} />
        <div className="mt-5">
          {commissions.length === 0 ? (
            <Empty title="No commission has accrued" body="Nothing is charged on walk-ins, returning customers or fleet work — only on completed marketplace bookings." />
          ) : (
            <Panel>
              <Table head={["Booking", "Fee", "Tax on fee", "Total"]}>
                {commissions.map((c) => (
                  <Tr key={c.id}>
                    <Td className="tnum text-[13px]">{fmtDate(c.created_at)}</Td>
                    <Td className="tnum">{formatINR(Number(c.fee_paise))}</Td>
                    <Td className="tnum text-[13px] text-ink2">{formatINR(Number(c.gst_paise))}</Td>
                    <Td className="tnum text-right font-medium">{formatINR(Number(c.fee_paise) + Number(c.gst_paise))}</Td>
                  </Tr>
                ))}
              </Table>
              <p className="tnum border-t border-line px-4 py-3 text-right text-sm font-semibold">
                {formatINR(commissionTotal)} in total
              </p>
            </Panel>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Invoices" />
      <SegmentedLinks current={sp.status ? `/garage/invoices?status=${sp.status}` : "/garage/invoices"}
        items={[
          { href: "/garage/invoices", label: "All", count: all.length },
          { href: "/garage/invoices?status=unpaid", label: "Unpaid", count: all.filter((i) => Number(i.paid_paise) < Number(i.total_paise)).length },
          { href: "/garage/invoices?tab=commission", label: "Commission" },
        ]} />

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Billed" value={formatINR(billed)} />
        <Stat label="Collected" value={formatINR(collected)} />
        <Stat label="Outstanding" value={formatINR(Math.max(0, billed - collected))} tone={billed > collected ? "warn" : "default"} />
      </div>

      <div className="mt-6">
        {invoices.length === 0 ? (
          <Empty title="No invoices yet" body="An invoice is issued from a job card once the customer has approved the work." />
        ) : (
          <Panel>
            <Table head={["Invoice", "Issued", "Tax", "Total"]}>
              {invoices.map((i) => {
                const unpaid = Number(i.paid_paise) < Number(i.total_paise);
                return (
                  <Tr key={i.id}>
                    <Td>
                      {i.job_card_id
                        ? <Link href={`/garage/jobs/${i.job_card_id}`} className="tnum font-medium hover:underline">{i.number}</Link>
                        : <span className="tnum font-medium">{i.number}</span>}
                      {unpaid && <Badge tone="warn" className="ml-2">Unpaid</Badge>}
                    </Td>
                    <Td className="tnum text-[13px] text-ink2">{fmtDate(i.issued_at)}</Td>
                    <Td className="tnum text-[13px] text-ink2">
                      {Number(i.igst_paise) > 0
                        ? `IGST ${formatINR(Number(i.igst_paise))}`
                        : `${formatINR(Number(i.cgst_paise))} + ${formatINR(Number(i.sgst_paise))}`}
                    </Td>
                    <Td className="tnum text-right font-medium">{formatINR(Number(i.total_paise))}</Td>
                  </Tr>
                );
              })}
            </Table>
          </Panel>
        )}
      </div>
    </>
  );
}
