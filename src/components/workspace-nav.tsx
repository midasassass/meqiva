"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "./ui";

export interface NavItem { href: string; label: string; icon: ReactNode; exact?: boolean }
export interface NavGroup { heading?: string; items: NavItem[] }

const isActive = (path: string, item: NavItem) =>
  item.exact ? path === item.href : path === item.href || path.startsWith(item.href + "/");

/** Sidebar on md and up. The active item is marked with the signal colour. */
export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto">
      {groups.map((g, i) => (
        <div key={i}>
          {g.heading && <p className="mb-1 px-3 text-[12px] font-medium text-ink2">{g.heading}</p>}
          <div className="flex flex-col gap-px">
            {g.items.map((n) => {
              const active = isActive(path, n);
              return (
                <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
                  className={cx("relative flex items-center gap-2.5 rounded-card px-3 py-2 text-[13.5px] transition-colors",
                    active ? "bg-surface2 font-medium text-ink" : "text-ink2 hover:bg-surface2/70 hover:text-ink")}>
                  {active && <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-warn" aria-hidden />}
                  <span className="shrink-0 opacity-80">{n.icon}</span>
                  {n.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** Bottom bar on phones. Kept to five targets so each stays thumb-sized. */
export function BottomNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((n) => {
        const active = isActive(path, n);
        return (
          <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined}
            className={cx("flex flex-col items-center gap-1 py-2 text-[10.5px]", active ? "text-ink" : "text-ink2")}>
            <span className={cx("rounded-sm px-2.5 py-0.5 transition-colors", active && "bg-warn-soft")}>{n.icon}</span>
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
