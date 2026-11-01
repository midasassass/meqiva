import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Check, Empty, Field, Input, Panel, Select, Table, Td, Tr } from "@/components/ui";
import { deleteFieldDef, saveFieldDef } from "@/server/garage-settings";
import { FIELD_TYPE_LABEL, type FieldDef, type FieldType } from "@/lib/fields";
import { getFieldDefs } from "@/lib/garage-data";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Job card fields" };

export default async function Fields() {
  const { sb, garage } = await requireGarageOrRedirect();
  const defs = await getFieldDefs(sb, garage.id, "job_card");

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
      <Panel
        title="Your job card"
        description="These fields appear on every job card your team opens, in this order."
      >
        {defs.length === 0 ? (
          <div className="p-5">
            <Empty
              title="Using the standard job card"
              body="Add a field for anything your workshop records by hand today — key tag number, fuel level, who dropped the vehicle off."
            />
          </div>
        ) : (
          <Table head={["Field", "Type", "Rules", ""]}>
            {defs.map((d: FieldDef) => (
              <Tr key={d.id}>
                <Td>
                  <p className="font-medium">{d.label}</p>
                  <p className="tnum text-xs text-ink2">{d.key}</p>
                  {d.help && <p className="mt-0.5 text-xs text-ink2">{d.help}</p>}
                </Td>
                <Td className="text-[13px] text-ink2">
                  {FIELD_TYPE_LABEL[d.type as FieldType]}
                  {d.options.length > 0 && <span className="block text-xs">{d.options.join(", ")}</span>}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {d.required && <Badge tone="warn">Required</Badge>}
                    {d.showToCustomer && <Badge tone="outline">Customer sees it</Badge>}
                  </div>
                </Td>
                <Td className="text-right">
                  <ActionButton action={deleteFieldDef} label="Retire" variant="ghost" hidden={{ id: d.id }}
                    confirm="Retire this field? Existing job cards keep what they already recorded." />
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="Add a field">
        <div className="p-4">
          <ActionForm action={saveFieldDef} submitLabel="Add field" pendingLabel="Adding…" resetOnSuccess fullWidth>
            <input type="hidden" name="entity" value="job_card" />
            <Field label="Label" required hint="What your team sees on the job card.">
              <Input name="label" required maxLength={80} placeholder="Key tag number" />
            </Field>
            <Field label="Key" required hint="Used in exports and reports. Lowercase, no spaces.">
              <Input name="key" required maxLength={39} pattern="[a-z][a-z0-9_]*" placeholder="key_tag_number" />
            </Field>
            <Field label="Type" required>
              <Select name="type" defaultValue="text">
                {Object.entries(FIELD_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
            <Field label="Options" hint="For a choice field. Separate with commas.">
              <Input name="options" maxLength={500} placeholder="Empty, Quarter, Half, Full" />
            </Field>
            <Field label="Helper text"><Input name="help" maxLength={200} /></Field>
            <Field label="Position" hint="Lower numbers appear first.">
              <Input name="sort" type="number" inputMode="numeric" min={0} max={999} defaultValue={defs.length} />
            </Field>
            <Check name="required" label="Required" hint="The job card cannot be saved without it." />
            <Check name="showToCustomer" label="Show on the customer's booking page" />
          </ActionForm>
        </div>
      </Panel>
    </div>
  );
}
