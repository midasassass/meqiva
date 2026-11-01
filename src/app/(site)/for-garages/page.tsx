import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge, ButtonLink, Callout, Card, Panel, Section } from "@/components/ui";
import { getFaqs } from "@/lib/public-data";

export const revalidate = 600;
export const metadata = {
  title: "MEQIVA Pro for garages",
  description: "A workshop operating system you shape to your garage — branding, hours, job cards, checklists, rate cards and booking rules. No commission on your own customers.",
};

/* The customisation story is the product story, so it leads. */
const CUSTOMISE: { group: string; items: string[] }[] = [
  { group: "How your garage looks", items: [
    "Your name, logo and accent colour across your public profile, booking page and your team's dashboard",
    "Your own tagline and workshop description",
    "Warranty, cancellation and service terms in your words",
  ] },
  { group: "How your garage runs", items: [
    "Opening hours per day, per branch, plus holidays",
    "Bay count, job duration, buffer between jobs and how many jobs run at once",
    "Notice period, how far ahead people can book, deposits, cancellation window and no-show fee",
    "Pickup and drop with your own radius and fee",
  ] },
  { group: "How you price", items: [
    "Service catalogue with what each package includes and excludes",
    "Labour rate cards by skill and vehicle category",
    "Default GST treatment, target margin and the margin level that triggers a warning",
    "Invoice prefix, numbering, terms and footer",
  ] },
  { group: "How you record work", items: [
    "Job card fields you define — text, numbers, dropdowns, dates, photos",
    "Inspection checklists per service category, with photo requirements",
    "Technician skills, so scheduling respects who can do what",
    "Notification wording per event and channel",
  ] },
];

const SYSTEM = [
  ["Workshop board", "Bays, who is on what, what is overdue and what is waiting on parts — on one screen."],
  ["Digital job cards", "Walk-ins and marketplace jobs side by side, with your fields and your checklists."],
  ["Quotations with live margin", "Contribution margin as you type, MRP blocked at the line, duplicate lines flagged."],
  ["Inventory that stays correct", "Stock moves atomically with the job and returns cleanly when one is cancelled."],
  ["Customer records", "History, spend, vehicles due for service and the quotes nobody came back for."],
  ["Invoices and reports", "GST-split invoices, outstanding payments and margin by service category."],
];

export default async function ForGarages() {
  const faqs = await getFaqs("garage", 6);
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-14 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <h1 className="display max-w-[16ch]">Run the workshop. Keep the customer.</h1>
            <p className="mt-6 max-w-[54ch] text-lg leading-relaxed text-ink2">
              MEQIVA Pro is the software your garage runs on, shaped to how you already work. The marketplace is an
              option on top — and it only costs you anything when it sends you a job that completes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/signup?as=garage" size="lg">Apply as a founding partner</ButtonLink>
              <ButtonLink href="/pricing" variant="outline" size="lg">Plans and commission</ButtonLink>
            </div>
          </div>
          <Card className="p-6">
            <p className="text-[15px] font-semibold">The part most platforms get wrong</p>
            <p className="mt-3 text-sm leading-relaxed text-ink2">
              You should not pay a marketplace fee on the customer who has come to you for nine years. MEQIVA records
              where every job came from — marketplace, walk-in or fleet contract — and commission can only ever touch
              the first kind, after it completes.
            </p>
            <p className="mt-4 flex flex-wrap gap-1.5">
              <Badge tone="success">Walk-in · no fee</Badge>
              <Badge tone="success">Fleet · no fee</Badge>
              <Badge tone="warn">Marketplace · fee on completion</Badge>
            </p>
          </Card>
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="display-2 max-w-[22ch]">Every garage is different. The software should be too.</h2>
          <p className="mt-4 max-w-[60ch] text-[15px] text-ink2">
            Nothing here is a hidden setting or a paid add-on. This is what you configure yourself, in your own account,
            on the day you onboard.
          </p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2">
            {CUSTOMISE.map((c) => (
              <div key={c.group} className="bg-surface p-6">
                <h3 className="text-[16px] font-semibold tracking-tight">{c.group}</h3>
                <ul className="mt-3 space-y-2">
                  {c.items.map((i) => (
                    <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-ink2">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-warn" aria-hidden />{i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="display-2">What you get on day one.</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SYSTEM.map(([t, d]) => (
            <div key={t}>
              <h3 className="text-[16px] font-semibold tracking-tight">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink2">{d}</p>
            </div>
          ))}
        </div>
        <Callout tone="neutral">
          Your technicians work on the phones they already own. Their screen is deliberately plain and light — a list of
          jobs, a checklist, a camera button — and it never shows costs, margins or anyone&rsquo;s financial data.
        </Callout>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
            <div>
              <h2 className="display-2">Fair questions.</h2>
              <Link href="/pricing" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
                See the numbers<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
            <div className="divide-y divide-line border-y border-line">
              {faqs.map((f) => (
                <details key={f.id} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15px] font-medium">
                    {f.question}
                    <span className="mt-1 shrink-0 text-ink2 transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="prose-read mt-3 text-ink2">{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="apply" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6">
        <Panel title="Founding partner programme" description="Terms are configured by MEQIVA and shown in full before you commit.">
          <div className="grid gap-6 p-5 sm:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="text-sm leading-relaxed text-ink2">
                MEQIVA is onboarding its first workshops in Gurugram. Founding partners get an extended trial, waived
                setup, direct access to the team while the product is shaped, and a branded profile and booking page.
                Verification is separate and still has to be earned by inspection.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <ButtonLink href="/signup?as=garage">Start an application</ButtonLink>
                <ButtonLink href="/help?for=garage" variant="outline">Read the garage help</ButtonLink>
              </div>
            </div>
            <Card className="bg-surface2 p-4">
              <p className="text-[13px] font-medium">What we will ask for</p>
              <ol className="mt-2 space-y-1.5 text-[12.5px] text-ink2">
                <li>Business and owner details, and GSTIN if you are registered</li>
                <li>Address, working hours and bay count</li>
                <li>Service categories and the brands you work on</li>
                <li>Photographs of the workshop</li>
                <li>Bank details for settlement, only if you take marketplace bookings</li>
              </ol>
            </Card>
          </div>
        </Panel>
      </section>
    </>
  );
}
