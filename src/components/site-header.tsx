import Link from "next/link";
import { ButtonLink, Logo } from "./ui";

const LINKS = [
  { href: "/find", label: "Find a garage" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/verification", label: "Verification" },
  { href: "/assistance", label: "Roadside help" },
  { href: "/for-garages", label: "For garages" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
        <Link href="/" aria-label="MEQIVA home"><Logo /></Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-card px-3 py-2 text-[13.5px] text-ink2 transition-colors hover:bg-surface2 hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ButtonLink href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">Sign in</ButtonLink>
          <ButtonLink href="/find" size="sm">Get estimates</ButtonLink>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-line px-4 py-1.5 lg:hidden">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="shrink-0 rounded-card px-2.5 py-1 text-[13px] text-ink2">{l.label}</Link>
        ))}
      </nav>
    </header>
  );
}
