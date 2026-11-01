import { ActionForm } from "@/components/action-form";
import { Badge, Callout, Panel } from "@/components/ui";
import { updateFeatures } from "@/server/garage-settings";
import { GARAGE_FEATURES, featureLabels, type FeatureMap } from "@/lib/features";
import { getFeatures } from "@/lib/garage-data";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Features" };

const BLURB: Partial<Record<(typeof GARAGE_FEATURES)[number], string>> = {
  marketplace_listing: "Appear in MEQIVA search results and take bookings from new customers.",
  online_booking: "Let customers pick a slot themselves.",
  pickup_drop: "Offer collection and delivery of the vehicle.",
  inventory: "Track stock, costs and reorder levels.",
  purchase_orders: "Raise orders with suppliers and receive stock against them.",
  crm: "Customer records, history and spend.",
  reminders: "Flag vehicles due for service.",
  checklists: "Inspection checklists on job cards.",
  custom_fields: "Your own fields on the job card.",
  camera: "Live view of the bay during a customer's own service.",
  voice_job_card: "Dictate a job card instead of typing it.",
  multi_branch: "Run more than one workshop under this account.",
  fleet: "Company accounts with several vehicles and consolidated billing.",
  ai_insights: "Ask questions about your own data in plain language.",
  whatsapp: "Send updates over WhatsApp.",
};

export default async function Features() {
  const { sb, garage } = await requireGarageOrRedirect();
  const [effective, settingsRes] = await Promise.all([
    getFeatures(sb, garage.id),
    sb.from("garage_settings").select("features").eq("garage_id", garage.id).maybeSingle(),
  ]);
  const chosen = (settingsRes.data?.features ?? {}) as FeatureMap;

  return (
    <div className="space-y-6">
      <Callout tone="neutral" title="Switch off what you do not use">
        A feature here is available when your plan includes it and MEQIVA has the provider connected for it. Switching
        one off hides it for your whole team — it does not delete anything, and you can switch it back on at any time.
      </Callout>

      <Panel title="Features">
        <div className="p-5">
          <ActionForm action={updateFeatures} submitLabel="Save features" pendingLabel="Saving…">
            <ul className="divide-y divide-line">
              {GARAGE_FEATURES.map((f) => {
                const available = effective[f] || chosen[f] === false;
                const lockedByPlatform = !effective[f] && chosen[f] !== false;
                return (
                  <li key={f} className="flex items-start justify-between gap-4 py-3">
                    <label className="flex min-w-0 cursor-pointer items-start gap-3">
                      <input type="checkbox" name={`feature.${f}`} defaultChecked={chosen[f] !== false}
                        disabled={lockedByPlatform} className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)] disabled:opacity-40" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{featureLabels[f]}</span>
                        {BLURB[f] && <span className="mt-0.5 block text-[12.5px] text-ink2">{BLURB[f]}</span>}
                      </span>
                    </label>
                    {lockedByPlatform
                      ? <Badge tone="outline">Not available on your plan</Badge>
                      : available && <Badge tone="success">Available</Badge>}
                  </li>
                );
              })}
            </ul>
          </ActionForm>
        </div>
      </Panel>
    </div>
  );
}
