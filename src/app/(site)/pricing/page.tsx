import { Check, Minus } from "lucide-react";
import { Badge, ButtonLink, Callout, Card, Panel, Section } from "@/components/ui";
import { featureLabels, GARAGE_FEATURES, type GarageFeature, type FeatureMap } from "@/lib/features";
import { formatINR } from "@/lib/money";
import { hasSupabase } from "@/lib/supabase/env";
import { supabasePublic } from "@/lib/supabase/public";

export const revalidate = 600;
export const metadata = {
  title: "Plans and commission",
  description: "What MEQIVA Pro costs, and exactly when a marketplace commission applies.",
};

interface Plan { id: string; name: string; price_paise: number; interval: string; trial_days: number; max_users: number | null; max_branches: number | null; features: FeatureMap }

const SHOWN: GarageFeature[] = ["online_booking", "custom_fields", "checklists", "inventory", "crm", "reminders", "purchase_orders", "multi_branch", "marketplace_listing", "camera"];

async function getPlans(): Promise<Plan[]> {
  if (!hasSupabase()) return [];
  const { data } = await supabasePublic()
    .from("subscription_plans").select("id, name, price_paise, interval, trial_days, max_users, max_branches, features")
    .eq("active", true).order("price_paise");
  return (data ?? []) as Plan[];
}

export default async function Pricing() {
  const plans = await getPlans();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="display-2">Plans and commission</h1>
      <p className="mt-4 max-w-[58ch] text-[15px] text-ink2">
        Two separate things, deliberately. A subscription for the software you run your workshop on. A commission only
        on bookings the marketplace sends you, charged when the job completes.
      </p>

      {plans.length === 0 ? (
        <Card className="mt-8">
          <p className="text-sm text-ink2">
            Plan details are published from the admin panel. Connect the database and seed the subscription plans to show
            them here.
          </p>
        </Card>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {plans.map((p, i) => (
            <Card key={p.id} className={i === 1 ? "border-brand p-5" : "p-5"}>
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-semibold tracking-tight">{p.name}</h2>
                {i === 1 && <Badge tone="brand">Most workshops</Badge>}
              </div>
              <p className="tnum mt-3 text-3xl font-semibold tracking-tight">
                {p.price_paise === 0 ? "Free" : formatINR(p.price_paise)}
                {p.price_paise > 0 && <span className="text-sm font-normal text-ink2"> / {p.interval}</span>}
              </p>
              {p.trial_days > 0 && <p className="tnum mt-1 text-[13px] text-ink2">{p.trial_days}-day trial</p>}
              <p className="tnum mt-3 text-[13px] text-ink2">
                Up to {p.max_users ?? "unlimited"} users · {p.max_branches ?? "unlimited"} {p.max_branches === 1 ? "branch" : "branches"}
              </p>
              <ul className="mt-4 space-y-1.5 border-t border-line pt-4">
                {SHOWN.map((f) => {
                  const on = p.features?.[f] === true || ["online_booking", "custom_fields", "checklists"].includes(f);
                  return (
                    <li key={f} className={`flex items-start gap-2 text-[13px] ${on ? "" : "text-ink2/60"}`}>
                      {on ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                          : <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />}
                      {featureLabels[f]}
                    </li>
                  );
                })}
              </ul>
              <ButtonLink href="/signup?as=garage" variant={i === 1 ? "primary" : "outline"} className="mt-5 w-full">
                Start with {p.name}
              </ButtonLink>
            </Card>
          ))}
        </div>
      )}

      <Section title="When commission applies">
        <Panel>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-ink2">
                <th scope="col" className="px-4 py-2.5 font-medium">Where the job came from</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Commission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <tr><td className="px-4 py-3">A customer you already had, booked in by your team</td><td className="px-4 py-3 text-success">None, ever</td></tr>
              <tr><td className="px-4 py-3">A walk-in</td><td className="px-4 py-3 text-success">None</td></tr>
              <tr><td className="px-4 py-3">A fleet contract you hold</td><td className="px-4 py-3 text-success">None</td></tr>
              <tr><td className="px-4 py-3">A booking MEQIVA sent you, that completed</td><td className="px-4 py-3">Charged on the agreed basis</td></tr>
              <tr><td className="px-4 py-3">A booking MEQIVA sent you, cancelled or not completed</td><td className="px-4 py-3 text-success">None</td></tr>
            </tbody>
          </table>
        </Panel>
        <p className="mt-3 text-[13px] text-ink2">
          Every job card records its origin, and commission accrues once, on completion, against that record. Rates,
          whether they apply to labour only or to the whole transaction, and any category exclusions are set in your
          agreement and visible in your dashboard before anything is charged.
        </p>
      </Section>

      <Callout tone="warn" title="Before you sign anything">
        Tax treatment of the platform fee, settlement timing and the payment-partner arrangement all need review by a
        qualified advisor for your business. MEQIVA will share the agreement in full and will not charge a commission
        that is not in it.
      </Callout>
    </div>
  );
}
