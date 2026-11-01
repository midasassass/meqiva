import Link from "next/link";
import {
  ArrowUpRight, BadgeCheck, Ban, Bell, Camera, ClipboardCheck, FileCheck2, Images, Lock,
  MessageSquareQuote, Phone, Scale, ShieldCheck, Table2, Timer, TrendingUp, Truck, Users,
} from "lucide-react";
import { HeroEstimate } from "@/components/hero-estimate";
import { HeroTrustBadge, EcosystemToggleDemo, IndiaGarageFeatures } from "@/components/home-interactive";
import { Impact, Testimonials } from "@/components/social-proof";
import { Stamp, VerificationDisclaimer } from "@/components/stamp";
import { ButtonLink, Card } from "@/components/ui";
import { getCounters, getFaqs, getHeroModels, getImpact, getTestimonials } from "@/lib/public-data";

export const revalidate = 600;

/* The three promises are not slogans — each one is a rule the software refuses to break. */
const PROMISES = [
  {
    icon: Ban,
    title: "Nothing above the printed MRP",
    body: "For any part that carries a declared MRP, a price above it cannot be saved — not as a warning, not with an override. The quotation and the invoice are both refused, and the attempt is logged.",
    link: { href: "/how-it-works#mrp", label: "How the check works" },
  },
  {
    icon: FileCheck2,
    title: "Extra work waits for your yes",
    body: "If the garage finds something else, work stops. You get the reason, the parts, the labour and the new total. A technician cannot add billable work to your job, and an invoice with unapproved work on it will not issue.",
    link: { href: "/how-it-works#approval", label: "See the approval step" },
  },
  {
    icon: Lock,
    title: "Reviews only from finished jobs",
    body: "A review can be written only by the customer on a booking that completed through MEQIVA, one per booking. Verification levels are set by audit and cannot be bought at any price.",
    link: { href: "/verification", label: "What verification means" },
  },
];

const STEPS = [
  { t: "Tell us the vehicle and the problem", d: "Pick from your saved vehicles, or add one in a few seconds. Say what it needs, or book a diagnosis if you are not sure." },
  { t: "Compare like for like", d: "Garages near you show parts, labour, consumables and tax. A quote that leaves out part of the standard job is marked as limited scope and never ranked against a complete one." },
  { t: "Book a slot that exists", d: "You only see times the workshop can genuinely honour — real opening hours, real bay capacity, real job duration." },
  { t: "Watch it happen, then pay", d: "Live status as the work moves. Approve anything extra. Get an itemised invoice and a service history that stays with the vehicle." },
];

/*
  The fifteen things the platform does, written the way a customer would describe the
  problem rather than the way we built the solution. Short sentences on purpose: this
  page is read on a phone, often by someone who is already annoyed about a quotation.
*/
const FEATURES = [
  { icon: Table2, title: "Compare the same basket, not brochures",
    body: "Pick the services you need. Every garage is priced on that exact list — labour, parts and consumables separately — so you are comparing one number with another number.",
    href: "/estimate", cta: "Try the estimator" },
  { icon: FileCheck2, title: "A service record that stays with the car",
    body: "Every job, every part, every reading in one place. Download it as a file when you sell the car and the buyer can see the car was looked after.",
    href: "/app/vehicles", cta: "See a vehicle record" },
  { icon: Scale, title: "Ask if a repair is really needed",
    body: "Told you need a new mount, a new clutch, four new tyres? Send us what they said. A MEQIVA reviewer gives you a straight answer, and the garage that quoted never sees it.",
    href: "/app/advice", cta: "Ask about a quote" },
  { icon: Images, title: "Photos before and after",
    body: "The worn part, and the new one in place. Taken in the workshop and attached to your job, so \u201cit needed changing\u201d is something you can look at.",
    href: "/how-it-works", cta: "How a job runs" },
  { icon: TrendingUp, title: "Know what the next year will cost",
    body: "From your car\u2019s age and running, what is due and roughly what it will cost at real garage prices. No surprise bills in month eight.",
    href: "/app/vehicles", cta: "See your forecast" },
  { icon: BadgeCheck, title: "Who is actually working on your car",
    body: "Technician training and years in the trade, checked by a MEQIVA auditor before it appears. A garage cannot mark its own homework.",
    href: "/verification", cta: "What we check" },
  { icon: ShieldCheck, title: "Warranties you can find again",
    body: "Who honours it, what it covers, when it ends and the distance limit \u2014 whichever comes first. Claim from your phone, no paper slip to lose.",
    href: "/app/warranties", cta: "Your warranties" },
  { icon: Timer, title: "Watch the job move",
    body: "Received, inspected, waiting for your approval, in the bay, ready. Timestamped as it happens, so you stop ringing to ask.",
    href: "/how-it-works", cta: "See the stages" },
  { icon: Camera, title: "See the bay, if the garage allows it",
    body: "Where a workshop has a camera on the bay, you can look in while your car is being worked on. Only with the garage\u2019s consent, and only during your job.",
    href: "/how-it-works", cta: "How it works" },
  { icon: Truck, title: "Pickup and drop",
    body: "Hand over the keys at home or at the office. Agreed when you book, with the charge shown before you confirm \u2014 not added at the end.",
    href: "/find", cta: "Find a garage" },
  { icon: MessageSquareQuote, title: "A second quote, without the awkwardness",
    body: "Describe the work. Other garages nearby quote the same job. The one who quoted you first is shut out, and nobody sees anybody else\u2019s price.",
    href: "/app/second-opinion", cta: "Get a second quote" },
  { icon: Phone, title: "Roadside numbers that answer",
    body: "Towing, battery, puncture, fuel, locked out. Numbers we have rung ourselves, with the callout charge written down. Free, and no account needed.",
    href: "/assistance", cta: "Open the directory" },
  { icon: ClipboardCheck, title: "Check a used car before you pay",
    body: "Our inspector goes to the seller and sends you a graded report with what it will cost to put right. Negotiate on findings, not on feel.",
    href: "/app/inspections", cta: "Order an inspection" },
  { icon: Users, title: "One account for the whole family",
    body: "Every car and two-wheeler in the house in one place. Everyone sees the history; you decide who is allowed to approve spending.",
    href: "/app/family", cta: "Set up a family account" },
  { icon: Bell, title: "Reminders before it becomes expensive",
    body: "Service, insurance, PUC. Based on how much you actually drive, not a date somebody typed once.",
    href: "/app", cta: "Your dashboard" },
];

export default async function Home() {
  const [counters, faqs, models, impact, testimonials] = await Promise.all([
    getCounters(), getFaqs("customer", 6), getHeroModels(), getImpact(), getTestimonials(6),
  ]);
  const hasActivity = counters.activeGarages > 0;

  return (
    <>
      {/* Hero: the estimate is the product, so the estimate is the hero. */}
      <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-16 glow">
        <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16">
          <div className="space-y-6">
            <HeroTrustBadge />
            <h1 className="display max-w-[14ch]">Know the price before you hand over the keys.</h1>
            <p className="max-w-[52ch] text-lg leading-relaxed text-ink2">
              Pick your vehicle and what it needs. Garages near you show the whole bill — parts, labour, and GST —
              before you book. After that, nothing is added without your written word.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <ButtonLink href="/find" size="lg" className="shadow-brand">Compare garages near me</ButtonLink>
              <ButtonLink href="/how-it-works" variant="outline" size="lg">How it works</ButtonLink>
            </div>
            {hasActivity && (
              <p className="tnum text-[13px] text-ink2">
                {counters.activeGarages} {counters.activeGarages === 1 ? "garage" : "garages"} listed
                {counters.verifiedGarages > 0 && `, ${counters.verifiedGarages} inspected`}
                {counters.localities > 0 && ` across ${counters.localities} ${counters.localities === 1 ? "locality" : "localities"}`} in Gurugram.
              </p>
            )}
          </div>
          <div className="rise" style={{ "--i": 1 } as React.CSSProperties}>
            <HeroEstimate models={models} />
          </div>
        </div>

        {/* Live Ecosystem Demo: Car Owner + Workshop OS */}
        <EcosystemToggleDemo />
      </section>

      {/* The promises, with the mechanism named. */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="display-2 max-w-[20ch]">Three things the software will not let a garage do.</h2>
          <div className="mt-10 grid gap-px overflow-hidden rounded-panel border border-line bg-line lg:grid-cols-3">
            {PROMISES.map((p) => (
              <div key={p.title} className="bg-surface p-6">
                <p.icon className="h-5 w-5 text-warn" aria-hidden />
                <h3 className="mt-4 text-[17px] font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink2">{p.body}</p>
                <Link href={p.link.href} className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-brand hover:underline">
                  {p.link.label}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Genuinely a sequence, so it is numbered. */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="display-2">From keys to invoice.</h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.t}>
              <span className="tnum block text-sm font-semibold text-warn">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-2 text-[16px] font-semibold tracking-tight">{s.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink2">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Everything the platform does, in the customer's own words. */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="display-2 max-w-[26ch]">Fifteen ways MEQIVA takes the guesswork out.</h2>
          <p className="mt-4 max-w-[62ch] text-[15px] leading-relaxed text-ink2">
            Servicing a car in India goes wrong in the same few places every time — a price nobody will put in
            writing, work you cannot tell was needed, a warranty nobody can find. Each of these fixes one of them.
          </p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col bg-surface p-6">
                <f.icon className="h-5 w-5 shrink-0 text-brand" aria-hidden />
                <h3 className="mt-4 text-[16px] font-semibold leading-snug tracking-tight">{f.title}</h3>
                <p className="mt-2.5 grow text-[13.5px] leading-relaxed text-ink2">{f.body}</p>
                <Link href={f.href}
                  className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">
                  {f.cta}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verification, shown as the stamps themselves. */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <div>
              <h2 className="display-2">A badge that carries its own date.</h2>
              <div className="prose-read mt-5 text-ink2">
                <p>
                  Most trust marks tell you nothing about when anyone last looked. A MEQIVA stamp cannot be drawn without
                  the date it was issued and the date it lapses, because those come from the audit record itself.
                </p>
                <p>
                  A garage cannot buy a level, and paid placement never changes one. If an inspection expires, the badge
                  says so on every page it appears on.
                </p>
              </div>
              <div className="mt-6"><VerificationDisclaimer /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 lg:gap-3">
              {(["listed", "verified", "quality_assured"] as const).map((lvl, i) => (
                <Card key={lvl} className="flex flex-col gap-3 p-5">
                  <Stamp level={lvl} size="lg" verifiedAt={["2026-02-14", "2026-05-02", "2026-07-21"][i]} expiresAt={["2027-02-14", "2027-05-02", "2027-07-21"][i]} />
                  <p className="text-[13px] leading-relaxed text-ink2">
                    {lvl === "listed" && "Identity, ownership and contact details checked."}
                    {lvl === "verified" && "An auditor inspected the workshop and its documents in person."}
                    {lvl === "quality_assured" && "Met higher operational criteria, reassessed periodically."}
                  </p>
                </Card>
              ))}
            </div>
          </div>
          <p className="mt-6 text-xs text-ink2">Dates shown above are illustrative. Every live badge shows its own audit dates.</p>
        </div>
      </section>

      <Impact impact={impact} />
      <Testimonials items={testimonials} />

      {/* FAQ: plain <details>, no JavaScript. */}
      {faqs.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
            <div>
              <h2 className="display-2">Questions people actually ask.</h2>
              <Link href="/help" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
                Everything in the help centre<ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
            <div className="divide-y divide-line border-y border-line">
              {faqs.map((f) => (
                <details key={f.id} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15px] font-medium marker:hidden">
                    {f.question}
                    <span className="mt-1 shrink-0 text-ink2 transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="prose-read mt-3 text-ink2">{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* The Indian Garage ERP Spotlight (Zoho for Workshops) */}
      <IndiaGarageFeatures />

      {/* The second audience. Its own surface so it reads as a different room. */}
      <section className="bg-primary text-primary-fg">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <h2 className="display-2">Run the workshop. Keep the customer.</h2>
            <p className="mt-5 max-w-[50ch] text-[15px] leading-relaxed opacity-90">
              Job cards, quotations with live margin, inventory that stays correct, reminders and invoicing — shaped to
              how your garage already works. Commission applies only to bookings MEQIVA sends you. Your own walk-ins
              and regulars cost you nothing.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/for-garages" size="lg" variant="inverse">See MEQIVA Pro</ButtonLink>
              <ButtonLink href="/pricing" size="lg" variant="inverse-outline">Plans and commission</ButtonLink>
            </div>
          </div>
          <ul className="grid gap-px overflow-hidden rounded-panel bg-white/15 text-sm sm:grid-cols-2 lg:grid-cols-1">
            {[
              "Your branding, your hours, your job card fields",
              "Checklists and rate cards you define",
              "Walk-in and marketplace jobs kept separate",
              "Works on the phone a technician already owns",
            ].map((t) => (
              <li key={t} className="bg-primary px-4 py-3.5">{t}</li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
