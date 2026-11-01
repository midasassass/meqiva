import { redirect } from "next/navigation";
import Link from "next/link";
import { Check } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Callout, Card, Field, Input, Logo, SetupNotice, cx } from "@/components/ui";
import { registerGarage } from "@/server/onboarding";
import { requireUser } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";

export const metadata = { title: "Set up your garage", robots: { index: false } };

const STEPS = ["The workshop", "Your prices", "Go live"] as const;

export default async function Onboarding() {
  if (!hasSupabase()) {
    return <main className="mx-auto max-w-xl p-6"><SetupNotice /></main>;
  }

  const user = await requireUser();
  const sb = await supabaseServer();

  // Already runs a garage? Nothing to set up here.
  const { data: member } = await sb.from("garage_members")
    .select("garage_id").eq("user_id", user.id).limit(1).maybeSingle();
  if (member) redirect("/garage");

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/"><Logo /></Link>
          <Link href="/app" className="text-[13px] text-ink2 hover:text-ink">Skip for now</Link>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-3xl px-5 py-10">
        {/* Three steps, and the person can see which one they are on. */}
        <ol className="mb-9 flex items-center gap-2" aria-label="Setup progress">
          {STEPS.map((s, i) => (
            <li key={s} className="flex flex-1 items-center gap-2">
              <span className={cx("grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-bold transition-colors",
                i === 0 ? "bg-brand text-brand-fg" : "bg-surface2 text-ink3")}>
                {i === 0 ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={cx("text-[12.5px] font-semibold", i === 0 ? "text-ink" : "text-ink3")}>{s}</span>
              {i < STEPS.length - 1 && <span className="hidden h-px flex-1 bg-line sm:block" aria-hidden />}
            </li>
          ))}
        </ol>

        <div className="rise">
          <h1 className="display-2">Tell us about the workshop</h1>
          <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-ink2">
            Enough to create your account and your public page. You can change every bit of it afterwards, and nothing
            goes live until MEQIVA has approved the listing.
          </p>
        </div>

        <Card className="rise mt-7 p-6" style={{ "--i": 1 } as React.CSSProperties}>
          <ActionForm action={registerGarage} submitLabel="Create the garage" pendingLabel="Setting it up…" size="lg">
            <Field label="Garage name" required hint="The name customers know you by, not the registered company name.">
              <Input name="publicName" required maxLength={120} autoFocus placeholder="Sector 29 Motors" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" hint="What a customer should ring.">
                <Input name="phone" type="tel" inputMode="tel" placeholder="98765 43210" />
              </Field>
              <Field label="Service bays" required hint="How many vehicles you can work on at once.">
                <Input name="bays" type="number" inputMode="numeric" min={1} max={100} defaultValue={2} required />
              </Field>
            </div>

            <Field label="Street address">
              <Input name="address" maxLength={300} placeholder="Plot 14, Market Road" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Locality" hint="The area customers search by.">
                <Input name="locality" maxLength={80} placeholder="Sector 29" />
              </Field>
              <Field label="Pincode">
                <Input name="pincode" inputMode="numeric" maxLength={6} placeholder="122001" />
              </Field>
            </div>

            <Field label="GSTIN" hint="Optional. Needed only if you are registered and want it on invoices.">
              <Input name="gstin" maxLength={15} placeholder="06AAAAA0000A1Z5" className="uppercase" />
            </Field>
          </ActionForm>
        </Card>

        <Callout tone="brand" title="What happens next">
          You go straight to pricing — one figure per service, per vehicle type. That is what puts you in front of
          customers, because the estimator only shows garages that priced exactly what the customer asked for.
          Verification is separate, and is earned by an inspection rather than bought.
        </Callout>
      </main>
    </div>
  );
}
