import Link from "next/link";
import { PageTitle, Panel } from "@/components/ui";
import { requireRole } from "@/lib/session";

export const metadata = { title: "More" };

export default async function AdminMore() {
  const u = await requireRole("super_admin", "quality_auditor", "support_agent");
  const admin = u.role === "super_admin";

  const sections: { heading: string; links: [string, string, string][] }[] = [
    { heading: "Operations", links: [
      ["/admin/compliance", "Pricing compliance", "Blocked over-MRP attempts"],
      ["/admin/tickets", "Disputes", "Complaints and escalations"],
      ["/admin/audits", "Verification", "Inspections due and audit history"],
      ["/admin/advice", "Repair reviews", "Is this repair really needed?"],
      ["/admin/credentials", "Credentials", "Technician training to verify"],
      ["/admin/inspections", "Used-car inspections", "Schedule visits and publish reports"],
      ["/admin/assistance", "Roadside partners", "The public help directory"],
    ] },
    ...(u.role === "super_admin" || u.role === "support_agent" ? [{ heading: "Marketing", links: [
      ["/admin/testimonials", "Testimonials", "Real customer quotes, with consent dates"] as [string, string, string],
    ] }] : []),
    ...(admin ? [{ heading: "Commercial", links: [
      ["/admin/commissions", "Commission", "Rules and what has accrued"] as [string, string, string],
      ["/admin/plans", "Plans", "What each subscription includes"] as [string, string, string],
    ] }, { heading: "Platform", links: [
      ["/admin/users", "People", "Platform roles"] as [string, string, string],
      ["/admin/content", "Content", "Help centre and legal pages"] as [string, string, string],
      ["/admin/platform", "Configuration", "Feature flags and defaults"] as [string, string, string],
      ["/admin/logs", "Audit log", "Who changed what"] as [string, string, string],
    ] }] : []),
  ];

  return (
    <>
      <PageTitle title="Everything else" />
      <div className="space-y-5">
        {sections.map((s) => (
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
