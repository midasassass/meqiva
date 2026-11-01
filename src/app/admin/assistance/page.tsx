import { Phone } from "lucide-react";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Callout, Card, Check, Empty, Field, Input, PageTitle, Panel, Section, Stat, Textarea } from "@/components/ui";
import { saveAssistancePartner, setAssistanceVerified } from "@/server/trust-admin";
import { ASSISTANCE_KIND } from "@/lib/trust";
import { fmtDate, fmtPhone } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Roadside partners" };

const KINDS = ["towing", "battery", "tyre", "fuel", "lockout", "accident", "ev_charge"] as const;

export default async function AdminAssistance() {
  await requireRole("super_admin", "support_agent");
  const sb = await supabaseServer();

  const { data } = await sb.from("assistance_partners")
    .select("id, name, kinds, phone, whatsapp, city, localities, hours, notes, verified_at, active, sort")
    .order("sort").order("name");

  const rows = (data ?? []) as {
    id: string; name: string; kinds: string[]; phone: string; whatsapp: string | null;
    city: string; localities: string[]; hours: string; notes: string | null;
    verified_at: string | null; active: boolean; sort: number;
  }[];

  const live = rows.filter((r) => r.active);
  const checked = rows.filter((r) => r.verified_at);

  return (
    <>
      <PageTitle
        title="Roadside partners"
        sub="The directory at /assistance. Everything here is a phone number a stranded customer will actually ring, so a wrong one is worse than an empty page."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Listed publicly" value={String(live.length)} />
        <Stat label="Checked" value={String(checked.length)} tone="success"
          hint="Someone rang the number and confirmed it." />
        <Stat label="Hidden" value={String(rows.length - live.length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.25fr_1fr] lg:items-start">
        <Section title="Everyone in the directory">
          {rows.length === 0 ? (
            <Empty
              title="Nobody listed yet"
              body="Add operators one at a time, after you have rung the number and asked what they charge for a callout."
              icon={<Phone className="h-5 w-5" aria-hidden />}
            />
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <Card key={r.id} className={r.active ? "p-5" : "p-5 opacity-60"}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold">{r.name}</p>
                      <p className="tnum mt-0.5 text-[12.5px] text-ink2">
                        {fmtPhone(r.phone)}
                        {r.whatsapp && ` · WhatsApp ${fmtPhone(r.whatsapp)}`}
                      </p>
                      <p className="mt-1 text-[11.5px] text-ink2">
                        {r.hours} · {r.localities.length > 0 ? r.localities.join(", ") : r.city}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.kinds.map((k) => <Badge key={k} tone="neutral">{ASSISTANCE_KIND[k] ?? k}</Badge>)}
                      </div>
                      {r.notes && <p className="mt-2 text-[12px] leading-relaxed text-ink2">{r.notes}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {r.verified_at ? <Badge tone="success">Checked {fmtDate(r.verified_at)}</Badge> : <Badge tone="warn">Unchecked</Badge>}
                      {!r.active && <Badge tone="neutral">Hidden</Badge>}
                      <ActionButton action={setAssistanceVerified}
                        label={r.verified_at ? "Re-check needed" : "Mark checked"}
                        variant={r.verified_at ? "ghost" : "outline"}
                        hidden={{ id: r.id, verify: r.verified_at ? "0" : "1" }} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Section>

        <div className="space-y-5">
          <Panel title="Add a partner" tone="brand">
            <div className="p-5">
              <ActionForm action={saveAssistancePartner} submitLabel="Add to the directory" pendingLabel="Saving…" resetOnSuccess fullWidth>
                <Field label="Operator name" required>
                  <Input name="name" required minLength={2} maxLength={120} placeholder="Gurgaon Highway Recovery" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Phone" required hint="The number a customer rings.">
                    <Input name="phone" required minLength={8} maxLength={20} placeholder="98XXXXXXXX" className="tnum" />
                  </Field>
                  <Field label="WhatsApp" hint="Optional.">
                    <Input name="whatsapp" maxLength={20} placeholder="98XXXXXXXX" className="tnum" />
                  </Field>
                </div>
                <Field label="What they do" required hint="Tick everything they actually turn up for.">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {KINDS.map((k) => (
                      <Check key={k} name="kinds" value={k} label={ASSISTANCE_KIND[k] ?? k} />
                    ))}
                  </div>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="City">
                    <Input name="city" maxLength={60} defaultValue="Gurugram" />
                  </Field>
                  <Field label="Hours">
                    <Input name="hours" maxLength={80} placeholder="24 hours" />
                  </Field>
                </div>
                <Field label="Areas they cover" hint="Comma separated. Leave blank for the whole city.">
                  <Input name="localities" maxLength={300} placeholder="Sector 29, Golf Course Road, Sohna Road" />
                </Field>
                <Field label="Notes for the customer"
                  hint="Callout charge, per-km rate, night surcharge — whatever they told you on the phone.">
                  <Textarea name="notes" rows={3} maxLength={600}
                    placeholder="₹900 callout within 10 km, ₹45/km beyond. Flatbed available for low-clearance cars. Quoted 25% more after midnight." />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Sort order" hint="Lower shows first.">
                    <Input name="sort" type="number" inputMode="numeric" min={0} max={999} defaultValue={0} className="tnum" />
                  </Field>
                  <div className="flex items-end">
                    <Check name="hidden" label="Keep hidden for now" hint="Saves without listing publicly." />
                  </div>
                </div>
              </ActionForm>
            </div>
          </Panel>

          <Callout tone="warn" title="Before you mark anyone checked">
            Ring the number yourself and confirm it answers, confirm the areas and hours they claim, and write down
            the callout charge in the notes. The badge is dated on the public page precisely so a stale check is
            visible — re-check the list every quarter.
          </Callout>
        </div>
      </div>
    </>
  );
}
