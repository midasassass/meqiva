import Link from "next/link";
import { Badge, Empty, PageTitle, Panel, SegmentedLinks, Table, Td, Tr } from "@/components/ui";
import { Stamp, type Level } from "@/components/stamp";
import { fmtDate } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Garages" };

export default async function AdminGarages({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireRole("super_admin", "quality_auditor", "support_agent");
  const sp = await searchParams;
  const sb = await supabaseServer();

  let q = sb.from("garages")
    .select("id, public_name, slug, locality, city, status, verification, verified_at, verification_expires_at, created_at, is_demo")
    .order("created_at", { ascending: false }).limit(200);
  if (sp.status) q = q.eq("status", sp.status);

  const { data } = await q;
  const rows = (data ?? []) as unknown as {
    id: string; public_name: string; slug: string; locality: string | null; city: string;
    status: string; verification: Level; verified_at: string | null; verification_expires_at: string | null;
    created_at: string; is_demo: boolean;
  }[];

  return (
    <>
      <PageTitle title="Garages" sub="Approval puts a garage on the marketplace. Verification is separate and set only by audit." />
      <SegmentedLinks
        current={sp.status ? `/admin/garages?status=${sp.status}` : "/admin/garages"}
        items={[
          { href: "/admin/garages", label: "All" },
          { href: "/admin/garages?status=pending", label: "Applications" },
          { href: "/admin/garages?status=active", label: "Live" },
          { href: "/admin/garages?status=suspended", label: "Suspended" },
        ]}
      />

      <div className="mt-5">
        {rows.length === 0 ? (
          <Empty title="No garages here" />
        ) : (
          <Panel>
            <Table head={["Garage", "Status", "Verification", "Applied"]}>
              {rows.map((g) => (
                <Tr key={g.id}>
                  <Td>
                    <Link href={`/admin/garages/${g.id}`} className="font-medium hover:underline">{g.public_name}</Link>
                    <p className="text-xs text-ink2">
                      {g.locality ?? g.city}{g.is_demo && " · demo data"}
                    </p>
                  </Td>
                  <Td>
                    <Badge tone={g.status === "active" ? "success" : g.status === "pending" ? "warn" : "danger"}>{g.status}</Badge>
                  </Td>
                  <Td><Stamp level={g.verification} verifiedAt={g.verified_at} expiresAt={g.verification_expires_at} /></Td>
                  <Td className="tnum text-right text-[13px] text-ink2">{fmtDate(g.created_at)}</Td>
                </Tr>
              ))}
            </Table>
          </Panel>
        )}
      </div>
    </>
  );
}
