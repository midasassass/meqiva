import Link from "next/link";
import type { ReactNode } from "react";
import { BottomNav, SidebarNav, type NavGroup, type NavItem } from "./workspace-nav";
import { Avatar, Logo } from "./ui";
import { signOut } from "@/app/actions";
import { resolveTheme, themeVars } from "@/lib/theme";

/**
 * Workspace shell. Sidebar on desktop, bottom bar on phones. Entirely server
 * rendered apart from the nav's active-state marker, so a technician on an old
 * Android phone downloads almost no JavaScript.
 */
export function Shell({ workspace, subtitle, groups, bottom, children, user, accentHex, badge }: {
  workspace: string;
  subtitle?: string;
  groups: NavGroup[];
  bottom: NavItem[];
  children: ReactNode;
  user?: { email?: string | null; name?: string | null };
  /** A garage's own accent, applied to its workspace chrome. */
  accentHex?: string | null;
  badge?: ReactNode;
}) {
  const style = accentHex ? (themeVars(resolveTheme(accentHex)) as React.CSSProperties) : undefined;
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[236px_1fr]" style={style}>
      <aside className="sticky top-0 hidden h-dvh flex-col gap-5 border-r border-line bg-surface px-3 py-4 md:flex">
        <Link href="/" className="px-2"><Logo /></Link>
        <div className="px-3">
          <p className="truncate text-[13.5px] font-medium">{workspace}</p>
          {subtitle && <p className="truncate text-xs text-ink2">{subtitle}</p>}
          {badge && <div className="mt-2">{badge}</div>}
        </div>
        <SidebarNav groups={groups} />
        <form action={signOut} className="border-t border-line pt-3">
          <div className="mb-2 flex items-center gap-2 px-2">
            <Avatar name={user?.name ?? user?.email} size={26} />
            <span className="min-w-0 flex-1 truncate text-xs text-ink2">{user?.name ?? user?.email}</span>
          </div>
          <button className="w-full rounded-card px-3 py-2 text-left text-[13px] text-ink2 transition-colors hover:bg-surface2 hover:text-ink">
            Sign out
          </button>
        </form>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 backdrop-blur md:hidden">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{workspace}</p>
            {subtitle && <p className="truncate text-[11px] text-ink2">{subtitle}</p>}
          </div>
          <form action={signOut}><button className="text-[13px] text-ink2">Sign out</button></form>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 md:pb-12 md:pt-8">{children}</main>
      </div>

      <BottomNav items={bottom} />
    </div>
  );
}
