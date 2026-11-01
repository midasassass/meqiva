import Link from "next/link";
import { Logo } from "./ui";

const COLS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "For vehicle owners",
    links: [
      { href: "/find", label: "Find a garage" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/verification", label: "What verification means" },
      { href: "/assistance", label: "Roadside help" },
      { href: "/help", label: "Help centre" },
    ],
  },
  {
    heading: "For garages",
    links: [
      { href: "/for-garages", label: "MEQIVA Pro" },
      { href: "/pricing", label: "Plans and commission" },
      { href: "/for-garages#apply", label: "Become a partner" },
      { href: "/help?for=garage", label: "Garage help" },
    ],
  },
  {
    heading: "Company",
    links: [
      { href: "/legal/about", label: "About" },
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/grievance", label: "Grievance redressal" },
      { href: "/status", label: "System status" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-ink2">
              Itemised service estimates from verified garages, and the workshop system those garages run on. Operated from Gurugram, Haryana.
            </p>
          </div>
          {COLS.map((c) => (
            <div key={c.heading}>
              <p className="text-[13px] font-semibold">{c.heading}</p>
              <ul className="mt-3 space-y-2">
                {c.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link href={l.href} className="text-[13px] text-ink2 transition-colors hover:text-ink">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 space-y-2 border-t border-line pt-6 text-xs leading-relaxed text-ink2">
          <p>
            MEQIVA is an intermediary. Repairs are carried out by independent garages, which issue their own tax invoices and own the
            workmanship warranty. MEQIVA verification is an independent inspection, not a government or manufacturer certification.
          </p>
          <p>© {new Date().getFullYear()} MEQIVA. All prices in INR and inclusive of tax where stated.</p>
        </div>
      </div>
    </footer>
  );
}
