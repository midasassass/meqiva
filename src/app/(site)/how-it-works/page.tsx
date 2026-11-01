import Link from "next/link";
import { ButtonLink, Callout, Card, Section } from "@/components/ui";
import { EstimateSheet } from "@/components/estimate";

export const metadata = {
  title: "How it works",
  description: "What happens between picking a garage and paying the bill, and which rules the software enforces along the way.",
};

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="display-2">How it works</h1>
      <p className="prose-read mt-5 text-ink2">
        The ordinary way a repair goes wrong is not fraud. It is that nobody wrote anything down until the end. MEQIVA
        turns the order around: the itemised estimate comes first, and the rules below are enforced by the software
        rather than by goodwill.
      </p>

      <Section title="1. You say what the vehicle needs">
        <p className="prose-read text-ink2">
          Pick a saved vehicle and a service. If the problem needs looking at first — a noise, a warning light — book a
          diagnosis instead. You will see an inspection fee up front and a confirmed quotation afterwards, never a vague
          number that grows.
        </p>
      </Section>

      <Section title="2. Garages quote the same job">
        <p className="prose-read text-ink2">
          Each service has a standard scope. A garage that leaves something out is shown separately as limited scope,
          with the missing items named. A cheaper quote is never ranked against a complete one as though they were the
          same work.
        </p>
        <Card className="mt-4 p-4">
          <p className="text-[13px] text-ink2">
            A basic periodic service, for instance, must cover engine oil, the oil filter, labour and a multi-point
            inspection. Drop the filter and the price falls — but so does what you are buying.
          </p>
        </Card>
      </Section>

      <Section title="3. The estimate is itemised" >
        <p className="prose-read text-ink2">
          Parts, labour, consumables and tax, each on its own line. Where a part carries a printed MRP, that MRP is shown
          next to what you are charged.
        </p>
        <div className="mt-4">
          <EstimateSheet
            heading="Honda City 2018 — basic periodic service"
            subheading="Example of the layout"
            dense
            lines={[
              { description: "Engine oil", amountPaise: 136000, mrpPaise: 136000 },
              { description: "Oil filter", amountPaise: 40000, mrpPaise: 40000 },
              { description: "Labour", amountPaise: 58000 },
              { description: "Multi-point inspection", amountPaise: 0, note: "Included at no charge" },
            ]}
            subtotalPaise={207119}
            taxPaise={26881}
            totalPaise={234000}
            footnote="Illustrative figures."
          />
        </div>
      </Section>

      <Section title="4. You only see slots that exist" >
        <p className="prose-read text-ink2">
          Availability is worked out from the workshop&rsquo;s real opening hours, its holidays, how many bays it has, how long
          the job takes and what is already booked. A slot you can pick is a slot the garage can honour.
        </p>
      </Section>

      <div id="approval" className="scroll-mt-24">
        <Section title="5. Extra work waits for your yes">
          <p className="prose-read text-ink2">
            If the garage finds something else, the job stops and you get a fresh authorisation: the reason, the parts,
            the labour, the revised total and photographs where they took them. Accept it and work resumes. Decline it
            and you collect the vehicle with the approved work done and nothing else charged.
          </p>
          <Callout tone="warn" title="What the software actually does">
            Approvals are written to an append-only record, so neither side can quietly change one later. An invoice
            carrying extra work with no matching approval is refused at the database — not hidden in the interface,
            refused.
          </Callout>
        </Section>
      </div>

      <div id="mrp" className="scroll-mt-24">
        <Section title="6. MRP is a ceiling, not a suggestion">
          <p className="prose-read text-ink2">
            For packaged goods that carry a declared maximum retail price, MEQIVA refuses to save a quotation or an
            invoice priced above it, and records the attempt. Because an MRP already includes tax, GST is never added on
            top of it — a common way a bill quietly inflates.
          </p>
          <p className="prose-read mt-3 text-ink2">
            Discounts below MRP are allowed, and so is an honest margin. Items with no statutory MRP, such as labour or
            bulk consumables, are priced transparently under the garage&rsquo;s published rates instead.
          </p>
        </Section>
      </div>

      <Section title="7. Then you pay, and the record stays">
        <p className="prose-read text-ink2">
          The invoice itemises the same lines you approved, with the tax shown rate by rate. The service joins your
          vehicle&rsquo;s history, which you can export at any time. Records created through a MEQIVA booking are marked as
          verified; anything you upload yourself is kept separate and labelled.
        </p>
      </Section>

      <div className="mt-12 flex flex-wrap gap-3 border-t border-line pt-8">
        <ButtonLink href="/find" size="lg">Compare garages near me</ButtonLink>
        <ButtonLink href="/verification" variant="outline" size="lg">What verification means</ButtonLink>
      </div>
      <p className="mt-4 text-[13px] text-ink2">
        Still unsure about something? The <Link href="/help" className="underline">help centre</Link> covers the rest.
      </p>
    </div>
  );
}
