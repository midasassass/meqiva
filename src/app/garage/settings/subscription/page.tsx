import { Check, Minus } from "lucide-react";
import { Badge, ButtonLink, Callout, DataList, Panel } from "@/components/ui";
import { featureLabels, GARAGE_FEATURES, type FeatureMap } from "@/lib/features";
import { getFeatures } from "@/lib/garage-data";
import { formatINR } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Plan" };

export default async function Subscription() {
  const { sb, garage } = await requireGarageOrRedirect();
  const [subRes, effective, commissionRes] = await Promise.all([
    sb.from("subscriptions")
      .select("status, current_period_end, created_at, subscription_plans(id, name, price_paise, interval, trial_days, max_users, max_branches, features)")
      .eq("garage_id", garage.id).maybeSingle(),
    getFeatures(sb, garage.id),
    sb.from("commission_rules").select("type, rate_bps, amount_paise, garage_id").or(`garage_id.eq.${garage.id},garage_id.is.null`).eq("active", true).order("garage_id", { nullsFirst: false }).limit(1).maybeSingle(),
  ]);

  const sub = subRes.data as unknown as {
    status: string; current_period_end: string | null; created_at: string;
    subscription_plans: { id: string; name: string; price_paise: number; interval: string; trial_days: number; max_users: number | null; max_branches: number | null; features: FeatureMap } | null;
  } | null;
  const plan = sub?.subscription_plans ?? null;
  const rule = commissionRes.data;

  const commissionText = !rule ? "No marketplace commission is configured."
    : rule.type === "fixed" ? `${formatINR(Number(rule.amount_paise ?? 0))} per completed marketplace booking.`
    : rule.type === "pct_labour" ? `${(Number(rule.rate_bps) / 100).toFixed(1)}% of labour on completed marketplace bookings.`
    : `${(Number(rule.rate_bps) / 100).toFixed(1)}% of the transaction on completed marketplace bookings.`;

  return (
    <div className="space-y-6">
      <Panel title="Your plan">
        <div className="p-5">
          {plan ? (
            <DataList rows={[
              ["Plan", <span key="p" className="font-medium">{plan.name}</span>],
              ["Price", plan.price_paise === 0 ? "Free" : `${formatINR(plan.price_paise)} per ${plan.interval}`],
              ["Status", <Badge key="s" tone={sub?.status === "active" ? "success" : sub?.status === "trialing" ? "warn" : "danger"}>{sub?.status}</Badge>],
              ["Renews", sub?.current_period_end ? fmtDate(sub.current_period_end) : "—"],
              ["Users included", plan.max_users ?? "Unlimited"],
              ["Branches included", plan.max_branches ?? "Unlimited"],
            ]} />
          ) : (
            <p className="text-sm text-ink2">
              No subscription record yet. Your workshop runs on the free baseline — job cards, quotations, custom fields
              and checklists — until MEQIVA sets a plan up with you.
            </p>
          )}
        </div>
      </Panel>

      <Panel title="What is switched on for you" description="Plan, platform availability and your own choices combined.">
        <ul className="grid gap-px bg-line sm:grid-cols-2">
          {GARAGE_FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2 bg-surface px-4 py-2.5 text-[13px]">
              {effective[f]
                ? <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                : <Minus className="h-3.5 w-3.5 shrink-0 text-ink2" aria-hidden />}
              <span className={effective[f] ? "" : "text-ink2"}>{featureLabels[f]}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Marketplace commission">
        <div className="space-y-3 p-5">
          <p className="text-sm">{commissionText}</p>
          <p className="text-[13px] text-ink2">
            Nothing is charged on your own walk-ins, your returning customers or fleet contract work. Commission accrues
            once, when a marketplace booking completes, against the origin recorded on the job card.
          </p>
          <ButtonLink href="/garage/invoices?tab=commission" variant="outline" size="sm">See what has accrued</ButtonLink>
        </div>
      </Panel>

      <Callout tone="neutral">
        If a plan lapses, nothing is deleted and no job in progress is interrupted. You keep job cards, quotations,
        custom fields and checklists, and you can export your records at any time.
      </Callout>
    </div>
  );
}
