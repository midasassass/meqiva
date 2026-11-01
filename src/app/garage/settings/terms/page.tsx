import { ActionForm } from "@/components/action-form";
import { Callout, Field, Panel, Textarea } from "@/components/ui";
import { saveTerms } from "@/server/garage-settings";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Customer terms" };

export default async function Terms() {
  const { sb, garage } = await requireGarageOrRedirect();
  const { data: t } = await sb.from("garage_terms")
    .select("warranty_policy, cancellation_policy, service_terms").eq("garage_id", garage.id).maybeSingle();

  return (
    <div className="space-y-6">
      <Panel title="What your customers agree to" description="Shown on your public profile and at the point of booking.">
        <div className="p-5">
          <ActionForm action={saveTerms} submitLabel="Save terms" pendingLabel="Saving…">
            <Field label="Warranty" hint="What you stand behind, for how long, and what voids it.">
              <Textarea name="warrantyPolicy" rows={4} maxLength={4000} defaultValue={t?.warranty_policy ?? ""}
                placeholder="Labour is warranted for 30 days or 1,000 km, whichever comes first. Parts carry the manufacturer's own warranty, which we will help you claim." />
            </Field>
            <Field label="Cancellation" hint="Be specific about parts already ordered — it prevents most disputes.">
              <Textarea name="cancellationPolicy" rows={4} maxLength={4000} defaultValue={t?.cancellation_policy ?? ""}
                placeholder="Cancel free of charge up to 6 hours before your slot. If we have already ordered a part specifically for your vehicle, we will tell you what it cost before you decide." />
            </Field>
            <Field label="Anything else" hint="Storage after collection date, diagnostic fees, payment terms.">
              <Textarea name="serviceTerms" rows={5} maxLength={8000} defaultValue={t?.service_terms ?? ""} />
            </Field>
          </ActionForm>
        </div>
      </Panel>

      <Callout tone="warn" title="These are your terms, not MEQIVA's">
        The repair contract is between you and your customer. MEQIVA shows your terms and holds the record of what was
        agreed, but it does not stand behind your warranty. Have anything you are unsure of reviewed by a lawyer, and
        remember that consumer law sets a floor these terms cannot go below.
      </Callout>
    </div>
  );
}
