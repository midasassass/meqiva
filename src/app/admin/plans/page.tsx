import { ActionForm } from "@/components/action-form";
import { Badge, Callout, Check, Field, Input, PageTitle, Panel, Select, Table, Td, Textarea, Tr } from "@/components/ui";
import { savePlan } from "@/server/admin";
import { GARAGE_FEATURES } from "@/lib/features";
import { formatINR } from "@/lib/money";
import { requireRole } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Plans" };

export default async function Plans() {
  await requireRole("super_admin");
  const sb = await supabaseServer();
  const { data } = await sb.from("subscription_plans")
    .select("id, name, price_paise, interval, trial_days, max_users, max_branches, features, active")
    .order("price_paise");
  const plans = data ?? [];

  const example = JSON.stringify(
    Object.fromEntries(GARAGE_FEATURES.slice(0, 5).map((f) => [f, true])), null, 0,
  );

  return (
    <>
      <PageTitle title="Subscription plans" sub="What each plan includes. Published straight to the public pricing page." />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Panel title="Plans">
          <Table head={["Plan", "Price", "Limits", ""]}>
            {plans.map((p) => (
              <Tr key={p.id}>
                <Td>
                  <p className="font-medium">{p.name}</p>
                  <p className="tnum text-xs text-ink2">{p.id} · {p.trial_days}-day trial</p>
                </Td>
                <Td className="tnum">{p.price_paise === 0 ? "Free" : `${formatINR(Number(p.price_paise))}/${p.interval}`}</Td>
                <Td className="tnum text-[13px] text-ink2">
                  {p.max_users ?? "∞"} users · {p.max_branches ?? "∞"} branches
                </Td>
                <Td className="text-right"><Badge tone={p.active ? "success" : "neutral"}>{p.active ? "Live" : "Hidden"}</Badge></Td>
              </Tr>
            ))}
          </Table>
        </Panel>

        <Panel title="Add or edit a plan" description="Saving with an existing id replaces that plan.">
          <div className="p-4">
            <ActionForm action={savePlan} submitLabel="Save plan" fullWidth>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Id" required hint="Lowercase, no spaces."><Input name="id" required maxLength={40} pattern="[a-z0-9_-]+" placeholder="growth" /></Field>
                <Field label="Name" required><Input name="name" required maxLength={60} placeholder="Growth" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price (₹)" required><Input name="price" type="number" inputMode="decimal" min={0} step="1" required defaultValue={0} /></Field>
                <Field label="Billed">
                  <Select name="interval" defaultValue="month"><option value="month">Monthly</option><option value="year">Yearly</option></Select>
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Trial days"><Input name="trialDays" type="number" min={0} max={365} defaultValue={30} /></Field>
                <Field label="Max users"><Input name="maxUsers" type="number" min={1} max={1000} /></Field>
                <Field label="Max branches"><Input name="maxBranches" type="number" min={1} max={500} /></Field>
              </div>
              <Field label="Features" hint={`JSON. Known keys: ${GARAGE_FEATURES.join(", ")}`}>
                <Textarea name="features" rows={4} maxLength={2000} defaultValue={example} className="font-mono text-[12px]" />
              </Field>
              <Check name="hidden" label="Save without publishing" />
            </ActionForm>
          </div>
        </Panel>
      </div>

      <Callout tone="neutral">
        A plan only ever grants features. It can never grant a verification level, change a review score, or affect
        where a garage appears in a comparison.
      </Callout>
    </>
  );
}
