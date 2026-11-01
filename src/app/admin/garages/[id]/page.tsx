import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge, Callout, DataList, Field, Input, PageTitle, Panel, Section, Select, Table, Td, Textarea, Tr } from "@/components/ui";
import { ActionButton, ActionForm } from "@/components/action-form";
import { Stamp, VerificationDisclaimer, type Level } from "@/components/stamp";
import { setGarageStatus, setVerification } from "@/server/admin";
import { formatINR } from "@/lib/money";
import { fmtDate, fmtPhone } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Garage" };

export default async function AdminGarage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole("super_admin", "quality_auditor", "support_agent");
  const sb = await supabaseServer();

  const { data: g } = await sb.from("garages")
    .select("id, public_name, legal_name, slug, owner_id, status, verification, verified_at, verification_expires_at, address, locality, city, pincode, phone, gstin, bays_count, pickup_drop, created_at, is_demo, profiles(full_name, phone)")
    .eq("id", id).maybeSingle();
  if (!g) notFound();

  const garage = g as unknown as {
    id: string; public_name: string; legal_name: string | null; slug: string; status: string;
    verification: Level; verified_at: string | null; verification_expires_at: string | null;
    address: string | null; locality: string | null; city: string; pincode: string | null;
    phone: string | null; gstin: string | null; bays_count: number; pickup_drop: boolean;
    created_at: string; is_demo: boolean; profiles: { full_name: string | null; phone: string | null } | null;
  };

  const [auditsRes, statsRes, violationsRes, membersRes] = await Promise.all([
    sb.from("garage_audits").select("id, findings, result, valid_until, created_at, profiles(full_name)").eq("garage_id", id).order("created_at", { ascending: false }),
    sb.from("bookings").select("status").eq("garage_id", id),
    sb.from("pricing_violations").select("id, description, attempted_paise, mrp_paise, created_at").eq("garage_id", id).order("created_at", { ascending: false }).limit(10),
    sb.from("garage_members").select("role, profiles(full_name)").eq("garage_id", id),
  ]);

  const audits = (auditsRes.data ?? []) as unknown as { id: string; findings: string | null; result: string | null; valid_until: string | null; created_at: string; profiles: { full_name: string | null } | null }[];
  const bookings = statsRes.data ?? [];
  const violations = violationsRes.data ?? [];
  const members = (membersRes.data ?? []) as unknown as { role: string; profiles: { full_name: string | null } | null }[];

  const canAudit = ["super_admin", "quality_auditor"].includes(user.role);
  const isAdmin = user.role === "super_admin";

  return (
    <>
      <PageTitle
        title={garage.public_name}
        sub={garage.legal_name ?? undefined}
        back={{ href: "/admin/garages", label: "All garages" }}
        right={<>
          <Badge tone={garage.status === "active" ? "success" : garage.status === "pending" ? "warn" : "danger"}>{garage.status}</Badge>
          <Link href={`/garages/${garage.slug}`} className="text-[13px] text-ink2 underline">Public profile</Link>
        </>}
      />

      {garage.is_demo && <Callout tone="warn" title="Demonstration record">This garage and its data are seeded for testing.</Callout>}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="space-y-6">
          <Panel title="Business details">
            <div className="p-4">
              <DataList rows={[
                ["Owner", garage.profiles?.full_name ?? "—"],
                ["Phone", fmtPhone(garage.phone ?? garage.profiles?.phone)],
                ["Address", [garage.address, garage.locality, garage.city, garage.pincode].filter(Boolean).join(", ") || "—"],
                ["GSTIN", garage.gstin ?? "Not provided"],
                ["Bays", garage.bays_count],
                ["Pickup and drop", garage.pickup_drop ? "Offered" : "No"],
                ["Applied", fmtDate(garage.created_at)],
                ["Team", members.length ? members.map((m) => `${m.profiles?.full_name ?? "—"} (${m.role.replace(/_/g, " ")})`).join(", ") : "No staff added"],
              ]} />
            </div>
          </Panel>

          <Panel title="Activity">
            <div className="p-4">
              <DataList rows={[
                ["Bookings", bookings.length],
                ["Completed", bookings.filter((b) => b.status === "completed").length],
                ["Cancelled", bookings.filter((b) => b.status === "cancelled").length],
                ["Disputed", bookings.filter((b) => b.status === "disputed").length],
              ]} />
            </div>
          </Panel>

          {violations.length > 0 && (
            <Panel title="Blocked pricing attempts" description="Prices above a declared MRP that the system refused to save.">
              <Table head={["Item", "Tried", "MRP", "When"]}>
                {violations.map((v) => (
                  <Tr key={v.id}>
                    <Td className="text-[13px]">{v.description ?? "Part"}</Td>
                    <Td className="tnum text-[13px]">{formatINR(Number(v.attempted_paise ?? 0))}</Td>
                    <Td className="tnum text-[13px] text-ink2">{formatINR(Number(v.mrp_paise ?? 0))}</Td>
                    <Td className="tnum text-right text-[13px] text-ink2">{fmtDate(v.created_at)}</Td>
                  </Tr>
                ))}
              </Table>
            </Panel>
          )}

          <Section title="Audit history">
            {audits.length === 0 ? (
              <p className="text-[13px] text-ink2">No inspection has been recorded for this garage.</p>
            ) : (
              <Panel>
                <ul className="divide-y divide-line">
                  {audits.map((a) => (
                    <li key={a.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <Badge tone={a.result === "quality_assured" ? "warn" : a.result === "success" ? "success" : "neutral"}>
                          {a.result ?? "no change"}
                        </Badge>
                        <p className="tnum text-xs text-ink2">
                          {fmtDate(a.created_at)} by {a.profiles?.full_name ?? "auditor"}
                          {a.valid_until && ` · valid to ${fmtDate(a.valid_until)}`}
                        </p>
                      </div>
                      {a.findings && <p className="mt-1.5 text-[13px] leading-relaxed text-ink2">{a.findings}</p>}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </Section>
        </div>

        <aside className="space-y-5">
          <Panel title="Verification">
            <div className="space-y-4 p-4">
              <Stamp level={garage.verification} size="lg" verifiedAt={garage.verified_at} expiresAt={garage.verification_expires_at} />
              {canAudit ? (
                <ActionForm action={setVerification} submitLabel="Record inspection" variant="accent">
                  <input type="hidden" name="id" value={garage.id} />
                  <Field label="Outcome" required>
                    <Select name="level" defaultValue={garage.verification}>
                      <option value="none">Not verified</option>
                      <option value="listed">Listed — identity checked</option>
                      <option value="verified">Verified — workshop inspected</option>
                      <option value="quality_assured">Quality-Assured — higher criteria met</option>
                    </Select>
                  </Field>
                  <Field label="Valid for (months)"><Input name="validMonths" type="number" min={1} max={60} defaultValue={12} /></Field>
                  <Field label="Findings" hint="Kept on the audit record. Not shown publicly.">
                    <Textarea name="findings" rows={4} maxLength={4000} />
                  </Field>
                </ActionForm>
              ) : (
                <p className="text-[13px] text-ink2">Only a quality auditor or platform admin can change verification.</p>
              )}
              <VerificationDisclaimer />
            </div>
          </Panel>

          {isAdmin && (
            <Panel title="Listing status" description="Separate from verification. Approving does not grant a badge.">
              <div className="flex flex-wrap gap-2 p-4">
                {garage.status !== "active" && (
                  <ActionButton action={setGarageStatus} label="Approve and list" variant="primary" hidden={{ id: garage.id, status: "active" }} />
                )}
                {garage.status === "active" && (
                  <ActionButton action={setGarageStatus} label="Suspend" variant="outline" hidden={{ id: garage.id, status: "suspended" }}
                    confirm="Suspend this garage? New bookings stop immediately. Their own records stay available to them." />
                )}
                {garage.status === "pending" && (
                  <ActionButton action={setGarageStatus} label="Reject" variant="danger" hidden={{ id: garage.id, status: "rejected" }}
                    confirm="Reject this application?" />
                )}
                {garage.status === "suspended" && (
                  <ActionButton action={setGarageStatus} label="Reinstate" variant="primary" hidden={{ id: garage.id, status: "active" }} />
                )}
              </div>
            </Panel>
          )}

          <Callout tone="neutral">
            Every change here is written to the audit log with who made it and when.
          </Callout>
        </aside>
      </div>
    </>
  );
}
