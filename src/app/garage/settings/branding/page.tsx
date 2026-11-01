import { ActionForm } from "@/components/action-form";
import { AccentPicker } from "@/components/accent-picker";
import { Field, Input, Panel, Textarea } from "@/components/ui";
import { updateBranding } from "@/server/garage-settings";
import { getSettings } from "@/lib/garage-data";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Branding" };

export default async function Branding() {
  const { sb, garage } = await requireGarageOrRedirect();
  const s = await getSettings(sb, garage.id);

  return (
    <Panel title="How your garage looks" description="Applied to your public profile, your booking page and your team's dashboard.">
      <div className="p-5">
        <ActionForm action={updateBranding} submitLabel="Save branding" pendingLabel="Saving…">
          <Field label="Accent colour" hint="Used for buttons and highlights across everything your customers see.">
            <AccentPicker name="accentHex" defaultValue={s?.accent_hex} />
          </Field>
          <Field label="Tagline" hint="One line under your name on your profile. Say what you are known for.">
            <Input name="tagline" maxLength={120} defaultValue={s?.tagline ?? ""} placeholder="Maruti and Hyundai specialists since the Sector 14 days" />
          </Field>
          <Field label="About the workshop" hint="Who you are, what you specialise in, how long you have been here.">
            <Textarea name="about" rows={5} maxLength={2000} defaultValue={s?.about ?? ""} />
          </Field>
          <Field label="Logo URL" hint="Optional. Direct link to a square image. File uploads are coming.">
            <Input name="logoUrl" type="url" maxLength={500} defaultValue={s?.logo_url ?? ""} placeholder="https://" />
          </Field>
        </ActionForm>
      </div>
    </Panel>
  );
}
