import {
  BadgeCheck, Boxes, CalendarClock, ClipboardList, FileText, LayoutDashboard, MessageSquareQuote,
  MoreHorizontal, IndianRupee, Receipt, Settings, ShieldCheck, SlidersHorizontal, Users, Wrench,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { ButtonLink, Callout, Empty, SetupNotice } from "@/components/ui";
import { Stamp, type Level } from "@/components/stamp";
import { requireGarage } from "@/lib/session";
import { getSettings } from "@/lib/garage-data";
import { hasSupabase } from "@/lib/supabase/env";

export default async function GarageLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabase()) return <main className="mx-auto max-w-xl p-6"><SetupNotice /></main>;

  const { user, sb, garage } = await requireGarage();
  const settings = garage ? await getSettings(sb, garage.id) : null;
  const i = "h-[18px] w-[18px]";

  const groups = [
    { items: [
      { href: "/garage", label: "Overview", icon: <LayoutDashboard className={i} aria-hidden />, exact: true },
      { href: "/garage/workshop", label: "Workshop board", icon: <Wrench className={i} aria-hidden /> },
      { href: "/garage/jobs", label: "Job cards", icon: <ClipboardList className={i} aria-hidden /> },
      { href: "/garage/bookings", label: "Bookings", icon: <CalendarClock className={i} aria-hidden /> },
    ] },
    { heading: "Money", items: [
      { href: "/garage/quotes", label: "Quotations", icon: <FileText className={i} aria-hidden /> },
      { href: "/garage/invoices", label: "Invoices", icon: <Receipt className={i} aria-hidden /> },
      { href: "/garage/leads", label: "Second-quote leads", icon: <MessageSquareQuote className={i} aria-hidden /> },
    ] },
    { heading: "Workshop", items: [
      { href: "/garage/parts", label: "Parts and stock", icon: <Boxes className={i} aria-hidden /> },
      { href: "/garage/pricing", label: "Pricing", icon: <IndianRupee className={i} aria-hidden /> },
      { href: "/garage/services", label: "Service list", icon: <SlidersHorizontal className={i} aria-hidden /> },
      { href: "/garage/crm", label: "Customers", icon: <Users className={i} aria-hidden /> },
    ] },
    { heading: "Trust", items: [
      { href: "/garage/warranties", label: "Warranties", icon: <ShieldCheck className={i} aria-hidden /> },
      { href: "/garage/credentials", label: "Credentials", icon: <BadgeCheck className={i} aria-hidden /> },
    ] },
    { heading: "Setup", items: [
      { href: "/garage/team", label: "Team", icon: <Users className={i} aria-hidden /> },
      { href: "/garage/settings", label: "Settings", icon: <Settings className={i} aria-hidden /> },
    ] },
  ];

  const bottom = [
    { href: "/garage", label: "Today", icon: <LayoutDashboard className={i} aria-hidden />, exact: true },
    { href: "/garage/workshop", label: "Board", icon: <Wrench className={i} aria-hidden /> },
    { href: "/garage/jobs", label: "Jobs", icon: <ClipboardList className={i} aria-hidden /> },
    { href: "/garage/parts", label: "Stock", icon: <Boxes className={i} aria-hidden /> },
    { href: "/garage/more", label: "More", icon: <MoreHorizontal className={i} aria-hidden /> },
  ];

  return (
    <Shell
      workspace={garage?.name ?? "MEQIVA Pro"}
      subtitle={garage ? (garage.isOwner ? "Owner" : "Service advisor") : undefined}
      user={{ email: user.email, name: user.fullName }}
      accentHex={settings?.accent_hex}
      badge={garage && garage.verification !== "none" ? <Stamp level={garage.verification as Level} /> : undefined}
      groups={groups}
      bottom={bottom}
    >
      {garage ? (
        <>
          {garage.status === "pending" && (
            <Callout tone="warn" title="Your garage is awaiting approval">
              You can set everything up now — branding, prices, hours, job cards. Your profile goes live once MEQIVA
              approves the application.
            </Callout>
          )}
          {garage.status === "suspended" && (
            <Callout tone="danger" title="This garage is suspended">
              Your workshop records stay available to you. Marketplace listing and new bookings are paused until the
              suspension is lifted.
            </Callout>
          )}
          <div className={garage.status === "active" ? "" : "mt-5"}>{children}</div>
        </>
      ) : (
        <Empty
          title="No garage is linked to your account"
          body="Set your workshop up in a couple of minutes, or ask the owner to send you an invitation."
          action={<ButtonLink href="/onboarding">Set up my garage</ButtonLink>}
        />
      )}
    </Shell>
  );
}
