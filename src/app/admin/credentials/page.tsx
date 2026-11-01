import { BadgeCheck } from "lucide-react";
import { ActionButton } from "@/components/action-form";
import { Badge, Callout, Card, Empty, PageTitle, SegmentedLinks, Stat } from "@/components/ui";
import { verifyCredential } from "@/server/trust";
import { fmtDate, fmtRelative } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Technician credentials" };

export default async function AdminCredentials({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole("super_admin", "quality_auditor");
  const { status } = await searchParams;
  const sb = await supabaseServer();

  const { data } = await sb.from("technician_credentials")
    .select(`id, display_name, reference, issued_on, expires_on, years_experience, document_path,
             verified_at, active, created_at,
             credential_types(name, issuer, description), garages(public_name, slug, verification)`)
    .order("created_at", { ascending: false }).limit(200);

  const all = (data ?? []) as unknown as {
    id: string; display_name: string; reference: string | null; issued_on: string | null;
    expires_on: string | null; years_experience: number | null; document_path: string | null;
    verified_at: string | null; active: boolean; created_at: string;
    credential_types: { name: string; issuer: string | null; description: string | null } | null;
    garages: { public_name: string; slug: string; verification: string | null } | null;
  }[];

  const waiting = all.filter((c) => !c.verified_at && c.active);
  const verified = all.filter((c) => c.verified_at);
  const rejected = all.filter((c) => !c.verified_at && !c.active);

  const tab = status === "verified" ? "verified" : status === "rejected" ? "rejected" : "waiting";
  const shown = tab === "verified" ? verified : tab === "rejected" ? rejected : waiting;

  return (
    <>
      <PageTitle
        title="Technician credentials"
        sub="Garages claim training; you confirm it. A badge nobody checked is worse than no badge, because a customer trusts it."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Waiting on you" value={String(waiting.length)} tone={waiting.length > 0 ? "warn" : undefined} />
        <Stat label="Verified" value={String(verified.length)} tone="success" />
        <Stat label="Rejected" value={String(rejected.length)} />
      </div>

      <SegmentedLinks
        current={`/admin/credentials${tab === "waiting" ? "" : `?status=${tab}`}`}
        items={[
          { href: "/admin/credentials", label: "Waiting", count: waiting.length },
          { href: "/admin/credentials?status=verified", label: "Verified", count: verified.length },
          { href: "/admin/credentials?status=rejected", label: "Rejected", count: rejected.length },
        ]}
      />

      <div className="mt-6 space-y-3">
        {shown.length === 0 ? (
          <Empty title="Nothing here" body="Claims appear as garages add them." icon={<BadgeCheck className="h-5 w-5" aria-hidden />} />
        ) : (
          shown.map((c, i) => (
            <Card key={c.id} className="rise p-5" style={{ "--i": i } as React.CSSProperties}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[14.5px] font-semibold">{c.display_name}</p>
                  <p className="mt-0.5 text-[12.5px] text-ink2">
                    {c.credential_types?.name ?? "Credential"}
                    {c.credential_types?.issuer && ` · ${c.credential_types.issuer}`}
                    {c.garages && ` · claimed by ${c.garages.public_name}`}
                  </p>
                  <p className="tnum mt-1 text-[11.5px] text-ink2">
                    {c.years_experience != null && `${c.years_experience} yr claimed`}
                    {c.reference && `${c.years_experience != null ? " · " : ""}ref ${c.reference}`}
                    {c.issued_on && ` · issued ${fmtDate(c.issued_on)}`}
                    {` · submitted ${fmtRelative(c.created_at)}`}
                  </p>
                  <p className="mt-1.5 text-[11.5px] text-ink2">
                    {c.document_path
                      ? "Certificate uploaded — open it from storage before deciding."
                      : "No certificate uploaded. Ask the garage for one before verifying."}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {c.verified_at ? (
                    <>
                      <Badge tone="success">Verified {fmtDate(c.verified_at)}</Badge>
                      <ActionButton action={verifyCredential} label="Withdraw" variant="ghost"
                        hidden={{ id: c.id, decision: "reject" }}
                        confirm="Withdraw this credential? It stops showing on the garage's public profile." />
                    </>
                  ) : c.active ? (
                    <>
                      <ActionButton action={verifyCredential} label="Verify" variant="primary"
                        hidden={{ id: c.id, decision: "verify" }} />
                      <ActionButton action={verifyCredential} label="Reject" variant="outline"
                        hidden={{ id: c.id, decision: "reject" }} />
                    </>
                  ) : (
                    <>
                      <Badge tone="neutral">Rejected</Badge>
                      <ActionButton action={verifyCredential} label="Verify after all" variant="outline"
                        hidden={{ id: c.id, decision: "verify" }} />
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      <div className="mt-8">
        <Callout tone="warn" title="Verify the document, not the claim">
          Check the certificate number against the issuer where that is possible, check the name matches a person who
          actually works there, and check it has not expired. If any of those cannot be confirmed, reject it and say
          why to the garage — a rejected claim can be resubmitted with evidence.
        </Callout>
      </div>
    </>
  );
}
