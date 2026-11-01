import Link from "next/link";
import { Empty, SegmentedLinks, Section } from "@/components/ui";
import { getFaqs } from "@/lib/public-data";
import { titleCase } from "@/lib/format";

export const revalidate = 600;
export const metadata = { title: "Help centre", description: "Answers about estimates, approvals, verification, payments and your data." };

export default async function Help({ searchParams }: { searchParams: Promise<{ for?: string }> }) {
  const sp = await searchParams;
  const audience = sp.for === "garage" ? "garage" : "customer";
  const faqs = await getFaqs(audience, 60);

  const topics = [...new Set(faqs.map((f) => f.topic))];

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="display-2">Help centre</h1>
      <p className="mt-3 text-[15px] text-ink2">
        {audience === "garage" ? "Running your workshop on MEQIVA." : "Booking, prices, approvals and your records."}
      </p>

      <div className="mt-6">
        <SegmentedLinks
          current={audience === "garage" ? "/help?for=garage" : "/help"}
          items={[{ href: "/help", label: "For vehicle owners" }, { href: "/help?for=garage", label: "For garages" }]}
        />
      </div>

      {faqs.length === 0 ? (
        <div className="mt-8"><Empty title="No articles published yet" body="Help content is managed from the MEQIVA admin panel." /></div>
      ) : (
        topics.map((topic) => (
          <Section key={topic} title={titleCase(topic)}>
            <div className="divide-y divide-line border-y border-line">
              {faqs.filter((f) => f.topic === topic).map((f) => (
                <details key={f.id} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15px] font-medium">
                    {f.question}
                    <span className="mt-1 shrink-0 text-ink2 transition-transform group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="prose-read mt-3 text-ink2">{f.answer}</p>
                </details>
              ))}
            </div>
          </Section>
        ))
      )}

      <div className="mt-12 rounded-panel border border-line bg-surface p-5">
        <p className="text-[15px] font-semibold">Still stuck?</p>
        <p className="mt-1.5 text-sm text-ink2">
          If it is about a specific booking, open that booking and raise a ticket — the garage is notified and MEQIVA can
          step in if it is not resolved. Anything unresolved goes to the{" "}
          <Link href="/legal/grievance" className="underline">grievance process</Link>.
        </p>
      </div>
    </div>
  );
}
