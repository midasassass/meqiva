import { ActionForm } from "@/components/action-form";
import { Callout, Check, Field, Input, Panel, Select, Textarea } from "@/components/ui";
import { updateInvoicing } from "@/server/garage-settings";
import { getSettings } from "@/lib/garage-data";
import { invoiceNumber, STATE_CODES } from "@/lib/invoice";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Invoice and tax" };

export default async function Invoicing() {
  const { sb, garage } = await requireGarageOrRedirect();
  const s = await getSettings(sb, garage.id);
  const yy = String(new Date().getFullYear()).slice(2);
  const sample = invoiceNumber(s?.invoice_prefix ?? "INV", yy, 1);

  return (
    <div className="space-y-6">
      <Panel title="Invoice and tax">
        <div className="p-5">
          <ActionForm action={updateInvoicing} submitLabel="Save invoice settings" pendingLabel="Saving…">
            <Check name="gstRegistered" label="This garage is registered for GST" defaultChecked={s?.gst_registered ?? false}
              hint="Your GSTIN is held on your garage profile and printed on every invoice." />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Invoice prefix" hint={`Next invoice will read ${sample}`}>
                <Input name="invoicePrefix" maxLength={10} pattern="[A-Z0-9/-]{1,10}" defaultValue={s?.invoice_prefix ?? "INV"} />
              </Field>
              <Field label="Default GST rate (%)" hint="Per-service rates override this.">
                <Input name="defaultGstPct" type="number" inputMode="decimal" min={0} max={28} step="0.5" defaultValue={(s?.default_gst_bps ?? 1800) / 100} />
              </Field>
              <Field label="Place of supply" hint="Your state. Decides CGST and SGST against IGST.">
                <Select name="placeOfSupplyCode" defaultValue={s?.place_of_supply_code ?? "06"}>
                  {Object.entries(STATE_CODES).map(([code, name]) => (
                    <option key={code} value={code}>{code} — {name}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Terms printed on the invoice" hint="Payment terms, warranty wording, anything you want on the paper.">
              <Textarea name="invoiceTerms" rows={4} maxLength={2000} defaultValue={s?.invoice_terms ?? ""}
                placeholder="Parts carry the manufacturer's warranty. Labour warranty 30 days or 1,000 km, whichever is earlier." />
            </Field>
            <Field label="Footer line"><Input name="invoiceFooter" maxLength={500} defaultValue={s?.invoice_footer ?? ""} placeholder="Thank you. Please keep this invoice for warranty claims." /></Field>
          </ActionForm>
        </div>
      </Panel>

      <Callout tone="warn" title="Have this checked before you bill a real customer">
        Invoice format, HSN or SAC codes, place-of-supply treatment and e-invoicing thresholds depend on your turnover
        and registration. MEQIVA produces a correctly structured, rate-wise invoice, but a qualified tax advisor should
        confirm it matches your obligations.
      </Callout>
    </div>
  );
}
