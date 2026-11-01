import { ActionForm } from "@/components/action-form";
import { Callout, Field, Input, Panel } from "@/components/ui";
import { updateCommercials } from "@/server/garage-settings";
import { getSettings } from "@/lib/garage-data";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Margins" };

export default async function Commercials() {
  const { sb, garage } = await requireGarageOrRedirect();
  const s = await getSettings(sb, garage.id);

  return (
    <div className="space-y-6">
      <Panel title="Pricing defaults" description="Used by the quotation builder every time your team starts a new quote.">
        <div className="p-5">
          <ActionForm action={updateCommercials} submitLabel="Save defaults" pendingLabel="Saving…">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Default labour rate (₹ per hour)">
                <Input name="defaultLabourRate" type="number" inputMode="decimal" min={0} step="10" defaultValue={(s?.default_labour_rate_paise ?? 60000) / 100} />
              </Field>
              <Field label="Default warranty (days)">
                <Input name="defaultWarrantyDays" type="number" inputMode="numeric" min={0} max={3650} defaultValue={s?.default_warranty_days ?? 30} />
              </Field>
              <Field label="Target contribution margin (%)" hint="What a healthy job looks like for your workshop.">
                <Input name="targetMarginPct" type="number" inputMode="decimal" min={0} max={100} step="0.5" defaultValue={(s?.target_margin_bps ?? 3000) / 100} />
              </Field>
              <Field label="Warn below (%)" hint="The builder flags any quote that falls under this.">
                <Input name="lowMarginAlertPct" type="number" inputMode="decimal" min={0} max={100} step="0.5" defaultValue={(s?.low_margin_alert_bps ?? 1000) / 100} />
              </Field>
            </div>
          </ActionForm>
        </div>
      </Panel>

      <Callout tone="neutral" title="Contribution is not profit">
        Contribution is what a job leaves after the parts, the labour and the other direct costs of doing it. Your rent,
        electricity, equipment and salaries come out of that. MEQIVA never calls contribution profit, and neither should
        a quote you show a customer.
      </Callout>
    </div>
  );
}
