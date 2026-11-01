import { BadgeCheck } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Badge, Callout, Card, Empty, Field, Input, PageTitle, Panel, Section, Select, Stat } from "@/components/ui";
import { saveCredential } from "@/server/trust";
import { fmtDate } from "@/lib/format";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Technician credentials" };

export default async function Credentials() {
  const { sb, garage } = await requireGarageOrRedirect();

  const [credRes, typeRes, teamRes] = await Promise.all([
    sb.from("technician_credentials")
      .select(`id, display_name, reference, issued_on, expires_on, years_experience,
               verified_at, active, created_at, credential_types(name, issuer)`)
      .eq("garage_id", garage.id).order("created_at", { ascending: false }),
    sb.from("credential_types").select("id, name, issuer, description").order("sort").order("name"),
    sb.from("garage_members").select("user_id, role, profiles(full_name)").eq("garage_id", garage.id),
  ]);

  const creds = (credRes.data ?? []) as unknown as {
    id: string; display_name: string; reference: string | null; issued_on: string | null;
    expires_on: string | null; years_experience: number | null; verified_at: string | null;
    active: boolean; created_at: string;
    credential_types: { name: string; issuer: string | null } | null;
  }[];
  const types = (typeRes.data ?? []) as { id: number; name: string; issuer: string | null; description: string | null }[];
  const team = (teamRes.data ?? []) as unknown as {
    user_id: string; role: string; profiles: { full_name: string | null } | null;
  }[];

  const verified = creds.filter((c) => c.verified_at);
  const waiting = creds.filter((c) => !c.verified_at && c.active);
  const rejected = creds.filter((c) => !c.verified_at && !c.active);

  return (
    <>
      <PageTitle
        title="Technician credentials"
        sub="Who in your workshop is trained in what. Once a MEQIVA auditor has checked a credential, it shows on your public profile — which is the part customers actually read before booking."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Checked and public" value={String(verified.length)} tone="success" />
        <Stat label="With the auditor" value={String(waiting.length)} tone={waiting.length > 0 ? "warn" : undefined} />
        <Stat label="Not accepted" value={String(rejected.length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <Section title="Your workshop's credentials">
          {creds.length === 0 ? (
            <Empty
              title="None added yet"
              body="Add the training your technicians actually hold. Nothing appears publicly until an auditor has seen the certificate, so there is no way to claim something you cannot show."
              icon={<BadgeCheck className="h-5 w-5" aria-hidden />}
            />
          ) : (
            <div className="space-y-3">
              {creds.map((c, i) => (
                <Card key={c.id} className="rise p-4" style={{ "--i": i } as React.CSSProperties}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold">{c.display_name}</p>
                      <p className="mt-0.5 text-[12.5px] text-ink2">
                        {c.credential_types?.name ?? "Credential"}
                        {c.credential_types?.issuer && ` · ${c.credential_types.issuer}`}
                      </p>
                      <p className="tnum mt-1 text-[11.5px] text-ink2">
                        {c.years_experience != null && `${c.years_experience} yr experience`}
                        {c.issued_on && `${c.years_experience != null ? " · " : ""}issued ${fmtDate(c.issued_on)}`}
                        {c.reference && ` · ${c.reference}`}
                      </p>
                    </div>
                    {c.verified_at ? (
                      <Badge tone="success">Checked {fmtDate(c.verified_at)}</Badge>
                    ) : c.active ? (
                      <Badge tone="warn">With the auditor</Badge>
                    ) : (
                      <Badge tone="neutral">Not accepted</Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Section>

        <div className="space-y-5">
          <Panel title="Add a credential" tone="brand">
            <div className="p-5">
              {!garage.isManager ? (
                <p className="text-[13px] text-ink2">Only an owner or service advisor can add a credential.</p>
              ) : types.length === 0 ? (
                <p className="text-[13px] text-ink2">No credential types are published yet.</p>
              ) : (
                <ActionForm action={saveCredential} submitLabel="Send for checking" pendingLabel="Saving…" resetOnSuccess fullWidth>
                  <Field label="Whose is it?" required hint="The name customers would see.">
                    <Input name="displayName" required minLength={2} maxLength={80} placeholder="Rakesh Yadav" />
                  </Field>
                  {team.length > 0 && (
                    <Field label="Link to a team member" hint="Optional. Keeps it attached if they move between branches.">
                      <Select name="userId" defaultValue="">
                        <option value="">Not linked</option>
                        {team.map((m) => (
                          <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name ?? "Team member"}</option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  <Field label="Which credential?" required>
                    <Select name="credentialTypeId" required defaultValue="">
                      <option value="" disabled>Choose one</option>
                      {types.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}{t.issuer ? ` — ${t.issuer}` : ""}</option>
                      ))}
                    </Select>
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Certificate number" hint="Optional.">
                      <Input name="reference" maxLength={60} placeholder="ASDC/2023/04471" className="tnum" />
                    </Field>
                    <Field label="Years in the trade" hint="Optional.">
                      <Input name="yearsExperience" type="number" inputMode="numeric" min={0} max={60} placeholder="11" className="tnum" />
                    </Field>
                  </div>
                  <Field label="Issued on" hint="Optional.">
                    <Input name="issuedOn" type="date" />
                  </Field>
                </ActionForm>
              )}
            </div>
          </Panel>

          <Callout tone="neutral" icon={<BadgeCheck className="h-4 w-4" aria-hidden />} title="Why you cannot verify your own">
            Only a MEQIVA auditor can mark a credential as checked, and the database refuses the change from anyone
            else. That is the whole reason the badge means something to a customer deciding between you and the
            workshop down the road.
          </Callout>

          {types.length > 0 && (
            <div className="rounded-panel border border-line bg-surface p-5">
              <p className="text-[13px] font-semibold">What we recognise</p>
              <ul className="mt-2.5 space-y-2">
                {types.map((t) => (
                  <li key={t.id} className="text-[12.5px] leading-relaxed text-ink2">
                    <span className="font-semibold text-ink">{t.name}</span>
                    {t.description && ` — ${t.description}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
