import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Empty, Field, Input, Panel, Section, Select, Check } from "@/components/ui";
import { deleteChecklistItem, saveChecklist, saveChecklistItem } from "@/server/garage-settings";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Checklists" };

export default async function Checklists() {
  const { sb, garage } = await requireGarageOrRedirect();

  const [listsRes, catsRes] = await Promise.all([
    sb.from("garage_checklists")
      .select("id, name, require_photo, category_id, service_categories(name), garage_checklist_items(id, label, help, require_photo, sort)")
      .eq("garage_id", garage.id).eq("active", true).order("name"),
    sb.from("service_categories").select("id, name").order("name"),
  ]);

  const lists = (listsRes.data ?? []) as unknown as {
    id: string; name: string; require_photo: boolean; category_id: number | null;
    service_categories: { name: string } | null;
    garage_checklist_items: { id: string; label: string; help: string | null; require_photo: boolean; sort: number }[];
  }[];
  const cats = catsRes.data ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
      <div className="space-y-5">
        {lists.length === 0 ? (
          <Empty
            title="No checklists yet"
            body="A checklist turns 'we always check the brakes' into something recorded on the job card, with a photo if you want one."
          />
        ) : (
          lists.map((l) => (
            <Panel key={l.id} title={l.name} description={l.service_categories?.name ? `Used on ${l.service_categories.name.toLowerCase()}` : "Used on any service"}>
              {l.garage_checklist_items.length === 0 ? (
                <p className="px-4 py-4 text-[13px] text-ink2">No items yet. Add the first one on the right.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {[...l.garage_checklist_items].sort((a, b) => a.sort - b.sort).map((it) => (
                    <li key={it.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="text-sm">{it.label}</p>
                        {it.help && <p className="mt-0.5 text-xs text-ink2">{it.help}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {it.require_photo && <Badge tone="warn">Photo</Badge>}
                        <ActionButton action={deleteChecklistItem} label="Remove" variant="ghost" hidden={{ id: it.id }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="border-t border-line p-4">
                <ActionForm action={saveChecklistItem} submitLabel="Add item" variant="outline" size="sm" resetOnSuccess>
                  <input type="hidden" name="checklistId" value={l.id} />
                  <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
                    <Field label="What to check" required><Input name="label" required maxLength={160} placeholder="Brake pad thickness, front" /></Field>
                    <Field label="Position"><Input name="sort" type="number" min={0} max={999} defaultValue={l.garage_checklist_items.length} /></Field>
                  </div>
                  <Check name="requirePhoto" label="Require a photograph for this item" />
                </ActionForm>
              </div>
            </Panel>
          ))
        )}
      </div>

      <Panel title="New checklist">
        <div className="p-4">
          <ActionForm action={saveChecklist} submitLabel="Create checklist" resetOnSuccess fullWidth>
            <Field label="Name" required><Input name="name" required maxLength={80} placeholder="Pre-delivery inspection" /></Field>
            <Field label="Service category" hint="Leave blank to offer it on any job.">
              <Select name="categoryId" defaultValue="">
                <option value="">Any service</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Check name="requirePhoto" label="Require photographs throughout" />
          </ActionForm>
        </div>
      </Panel>

      <Section className="lg:col-span-2">
        <p className="text-xs text-ink2">
          Completed checklists are attached to the job card and, where you allow it, shown to the customer as evidence of
          what was inspected.
        </p>
      </Section>
    </div>
  );
}
