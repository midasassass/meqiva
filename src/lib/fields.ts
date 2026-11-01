import { z } from "zod";

/**
 * Garages shape their own job card. Field definitions live in the database and
 * are turned into a validator here, so a custom field is validated on the server
 * exactly as it is rendered.
 */

export type FieldType = "text" | "textarea" | "number" | "select" | "multiselect" | "boolean" | "date" | "photo";
export type FieldEntity = "job_card" | "customer" | "vehicle" | "booking";

export interface FieldDef {
  id: string;
  entity: FieldEntity;
  key: string;
  label: string;
  help?: string | null;
  type: FieldType;
  options: string[];
  required: boolean;
  showToCustomer: boolean;
  sort: number;
}

export const FIELD_TYPE_LABEL: Record<FieldType, string> = {
  text: "Short text", textarea: "Paragraph", number: "Number", select: "Choose one",
  multiselect: "Choose several", boolean: "Yes or no", date: "Date", photo: "Photo",
};

export const fieldKey = z.string().regex(/^[a-z][a-z0-9_]{0,38}$/, "Use lowercase letters, numbers and underscores");

function one(def: FieldDef): z.ZodTypeAny {
  const req = def.required;
  switch (def.type) {
    case "number":
      return z.coerce.number({ message: `${def.label} must be a number` });
    case "boolean":
      return z.coerce.boolean();
    case "date":
      return z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${def.label} must be a date`);
    case "select":
      return def.options.length ? z.enum(def.options as [string, ...string[]]) : z.string().min(req ? 1 : 0);
    case "multiselect": {
      const item = def.options.length ? z.enum(def.options as [string, ...string[]]) : z.string();
      return req ? z.array(item).min(1, `${def.label} is required`) : z.array(item);
    }
    case "textarea":
      return z.string().min(req ? 1 : 0, `${def.label} is required`).max(4000);
    case "photo":
      return z.string().min(req ? 1 : 0, `${def.label} is required`).max(500);
    default:
      return z.string().min(req ? 1 : 0, `${def.label} is required`).max(500);
  }
}

/** Build a validator for one entity's custom fields. Empty submissions are dropped before parsing. */
export function schemaFor(defs: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const d of defs) {
    const base = one(d);
    shape[d.key] = d.required && d.type !== "boolean"
      ? base
      : base.optional();
  }
  return z.object(shape);
}

/** Pull `custom.<key>` entries out of a submitted form, honouring multiselects. */
export function readCustom(fd: FormData, defs: FieldDef[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const d of defs) {
    const name = `custom.${d.key}`;
    if (d.type === "multiselect") {
      const all = fd.getAll(name).map(String).filter(Boolean);
      if (all.length) out[d.key] = all;
    } else if (d.type === "boolean") {
      out[d.key] = fd.get(name) === "on" || fd.get(name) === "true";
    } else {
      const v = fd.get(name);
      if (v != null && String(v) !== "") out[d.key] = d.type === "number" ? Number(v) : String(v);
    }
  }
  return out;
}

export interface CustomParseResult { ok: boolean; values: Record<string, unknown>; errors: Record<string, string> }

export function parseCustom(fd: FormData, defs: FieldDef[]): CustomParseResult {
  const raw = readCustom(fd, defs);
  const parsed = schemaFor(defs).safeParse(raw);
  if (parsed.success) return { ok: true, values: parsed.data as Record<string, unknown>, errors: {} };
  const labels = new Map(defs.map((d) => [d.key, d.label]));
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const k = String(issue.path[0] ?? "");
    if (!k || errors[k]) continue;
    const missing = !(k in raw);
    errors[k] = missing ? `${labels.get(k) ?? k} is required` : issue.message;
  }
  return { ok: false, values: raw, errors };
}

/** Render a stored value for display. */
export function displayValue(def: FieldDef, value: unknown): string {
  if (value == null || value === "") return "—";
  if (def.type === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}
