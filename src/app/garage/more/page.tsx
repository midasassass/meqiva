import Link from "next/link";
import { PageTitle, Panel } from "@/components/ui";

export const metadata = { title: "More" };

const SECTIONS: { heading: string; links: [string, string, string][] }[] = [
  { heading: "Work", links: [
    ["/garage/bookings", "Bookings", "Accept requests and move jobs along"],
    ["/garage/quotes", "Quotations", "Everything sent, approved or still waiting"],
    ["/garage/invoices", "Invoices", "Billed, collected and outstanding"],
  ] },
  { heading: "Workshop", links: [
    ["/garage/services", "Services and prices", "What customers can book and compare"],
    ["/garage/parts", "Parts and stock", "Stock levels, costs and MRP"],
    ["/garage/crm", "Customers", "Who is due, who never answered"],
  ] },
  { heading: "Trust", links: [
    ["/garage/leads", "Second-quote leads", "Quote work customers were quoted elsewhere"],
    ["/garage/warranties", "Warranties", "What you stand behind, and open claims"],
    ["/garage/credentials", "Credentials", "Training your technicians hold"],
  ] },
  { heading: "Setup", links: [
    ["/garage/team", "Team", "Who can see what"],
    ["/garage/settings", "Settings", "Branding, hours, fields, checklists, tax"],
    ["/garage/settings/subscription", "Plan and commission", "What you pay and when"],
  ] },
];

export default function More() {
  return (
    <>
      <PageTitle title="Everything else" />
      <div className="space-y-5">
        {SECTIONS.map((s) => (
          <Panel key={s.heading} title={s.heading}>
            <ul className="divide-y divide-line">
              {s.links.map(([href, label, hint]) => (
                <li key={href}>
                  <Link href={href} className="block px-4 py-3 transition-colors hover:bg-surface2/60">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="mt-0.5 text-[12.5px] text-ink2">{hint}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </>
  );
}
