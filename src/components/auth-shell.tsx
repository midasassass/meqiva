import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./ui";

/**
 * Split layout for the two auth pages. The left panel carries the reason to bother
 * signing up at all, which a bare centred card never does.
 */
export function AuthShell({ title, subtitle, children, aside, footer }: {
  title: string; subtitle?: string; children: ReactNode; aside?: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1fr_minmax(0,32rem)]">
      <aside className="glow relative hidden flex-col justify-between overflow-hidden border-r border-line bg-surface p-10 lg:flex">
        <Link href="/"><Logo /></Link>
        <div className="max-w-md">{aside}</div>
        <p className="text-[12px] text-ink3">
          MEQIVA is an intermediary. Repairs are carried out by independent garages.
        </p>
      </aside>

      <main id="main" className="flex min-h-dvh flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-8 inline-block lg:hidden"><Logo /></Link>
          <div className="rise">
            <h1 className="display-2">{title}</h1>
            {subtitle && <p className="mt-2 text-[14.5px] leading-relaxed text-ink2">{subtitle}</p>}
          </div>
          <div className="rise mt-7" style={{ "--i": 1 } as React.CSSProperties}>{children}</div>
          {footer && <div className="rise mt-6 text-center text-[13.5px] text-ink2" style={{ "--i": 2 } as React.CSSProperties}>{footer}</div>}
        </div>
      </main>
    </div>
  );
}
