import { PageTitle, SegmentedLinks } from "@/components/ui";
import { headers } from "next/headers";

const TABS = [
  { href: "/garage/settings", label: "Overview" },
  { href: "/garage/settings/branding", label: "Branding" },
  { href: "/garage/settings/hours", label: "Hours" },
  { href: "/garage/settings/booking", label: "Booking rules" },
  { href: "/garage/settings/rates", label: "Labour rates" },
  { href: "/garage/settings/fields", label: "Job card fields" },
  { href: "/garage/settings/checklists", label: "Checklists" },
  { href: "/garage/settings/invoicing", label: "Invoice and tax" },
  { href: "/garage/settings/commercials", label: "Margins" },
  { href: "/garage/settings/terms", label: "Customer terms" },
  { href: "/garage/settings/features", label: "Features" },
  { href: "/garage/settings/subscription", label: "Plan" },
];

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-pathname") ?? "/garage/settings";
  return (
    <>
      <PageTitle title="Settings" sub="Everything here is yours to change. Nothing is locked behind support." />
      <SegmentedLinks items={TABS} current={path} />
      <div className="mt-6">{children}</div>
    </>
  );
}
