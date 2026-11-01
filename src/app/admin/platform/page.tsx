import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Callout, Field, PageTitle, Panel, Table, Td, Textarea, Tr } from "@/components/ui";
import { savePlatformSetting, setFeatureFlag } from "@/server/admin";
import { cameraMode, paymentMode } from "@/lib/payments";
import { requireRole } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Configuration" };

export default async function Platform() {
  await requireRole("super_admin");
  const sb = await supabaseServer();
  const [flagsRes, settingsRes] = await Promise.all([
    sb.from("feature_flags").select("key, enabled, note").order("key"),
    sb.from("platform_settings").select("key, value, description, updated_at").order("key"),
  ]);
  const flags = flagsRes.data ?? [];
  const settings = settingsRes.data ?? [];
  const env = process.env as Record<string, string | undefined>;

  const integrations = [
    { name: "Payments", mode: paymentMode(env) },
    { name: "Live camera", mode: cameraMode(env) },
    { name: "WhatsApp / SMS", mode: env.WHATSAPP_TOKEN || env.SMS_API_KEY ? "live" : "unavailable" },
    { name: "Email", mode: env.RESEND_API_KEY ? "live" : "unavailable" },
    { name: "Maps", mode: env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ? "live" : "unavailable" },
    { name: "AI provider", mode: env.AI_PROVIDER ? "live" : "unavailable" },
  ] as const;

  return (
    <>
      <PageTitle title="Platform configuration" sub="Kill switches and defaults that apply to every garage." />

      <Callout tone="neutral" title="A flag can only ever switch something off">
        A garage sees a feature when the platform allows it, its plan includes it and it has not switched it off itself.
        Turning a flag off here hides that feature everywhere, immediately.
      </Callout>

      <div className="mt-5 grid gap-6 lg:grid-cols-2 lg:items-start">
        <Panel title="Feature flags">
          <Table head={["Flag", "State", ""]}>
            {flags.map((f) => (
              <Tr key={f.key}>
                <Td>
                  <p className="font-medium">{f.key.replace(/_/g, " ")}</p>
                  {f.note && <p className="text-xs text-ink2">{f.note}</p>}
                </Td>
                <Td><Badge tone={f.enabled ? "success" : "neutral"}>{f.enabled ? "On" : "Off"}</Badge></Td>
                <Td className="text-right">
                  <ActionButton action={setFeatureFlag} label={f.enabled ? "Turn off" : "Turn on"} variant="ghost" hidden={{ key: f.key }} />
                </Td>
              </Tr>
            ))}
          </Table>
        </Panel>

        <Panel title="Integrations" description="Read from the environment. Credentials are never shown here.">
          <ul className="divide-y divide-line">
            {integrations.map((i) => (
              <li key={i.name} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{i.name}</span>
                <Badge tone={i.mode === "live" ? "success" : i.mode === "sandbox" ? "warn" : "neutral"}>{i.mode}</Badge>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-3 text-xs text-ink2">
            A feature with no credentials is shown as unavailable to customers and garages. It is never simulated.
          </p>
        </Panel>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {settings.map((s) => (
          <Panel key={s.key} title={s.key} description={s.description ?? undefined}>
            <div className="p-4">
              <ActionForm action={savePlatformSetting} submitLabel="Save" variant="outline" size="sm">
                <input type="hidden" name="key" value={s.key} />
                <Field label="Value" hint="JSON.">
                  <Textarea name="value" rows={4} className="font-mono text-[12px]" defaultValue={JSON.stringify(s.value, null, 2)} />
                </Field>
              </ActionForm>
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
