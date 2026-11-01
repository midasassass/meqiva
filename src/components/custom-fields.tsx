import { Check, Field, Input, Select, Textarea } from "./ui";
import type { FieldDef } from "@/lib/fields";

/** Renders a garage's own job-card fields from their definitions. */
export function CustomFields({ defs, values }: { defs: FieldDef[]; values?: Record<string, unknown> }) {
  if (defs.length === 0) return null;
  return (
    <div className="space-y-4 border-t border-line pt-4">
      <p className="text-[13px] font-medium">Your garage&rsquo;s fields</p>
      {defs.map((d) => {
        const name = `custom.${d.key}`;
        const v = values?.[d.key];

        if (d.type === "boolean") {
          return <Check key={d.id} name={name} label={d.label} hint={d.help ?? undefined} defaultChecked={!!v} />;
        }
        return (
          <Field key={d.id} label={d.label} hint={d.help ?? undefined} required={d.required}>
            {d.type === "textarea" ? (
              <Textarea name={name} rows={3} maxLength={4000} required={d.required} defaultValue={(v as string) ?? ""} />
            ) : d.type === "select" ? (
              <Select name={name} required={d.required} defaultValue={(v as string) ?? ""}>
                <option value="">Not set</option>
                {d.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            ) : d.type === "multiselect" ? (
              <Select name={name} multiple required={d.required} defaultValue={(v as string[]) ?? []} className="h-auto min-h-24 py-2">
                {d.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </Select>
            ) : (
              <Input
                name={name}
                required={d.required}
                defaultValue={(v as string | number) ?? ""}
                type={d.type === "number" ? "number" : d.type === "date" ? "date" : "text"}
                inputMode={d.type === "number" ? "numeric" : undefined}
                maxLength={d.type === "photo" ? 500 : 500}
                placeholder={d.type === "photo" ? "Link to a photograph" : undefined}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}
