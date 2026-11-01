import Link from "next/link";
import { ShieldCheck, Wallet, Wrench } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { SignInForm } from "@/components/auth-form";
import { SetupNotice } from "@/components/ui";
import { hasSupabase } from "@/lib/supabase/env";

export const metadata = { title: "Sign in", robots: { index: false } };

const POINTS = [
  [Wallet, "Every estimate you were sent, and what you approved"],
  [Wrench, "Live progress on whatever is in the workshop"],
  [ShieldCheck, "Your vehicles' full service history, exportable any time"],
] as const;

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Pick up where you left off."
      aside={
        <div>
          <h2 className="display-2">Everything you agreed to, in one place.</h2>
          <ul className="mt-8 space-y-5">
            {POINTS.map(([Icon, text], i) => (
              <li key={text} className="rise flex gap-3.5" style={{ "--i": i + 1 } as React.CSSProperties}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-card bg-brand-soft text-brand">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <span className="pt-2 text-[14.5px] text-ink2">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      }
      footer={<>New here? <Link href="/signup" className="font-semibold text-brand hover:underline">Create an account</Link></>}
    >
      {hasSupabase() ? <SignInForm next={next} /> : <SetupNotice />}
    </AuthShell>
  );
}
