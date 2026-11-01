import Link from "next/link";
import { Card } from "@/components/ui";

const AREAS = [
  ["Branding", "/garage/settings/branding", "Accent colour, tagline and the description customers read."],
  ["Opening hours", "/garage/settings/hours", "Hours per day and the dates you are closed. Slots follow these exactly."],
  ["Booking rules", "/garage/settings/booking", "Notice, slot length, buffers, deposits, cancellation and pickup."],
  ["Labour rates", "/garage/settings/rates", "Rate cards by skill and vehicle category, used by the quotation builder."],
  ["Job card fields", "/garage/settings/fields", "Add the fields your workshop actually records, in the order you want."],
  ["Checklists", "/garage/settings/checklists", "Inspection checklists per service, with photo requirements."],
  ["Invoice and tax", "/garage/settings/invoicing", "Numbering, GST treatment, terms and the footer on every invoice."],
  ["Margins", "/garage/settings/commercials", "Default labour rate, target margin and when to warn on a thin quote."],
  ["Customer terms", "/garage/settings/terms", "Warranty and cancellation wording shown on your profile."],
  ["Features", "/garage/settings/features", "Switch off anything your garage does not use."],
  ["Plan", "/garage/settings/subscription", "What your plan includes and when it renews."],
] as const;

export default function SettingsIndex() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {AREAS.map(([title, href, body]) => (
        <Link key={href} href={href}>
          <Card className="h-full p-4 transition-colors hover:bg-surface2/60">
            <p className="font-medium">{title}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink2">{body}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
