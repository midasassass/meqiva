import Link from "next/link";
import { PageTitle, Panel } from "@/components/ui";

export const metadata = { title: "More" };

const SECTIONS: { heading: string; links: [string, string, string][] }[] = [
  { heading: "Before you say yes", links: [
    ["/app/advice", "Is this repair needed?", "Independent advice on a quote, from MEQIVA and not the garage"],
    ["/app/second-opinion", "Second quote", "Ask other workshops to price the same job"],
    ["/estimate", "What will it cost?", "Market prices for your vehicle before you book"],
  ] },
  { heading: "After the work", links: [
    ["/app/warranties", "Warranties", "Who covers what, and until when"],
    ["/app/bookings", "Bookings", "Everything in progress and everything finished"],
  ] },
  { heading: "More", links: [
    ["/app/family", "Family account", "Share vehicles with the people who drive them"],
    ["/app/inspections", "Buying a used car", "Get it inspected before you pay"],
    ["/assistance", "Roadside help", "Towing, battery, tyre and fuel numbers"],
    ["/find", "Find a garage", "Compare workshops near you"],
  ] },
];

export default function More() {
  return (
    <>
      <PageTitle title="Everything else" />
      <div className="space-y-5">
        {SECTIONS.map((s) => (
          <Panel key={s.heading} title={s.heading}>
            <ul className="divide-y divide-line">
              {s.links.map(([href, label, hint]) => (
                <li key={href}>
                  <Link href={href} className="block px-4 py-3.5 transition-colors hover:bg-surface2/60">
                    <p className="text-sm font-semibold">{label}</p>
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
