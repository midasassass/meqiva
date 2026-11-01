import Link from "next/link";
import { Badge, Empty, PageTitle, Panel, SegmentedLinks, Table, Td, Tr } from "@/components/ui";
import { Stamp, VerificationDisclaimer, type Level } from "@/components/stamp";
import { fmtDate } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Verification" };

export default async function Audits({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireRole("super_admin", "quality_auditor", "support_agent");
  const sp = await searchParams;
  const view = sp.view ?? "due";
  const sb = await supabaseServer();

  const soon = new Date(Date.now() + 60 * 864e5).toISOString();

  const [dueRes, historyRes] = await Promise.all([
    sb.from("garages")
      .select("id, public_name, locality, verification, verified_at, verification_expires_at")
      .eq("status", "active")
      .or(`verification.eq.none,verification_expires_at.lt.${soon}`)
      .order("verification_expires_at", { nullsFirst: true }).limit(100),
    sb.from("garage_audits")
      .select("id, result, findings, valid_until, created_at, garages(id, public_name), profiles(full_name)")
      .order("created_at", { ascending: false }).limit(100),
  ]);

  const due = (dueRes.data ?? []) as unknown as {
    id: string; public_name: string; locality: string | null; verification: Level;
    verified_at: string | null; verification_expires_at: string | null;
  }[];
  const history = (historyRes.data ?? []) as unknown as {
    id: string; result: string | null; findings: string | null; valid_until: string | null; created_at: string;
    garages: { id: string; public_name: string } | null; profiles: { full_name: string | null } | null;
  }[];

  return (
    <>
      <PageTitle
        title="Verification"
        sub="Inspection levels are earned by audit. They cannot be bought and are never affected by a subscription."
      />
      <SegmentedLinks
        current={view === "due" ? "/admin/audits" : "/admin/audits?view=history"}
        items={[
          { href: "/admin/audits", label: "Needs an inspection", count: due.length },
          { href: "/admin/audits?view=history", label: "Audit history", count: history.length },
        ]}
      />

      <div className="mt-5">
        {view === "due" ? (
          due.length === 0 ? (
            <Empty title="Nothing due" body="Every live garage has a current inspection." />
          ) : (
            <Panel>
              <Table head={["Garage", "Current level", "Expires"]}>
                {due.map((g) => (
                  <Tr key={g.id}>
                    <Td>
                      <Link href={`/admin/garages/${g.id}`} className="font-medium hover:underline">{g.public_name}</Link>
                      <p className="text-xs text-ink2">{g.locality ?? "Gurugram"}</p>
                    </Td>
                    <Td><Stamp level={g.verification} verifiedAt={g.verified_at} expiresAt={g.verification_expires_at} /></Td>
                    <Td className="tnum text-right text-[13px] text-ink2">
                      {g.verification_expires_at ? fmtDate(g.verification_expires_at) : "Never inspected"}
                    </Td>
                  </Tr>
                ))}
              </Table>
            </Panel>
          )
        ) : history.length === 0 ? (
          <Empty title="No audits recorded yet" />
        ) : (
          <Panel>
            <ul className="divide-y divide-line">
              {history.map((a) => (
                <li key={a.id} className="px-4 py-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/admin/garages/${a.garages?.id}`} className="font-medium hover:underline">
                      {a.garages?.public_name ?? "Garage"}
                    </Link>
                    <div className="flex items-center gap-2">
                      <Badge tone={a.result === "quality_assured" ? "warn" : a.result === "success" ? "success" : "neutral"}>
                        {a.result ?? "no change"}
                      </Badge>
                      <span className="tnum text-xs text-ink2">{fmtDate(a.created_at)}</span>
                    </div>
                  </div>
                  <p className="tnum mt-0.5 text-xs text-ink2">
                    by {a.profiles?.full_name ?? "auditor"}{a.valid_until && ` · valid to ${fmtDate(a.valid_until)}`}
                  </p>
                  {a.findings && <p className="mt-1.5 text-[13px] leading-relaxed text-ink2">{a.findings}</p>}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>

      <div className="mt-6"><VerificationDisclaimer /></div>
    </>
  );
}
