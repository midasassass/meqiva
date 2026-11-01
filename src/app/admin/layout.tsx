import {
  BadgeCheck, ClipboardCheck, FileText, Gauge, LifeBuoy, MessageSquareQuote, MoreHorizontal,
  Percent, Phone, Scale, ScrollText, ShieldAlert, SlidersHorizontal, Store, Users,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { SetupNotice } from "@/components/ui";
import { requireRole } from "@/lib/session";
import { hasSupabase } from "@/lib/supabase/env";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabase()) return <main className="mx-auto max-w-xl p-6"><SetupNotice /></main>;
  const u = await requireRole("super_admin", "quality_auditor", "support_agent");
  const i = "h-[18px] w-[18px]";

  const ROLE_NAME = { super_admin: "Platform admin", quality_auditor: "Quality auditor", support_agent: "Support" } as const;

  const groups = [
    { items: [
      { href: "/admin", label: "Overview", icon: <Gauge className={i} aria-hidden />, exact: true },
      { href: "/admin/garages", label: "Garages", icon: <Store className={i} aria-hidden /> },
      { href: "/admin/audits", label: "Verification", icon: <BadgeCheck className={i} aria-hidden /> },
    ] },
    { heading: "Operations", items: [
      { href: "/admin/tickets", label: "Disputes", icon: <LifeBuoy className={i} aria-hidden /> },
      { href: "/admin/compliance", label: "Pricing compliance", icon: <ShieldAlert className={i} aria-hidden /> },
      { href: "/admin/advice", label: "Repair reviews", icon: <Scale className={i} aria-hidden /> },
      { href: "/admin/credentials", label: "Credentials", icon: <BadgeCheck className={i} aria-hidden /> },
      { href: "/admin/inspections", label: "Inspections", icon: <ClipboardCheck className={i} aria-hidden /> },
    ] },
    { heading: "Directory", items: [
      { href: "/admin/assistance", label: "Roadside partners", icon: <Phone className={i} aria-hidden /> },
      ...(u.role === "super_admin" || u.role === "support_agent"
        ? [{ href: "/admin/testimonials", label: "Testimonials", icon: <MessageSquareQuote className={i} aria-hidden /> }]
        : []),
    ] },
    ...(u.role === "super_admin" ? [
      { heading: "Commercial", items: [
        { href: "/admin/commissions", label: "Commission", icon: <Percent className={i} aria-hidden /> },
        { href: "/admin/plans", label: "Plans", icon: <SlidersHorizontal className={i} aria-hidden /> },
      ] },
      { heading: "Platform", items: [
        { href: "/admin/users", label: "People", icon: <Users className={i} aria-hidden /> },
        { href: "/admin/content", label: "Content", icon: <FileText className={i} aria-hidden /> },
        { href: "/admin/platform", label: "Configuration", icon: <SlidersHorizontal className={i} aria-hidden /> },
        { href: "/admin/logs", label: "Audit log", icon: <ScrollText className={i} aria-hidden /> },
      ] },
    ] : []),
  ];

  const bottom = [
    { href: "/admin", label: "Overview", icon: <Gauge className={i} aria-hidden />, exact: true },
    { href: "/admin/garages", label: "Garages", icon: <Store className={i} aria-hidden /> },
    { href: "/admin/audits", label: "Audits", icon: <BadgeCheck className={i} aria-hidden /> },
    { href: "/admin/tickets", label: "Disputes", icon: <LifeBuoy className={i} aria-hidden /> },
    { href: "/admin/more", label: "More", icon: <MoreHorizontal className={i} aria-hidden /> },
  ];

  return (
    <Shell
      workspace="MEQIVA Admin"
      subtitle={ROLE_NAME[u.role as keyof typeof ROLE_NAME]}
      user={{ email: u.email, name: u.fullName }}
      groups={groups}
      bottom={bottom}
    >
      {children}
    </Shell>
  );
}
