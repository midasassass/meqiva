import { ActionForm } from "@/components/action-form";
import { Badge, Callout, Empty, PageTitle, Panel, SegmentedLinks, Select, Table, Td, Tr } from "@/components/ui";
import { setUserRole } from "@/server/admin";
import { ROLES } from "@/lib/permissions";
import { fmtDate, fmtPhone, titleCase } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "People" };

export default async function Users({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const me = await requireRole("super_admin");
  const sp = await searchParams;
  const sb = await supabaseServer();

  let q = sb.from("profiles").select("id, full_name, phone, role, created_at, is_demo").order("created_at", { ascending: false }).limit(200);
  if (sp.role) q = q.eq("role", sp.role);
  const { data } = await q;
  const rows = data ?? [];

  return (
    <>
      <PageTitle title="People" sub="Platform roles. A garage's own staff roles are managed by that garage." />
      <SegmentedLinks
        current={sp.role ? `/admin/users?role=${sp.role}` : "/admin/users"}
        items={[
          { href: "/admin/users", label: "Everyone" },
          { href: "/admin/users?role=customer", label: "Customers" },
          { href: "/admin/users?role=garage_owner", label: "Garage owners" },
          { href: "/admin/users?role=super_admin", label: "Admins" },
        ]}
      />

      <Callout tone="warn" title="Changing a role changes what someone can reach">
        Role decides which workspace a person lands in and which rows the database will return to them. Promote with
        care — every change is written to the audit log with your name on it.
      </Callout>

      <div className="mt-5">
        {rows.length === 0 ? (
          <Empty title="Nobody here" />
        ) : (
          <Panel>
            <Table head={["Person", "Joined", "Role"]}>
              {rows.map((u) => (
                <Tr key={u.id}>
                  <Td>
                    <p className="font-medium">{u.full_name ?? "Unnamed"}</p>
                    <p className="tnum text-xs text-ink2">{fmtPhone(u.phone)}{u.is_demo && " · demo account"}</p>
                  </Td>
                  <Td className="tnum text-[13px] text-ink2">{fmtDate(u.created_at)}</Td>
                  <Td className="text-right">
                    {u.id === me.id ? (
                      <Badge tone="brand">You</Badge>
                    ) : (
                      <ActionForm action={setUserRole} submitLabel="Set" variant="outline" size="sm" className="flex items-end justify-end gap-2 space-y-0">
                        <input type="hidden" name="id" value={u.id} />
                        <Select name="role" defaultValue={u.role} aria-label={`Role for ${u.full_name ?? "user"}`} className="w-44">
                          {ROLES.map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}
                        </Select>
                      </ActionForm>
                    )}
                  </Td>
                </Tr>
              ))}
            </Table>
          </Panel>
        )}
      </div>
    </>
  );
}
