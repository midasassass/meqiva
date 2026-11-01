import Link from "next/link";
import { ActionButton } from "@/components/action-form";
import { Callout, Empty, PageTitle, Panel, Stat, Table, Td, Tr } from "@/components/ui";
import { resolveViolation } from "@/server/admin";
import { formatINR } from "@/lib/money";
import { fmtDateTime } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Pricing compliance" };

export default async function Compliance() {
  const user = await requireRole("super_admin", "quality_auditor", "support_agent");
  const sb = await supabaseServer();

  const { data } = await sb.from("pricing_violations")
    .select("id, description, attempted_paise, mrp_paise, context, created_at, resolved_at, garages(id, public_name), profiles(full_name)")
    .order("created_at", { ascending: false }).limit(200);

  const rows = (data ?? []) as unknown as {
    id: number; description: string | null; attempted_paise: number | null; mrp_paise: number | null;
    context: string; created_at: string; resolved_at: string | null;
    garages: { id: string; public_name: string } | null; profiles: { full_name: string | null } | null;
  }[];

  const open = rows.filter((r) => !r.resolved_at);
  const byGarage = new Map<string, number>();
  for (const r of open) if (r.garages) byGarage.set(r.garages.public_name, (byGarage.get(r.garages.public_name) ?? 0) + 1);
  const repeat = [...byGarage.entries()].filter(([, n]) => n >= 3);

  return (
    <>
      <PageTitle title="Pricing compliance" sub="Attempts to price a packaged part above its declared MRP. All of these were refused." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Open" value={open.length} tone={open.length ? "danger" : "default"} />
        <Stat label="Reviewed" value={rows.length - open.length} />
        <Stat label="Repeat garages" value={repeat.length} tone={repeat.length ? "warn" : "default"} />
      </div>

      {repeat.length > 0 && (
        <Callout tone="danger" title="Repeated attempts">
          {repeat.map(([name, n]) => `${name} (${n})`).join(", ")}. A pattern here is worth a conversation, and may
          justify suspension.
        </Callout>
      )}

      <div className="mt-6">
        {rows.length === 0 ? (
          <Empty title="Nothing blocked" body="No garage has tried to price above a declared MRP. The rule is enforced at the database, so this list is complete." />
        ) : (
          <Panel>
            <Table head={["Garage", "Item", "Tried", "MRP", "When", ""]}>
              {rows.map((r) => (
                <Tr key={r.id} className={r.resolved_at ? "opacity-55" : ""}>
                  <Td>
                    {r.garages
                      ? <Link href={`/admin/garages/${r.garages.id}`} className="font-medium hover:underline">{r.garages.public_name}</Link>
                      : "—"}
                    <p className="text-xs text-ink2">{r.profiles?.full_name ?? "staff"} · {r.context}</p>
                  </Td>
                  <Td className="text-[13px]">{r.description ?? "Part"}</Td>
                  <Td className="tnum text-[13px] text-danger">{formatINR(Number(r.attempted_paise ?? 0))}</Td>
                  <Td className="tnum text-[13px] text-ink2">{formatINR(Number(r.mrp_paise ?? 0))}</Td>
                  <Td className="tnum text-[12.5px] text-ink2">{fmtDateTime(r.created_at)}</Td>
                  <Td className="text-right">
                    {!r.resolved_at && user.role === "super_admin" && (
                      <ActionButton action={resolveViolation} label="Mark reviewed" variant="ghost" hidden={{ id: String(r.id) }} />
                    )}
                  </Td>
                </Tr>
              ))}
            </Table>
          </Panel>
        )}
      </div>

      <p className="mt-5 max-w-[70ch] text-xs text-ink2">
        MRP is inclusive of tax, so GST is never added on top of it. Discounts below MRP and an honest margin on parts
        are both allowed — only a price above the declared maximum is refused. Legal Metrology obligations around
        declared MRP should be confirmed with qualified counsel for the categories you list.
      </p>
    </>
  );
}
