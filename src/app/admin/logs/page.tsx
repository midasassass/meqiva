import { Badge, Empty, PageTitle, Panel, Table, Td, Tr } from "@/components/ui";
import { fmtDateTime, titleCase } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Audit log" };

export default async function Logs() {
  await requireRole("super_admin");
  const sb = await supabaseServer();
  const { data } = await sb.from("audit_logs")
    .select("id, action, entity, entity_id, meta, created_at, profiles(full_name)")
    .order("created_at", { ascending: false }).limit(200);

  const rows = (data ?? []) as unknown as {
    id: number; action: string; entity: string | null; entity_id: string | null;
    meta: Record<string, unknown>; created_at: string; profiles: { full_name: string | null } | null;
  }[];

  const tone = (a: string) =>
    a.includes("suspend") || a.includes("reject") ? "danger"
    : a.includes("verification") ? "warn"
    : a.includes("role") ? "brand" : "neutral";

  return (
    <>
      <PageTitle title="Audit log" sub="Sensitive actions, with who did them. The table refuses updates and deletes." />
      {rows.length === 0 ? (
        <Empty title="Nothing logged yet" />
      ) : (
        <Panel>
          <Table head={["Action", "Who", "On", "When"]}>
            {rows.map((r) => (
              <Tr key={r.id}>
                <Td>
                  <Badge tone={tone(r.action)}>{r.action.replace(/[._]/g, " ")}</Badge>
                  {Object.keys(r.meta ?? {}).length > 0 && (
                    <p className="tnum mt-1 max-w-[20rem] truncate text-xs text-ink2">{JSON.stringify(r.meta)}</p>
                  )}
                </Td>
                <Td className="text-[13px]">{r.profiles?.full_name ?? "—"}</Td>
                <Td className="tnum text-xs text-ink2">
                  {r.entity && titleCase(r.entity)}
                  {r.entity_id && <span className="block">{r.entity_id.slice(0, 8)}…</span>}
                </Td>
                <Td className="tnum text-right text-[12.5px] text-ink2">{fmtDateTime(r.created_at)}</Td>
              </Tr>
            ))}
          </Table>
        </Panel>
      )}
      <p className="mt-5 text-xs text-ink2">
        An append-only trigger blocks any attempt to edit or delete a row here, including from the admin panel itself.
      </p>
    </>
  );
}
