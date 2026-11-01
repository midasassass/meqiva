import { ButtonLink, Card, Panel, Section } from "@/components/ui";
import { Stamp, VerificationDisclaimer, LEVEL_MEANS } from "@/components/stamp";

export const metadata = {
  title: "What verification means",
  description: "The three MEQIVA inspection levels, what each one requires, and why a garage cannot buy its way up.",
};

const LEVELS = [
  {
    level: "listed" as const,
    checks: [
      "Business identity and ownership confirmed against documents",
      "Working contact number reached and verified",
      "Address confirmed and plotted",
      "Service categories and supported brands declared",
    ],
  },
  {
    level: "verified" as const,
    checks: [
      "Everything in Listed, plus an on-site visit by a MEQIVA auditor",
      "Workshop, bays and equipment inspected and photographed",
      "Statutory registrations examined where applicable",
      "Parts sourcing and billing practice reviewed",
      "Reassessed on a fixed cycle, with an expiry date on the badge",
    ],
  },
  {
    level: "quality_assured" as const,
    checks: [
      "Everything in Verified, held to higher operational criteria",
      "Documented inspection checklists in routine use",
      "Service evidence captured on jobs",
      "Complaint handling and warranty record reviewed",
      "Corrective actions closed within set deadlines",
    ],
  },
];

export default function Verification() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="display-2">What verification means</h1>
      <p className="prose-read mt-5 text-ink2">
        A trust mark is only worth something if you know what was checked and when. Every MEQIVA badge carries the date
        it was issued and the date it lapses, taken from the audit record itself. If an inspection expires, the badge
        says so wherever it appears.
      </p>

      <div className="mt-10 space-y-5">
        {LEVELS.map(({ level, checks }) => (
          <Panel key={level}>
            <div className="flex flex-wrap items-start gap-5 p-5">
              <Stamp level={level} size="lg" verifiedAt="2026-05-02" expiresAt="2027-05-02" />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">{LEVEL_MEANS[level]}</p>
                <ul className="mt-3 space-y-1.5">
                  {checks.map((c) => (
                    <li key={c} className="flex gap-2 text-[13.5px] leading-relaxed text-ink2">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-warn" aria-hidden />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Panel>
        ))}
      </div>
      <p className="mt-3 text-xs text-ink2">Dates above are illustrative. A live badge shows its own.</p>

      <Section title="What a garage cannot do">
        <Card>
          <ul className="space-y-2.5 text-[14px] leading-relaxed text-ink2">
            <li><span className="font-medium text-ink">Buy a level.</span> Verification is set by audit. Subscriptions, plans and advertising spend have no bearing on it, and the system keeps the two apart.</li>
            <li><span className="font-medium text-ink">Buy a rating.</span> Reviews come only from customers whose booking completed through MEQIVA, one per booking.</li>
            <li><span className="font-medium text-ink">Hide a lapse.</span> An expired inspection shows as lapsed, not as verified.</li>
            <li><span className="font-medium text-ink">Disguise an advertisement.</span> Paid placement is labelled sponsored and never alters a badge or a score.</li>
          </ul>
        </Card>
      </Section>

      <Section title="What it is not">
        <p className="prose-read text-ink2">
          MEQIVA verification is an independent commercial inspection. It is not a government licence, not a
          manufacturer authorisation, and not a warranty from MEQIVA. The garage performs the work, issues the tax
          invoice and owns the workmanship warranty. Where a dispute cannot be settled between you, MEQIVA mediates and
          can suspend a garage, but it does not underwrite repairs it has not agreed to cover.
        </p>
        <div className="mt-4"><VerificationDisclaimer /></div>
      </Section>

      <div className="mt-12 flex flex-wrap gap-3 border-t border-line pt-8">
        <ButtonLink href="/find" size="lg">See verified garages</ButtonLink>
        <ButtonLink href="/for-garages#apply" variant="outline" size="lg">Apply for an inspection</ButtonLink>
      </div>
    </div>
  );
}
