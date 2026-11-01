import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Callout, Check, Empty, Field, Input, PageTitle, Panel, Select, Textarea } from "@/components/ui";
import { saveService, toggleService } from "@/server/garage-settings";
import { getSettings } from "@/lib/garage-data";
import { getServicePackages } from "@/lib/public-data";
import { formatINR } from "@/lib/money";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Services and prices" };

export default async function Services() {
  const { sb, garage } = await requireGarageOrRedirect();
  const [servicesRes, catsRes, packages, settings] = await Promise.all([
    sb.from("garage_services")
      .select("id, name, description, labour_paise, parts_paise, consumables_paise, gst_rate_bps, est_minutes, warranty_days, included_items, exclusions, active, service_categories(name), service_packages(name, required_items)")
      .eq("garage_id", garage.id).order("name"),
    sb.from("service_categories").select("id, name").order("name"),
    getServicePackages(),
    getSettings(sb, garage.id),
  ]);

  const services = (servicesRes.data ?? []) as unknown as {
    id: string; name: string; description: string | null; labour_paise: number; parts_paise: number;
    consumables_paise: number; gst_rate_bps: number; est_minutes: number; warranty_days: number;
    included_items: string[]; exclusions: string | null; active: boolean;
    service_categories: { name: string } | null;
    service_packages: { name: string; required_items: string[] } | null;
  }[];
  const cats = catsRes.data ?? [];

  return (
    <>
      <PageTitle title="Services and prices" sub="What you publish here is what customers compare and book." />

      <Callout tone="neutral" title="Scope decides how you are ranked">
        Attach a service to a standard package and MEQIVA checks it covers everything that package includes. A quote
        missing a required item is shown separately as limited scope rather than ranked against complete ones — so you
        are never undercut by a cheaper price for less work.
      </Callout>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-3">
          {services.length === 0 ? (
            <Empty title="No services published" body="Add your common jobs with real prices. These appear on your profile and in comparisons." />
          ) : (
            services.map((s) => {
              const base = s.labour_paise + s.parts_paise + s.consumables_paise;
              const total = base + Math.round((base * s.gst_rate_bps) / 10000);
              const missing = s.service_packages
                ? s.service_packages.required_items.filter((r) => !s.included_items.map((i) => i.toLowerCase()).includes(r.toLowerCase()))
                : [];
              return (
                <Panel key={s.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{s.name}</p>
                        {!s.active && <Badge tone="outline">Hidden</Badge>}
                        {missing.length > 0 && <Badge tone="warn">Limited scope</Badge>}
                      </div>
                      <p className="tnum mt-1 text-[12.5px] text-ink2">
                        {s.service_categories?.name} · {s.est_minutes} min
                        {s.warranty_days > 0 && ` · ${s.warranty_days}-day warranty`}
                      </p>
                      {s.included_items.length > 0 && (
                        <p className="mt-1.5 text-[12.5px] text-ink2">Includes {s.included_items.join(", ").toLowerCase()}</p>
                      )}
                      {missing.length > 0 && (
                        <p className="mt-1 text-[12.5px] text-warn">
                          Missing from the standard package: {missing.join(", ")}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tnum text-lg font-semibold">{formatINR(total)}</p>
                      <p className="text-[11.5px] text-ink2">including GST</p>
                      <div className="mt-2">
                        <ActionButton action={toggleService} label={s.active ? "Hide" : "Publish"} variant="ghost" hidden={{ id: s.id }} />
                      </div>
                    </div>
                  </div>
                </Panel>
              );
            })
          )}
        </div>

        <Panel title="Add a service">
          <div className="p-4">
            <ActionForm action={saveService} submitLabel="Publish service" resetOnSuccess fullWidth>
              <Field label="Name" required><Input name="name" required maxLength={120} placeholder="Basic periodic service — hatchback" /></Field>
              <Field label="Category" required>
                <Select name="categoryId" required defaultValue="">
                  <option value="" disabled>Choose one</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Standard package" hint="Optional, but it is how customers compare like for like.">
                <Select name="packageId" defaultValue="">
                  <option value="">Not tied to a package</option>
                  {packages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
              <Field label="Description"><Textarea name="description" rows={2} maxLength={500} /></Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Parts (₹)" required><Input name="parts" type="number" inputMode="decimal" min={0} step="1" required defaultValue={0} /></Field>
                <Field label="Labour (₹)" required><Input name="labour" type="number" inputMode="decimal" min={0} step="1" required defaultValue={0} /></Field>
                <Field label="Consumables (₹)"><Input name="consumables" type="number" inputMode="decimal" min={0} step="1" defaultValue={0} /></Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="GST %"><Input name="gstPct" type="number" inputMode="decimal" min={0} max={28} step="0.5" defaultValue={(settings?.default_gst_bps ?? 1800) / 100} /></Field>
                <Field label="Minutes"><Input name="estMinutes" type="number" inputMode="numeric" min={15} max={1440} defaultValue={90} /></Field>
                <Field label="Warranty days"><Input name="warrantyDays" type="number" inputMode="numeric" min={0} defaultValue={settings?.default_warranty_days ?? 30} /></Field>
              </div>
              <Field label="What it includes" hint="Separate with commas. Checked against the standard package.">
                <Input name="includedItems" maxLength={600} placeholder="Engine oil, Oil filter, Labour, Multi-point inspection" />
              </Field>
              <Field label="What it excludes"><Input name="exclusions" maxLength={600} placeholder="Air filter, brake fluid" /></Field>
              <Check name="hidden" label="Save without publishing" />
            </ActionForm>
          </div>
        </Panel>
      </div>
    </>
  );
}
