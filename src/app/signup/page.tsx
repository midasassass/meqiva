import Link from "next/link";
import { ArrowRight, Car, Wrench } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { SignUpForm } from "@/components/auth-form";
import { Card, SetupNotice, cx } from "@/components/ui";
import { hasSupabase } from "@/lib/supabase/env";

export const metadata = { title: "Create an account", robots: { index: false } };

const PATHS = [
  {
    id: "customer", href: "/signup?as=customer", icon: Car,
    title: "I own a vehicle",
    body: "Compare real prices before you book, approve any extra work, and keep the service history.",
  },
  {
    id: "garage", href: "/signup?as=garage", icon: Wrench,
    title: "I run a garage",
    body: "Price your services, take bookings, and run job cards, stock and invoicing. No fee on your own customers.",
  },
] as const;

const ASIDE = {
  customer: { h: "Know the price before you hand over the keys.", p: "Parts, labour and tax up front. Nothing extra is billed without your word." },
  garage: { h: "Set your prices once. Appear in every matching search.", p: "Price each service by vehicle type and the estimator puts you in front of customers looking for exactly that." },
} as const;

export default async function Signup({ searchParams }: { searchParams: Promise<{ as?: string; next?: string }> }) {
  const sp = await searchParams;
  const intent = sp.as === "garage" ? "garage" : sp.as === "customer" ? "customer" : null;

  if (!intent) {
    return (
      <AuthShell
        title="Create your account"
        subtitle="Two very different jobs, so let us start in the right place."
        aside={
          <div>
            <h2 className="display-2">One platform, two sides of the same bill.</h2>
            <p className="mt-4 text-[15px] leading-relaxed text-ink2">
              Vehicle owners get a price they can check. Garages get the software that produces it. Both halves read the
              same records, which is why the numbers always agree.
            </p>
            <ul className="mt-9 space-y-4 border-t border-line pt-7">
              {[
                ["Prices come from garages, not from us", "Every figure in an estimate is one a real workshop published for your exact vehicle type."],
                ["Nothing is added without a yes", "Extra work needs a fresh authorisation. An invoice carrying unapproved work will not issue."],
                ["Verification is earned, never sold", "Inspection levels come from an audit and carry the date they were given."],
              ].map(([h, b], i) => (
                <li key={h} className="rise" style={{ "--i": i + 1 } as React.CSSProperties}>
                  <p className="text-[14px] font-bold">{h}</p>
                  <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink2">{b}</p>
                </li>
              ))}
            </ul>
          </div>
        }
        footer={<>Already registered? <Link href="/login" className="font-semibold text-brand hover:underline">Sign in</Link></>}
      >
        <div className="space-y-3">
          {PATHS.map((p, i) => (
            <Link key={p.id} href={p.href} className={cx("block rise")} style={{ "--i": i } as React.CSSProperties}>
              <Card hover className="group flex items-start gap-4 p-5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-card bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-brand-fg">
                  <p.icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="display-3">{p.title}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-ink3 transition-transform group-hover:translate-x-1 group-hover:text-brand" aria-hidden />
                  </span>
                  <span className="mt-1 block text-[13.5px] leading-relaxed text-ink2">{p.body}</span>
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </AuthShell>
    );
  }

  const copy = ASIDE[intent];
  return (
    <AuthShell
      title={intent === "garage" ? "Set up your garage" : "Create your account"}
      subtitle={intent === "garage"
        ? "Your details first. The workshop and its prices come next."
        : "Takes about a minute."}
      aside={<div><h2 className="display-2">{copy.h}</h2><p className="mt-4 text-[15px] leading-relaxed text-ink2">{copy.p}</p></div>}
      footer={
        <>
          <Link href="/signup" className="text-ink2 hover:text-ink hover:underline">Not {intent === "garage" ? "a garage" : "a vehicle owner"}?</Link>
          <span className="mx-2 text-ink3">·</span>
          <Link href="/login" className="font-semibold text-brand hover:underline">Sign in instead</Link>
        </>
      }
    >
      {hasSupabase() ? <SignUpForm intent={intent} next={sp.next} /> : <SetupNotice />}
    </AuthShell>
  );
}
