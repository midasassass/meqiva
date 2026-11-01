import {
  BadgeCheck, CalendarCheck, Car, ClipboardCheck, Home, MessageSquareQuote,
  MoreHorizontal, Scale, ShieldCheck, Users,
} from "lucide-react";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/session";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const i = "h-[18px] w-[18px]";

  const groups = [
    { items: [
      { href: "/app", label: "Home", icon: <Home className={i} aria-hidden />, exact: true },
      { href: "/app/vehicles", label: "My vehicles", icon: <Car className={i} aria-hidden /> },
      { href: "/app/bookings", label: "Bookings", icon: <CalendarCheck className={i} aria-hidden /> },
    ] },
    { heading: "Before you say yes", items: [
      { href: "/app/advice", label: "Is this repair needed?", icon: <Scale className={i} aria-hidden /> },
      { href: "/app/second-opinion", label: "Second quote", icon: <MessageSquareQuote className={i} aria-hidden /> },
    ] },
    { heading: "After the work", items: [
      { href: "/app/warranties", label: "Warranties", icon: <ShieldCheck className={i} aria-hidden /> },
    ] },
    { heading: "More", items: [
      { href: "/app/family", label: "Family account", icon: <Users className={i} aria-hidden /> },
      { href: "/app/inspections", label: "Buying a used car", icon: <ClipboardCheck className={i} aria-hidden /> },
      { href: "/assistance", label: "Roadside help", icon: <BadgeCheck className={i} aria-hidden /> },
    ] },
  ];

  const bottom = [
    { href: "/app", label: "Home", icon: <Home className={i} aria-hidden />, exact: true },
    { href: "/app/vehicles", label: "Vehicles", icon: <Car className={i} aria-hidden /> },
    { href: "/app/bookings", label: "Bookings", icon: <CalendarCheck className={i} aria-hidden /> },
    { href: "/app/warranties", label: "Warranty", icon: <ShieldCheck className={i} aria-hidden /> },
    { href: "/app/more", label: "More", icon: <MoreHorizontal className={i} aria-hidden /> },
  ];

  return (
    <Shell
      workspace="My MEQIVA"
      subtitle={u.fullName ?? undefined}
      user={{ email: u.email, name: u.fullName }}
      groups={groups}
      bottom={bottom}
    >
      {children}
    </Shell>
  );
}
