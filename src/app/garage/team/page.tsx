import { ActionButton, ActionForm } from "@/components/action-form";
import { Badge, Callout, Empty, Field, Input, PageTitle, Panel, Select, Table, Td, Tr } from "@/components/ui";
import { inviteStaff, removeMember } from "@/server/garage-settings";
import { can, type Role } from "@/lib/permissions";
import { fmtDate, fmtPhone } from "@/lib/format";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Team" };

const ROLE_LABEL: Record<string, string> = {
  garage_owner: "Owner", service_advisor: "Service advisor", technician: "Technician",
};

const ROLE_CAN: Record<string, string> = {
  garage_owner: "Everything, including prices, settings and money.",
  service_advisor: "Customers, job cards, quotations and stock. Not settings.",
  technician: "Only the jobs assigned to them. Never costs, margins or money.",
};

export default async function Team() {
  const { sb, garage, user } = await requireGarageOrRedirect();

  const [membersRes, invitesRes] = await Promise.all([
    sb.from("garage_members").select("user_id, role, created_at, profiles(full_name, phone)").eq("garage_id", garage.id),
    sb.from("staff_invites").select("id, email, role, token, accepted_at, expires_at").eq("garage_id", garage.id).order("created_at", { ascending: false }),
  ]);

  const members = (membersRes.data ?? []) as unknown as {
    user_id: string; role: string; created_at: string; profiles: { full_name: string | null; phone: string | null } | null;
  }[];
  const invites = invitesRes.data ?? [];

  return (
    <>
      <PageTitle title="Team" sub="Who can see what. Permissions are enforced in the database, not just hidden in the interface." />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-6">
          <Panel title="People">
            {members.length === 0 ? (
              <div className="p-5"><Empty title="Nobody here yet" body="Invite your advisors and technicians to give them their own sign-in." /></div>
            ) : (
              <Table head={["Name", "Role", "Since", ""]}>
                {members.map((m) => (
                  <Tr key={m.user_id}>
                    <Td>
                      <p className="font-medium">{m.profiles?.full_name ?? "Team member"}</p>
                      <p className="tnum text-xs text-ink2">{fmtPhone(m.profiles?.phone)}</p>
                    </Td>
                    <Td>
                      <Badge tone={m.role === "garage_owner" ? "brand" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
                      <p className="mt-1 text-xs text-ink2">{ROLE_CAN[m.role]}</p>
                    </Td>
                    <Td className="tnum text-[13px] text-ink2">{fmtDate(m.created_at)}</Td>
                    <Td className="text-right">
                      {garage.isOwner && m.user_id !== user.id && (
                        <ActionButton action={removeMember} label="Remove" variant="ghost" hidden={{ userId: m.user_id }}
                          confirm="Remove this person from the garage? They lose access immediately." />
                      )}
                    </Td>
                  </Tr>
                ))}
              </Table>
            )}
          </Panel>

          {invites.length > 0 && (
            <Panel title="Invitations">
              <Table head={["Email", "Role", "Link", "Status"]}>
                {invites.map((i) => (
                  <Tr key={i.id}>
                    <Td className="text-[13px]">{i.email}</Td>
                    <Td className="text-[13px]">{ROLE_LABEL[i.role]}</Td>
                    <Td className="tnum max-w-[12rem] truncate text-xs text-ink2">/join/{i.token.slice(0, 12)}…</Td>
                    <Td className="text-right">
                      <Badge tone={i.accepted_at ? "success" : new Date(i.expires_at) < new Date() ? "danger" : "warn"}>
                        {i.accepted_at ? "Joined" : new Date(i.expires_at) < new Date() ? "Expired" : "Waiting"}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </Table>
              <p className="border-t border-line px-4 py-3 text-xs text-ink2">
                Send the link to the person yourself for now. Automatic invitation emails need an email provider to be
                connected.
              </p>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          {garage.isOwner && (
            <Panel title="Invite someone">
              <div className="p-4">
                <ActionForm action={inviteStaff} submitLabel="Create invitation" resetOnSuccess fullWidth>
                  <Field label="Email" required><Input name="email" type="email" required placeholder="name@example.com" /></Field>
                  <Field label="Role" required>
                    <Select name="role" defaultValue="technician">
                      <option value="technician">Technician</option>
                      <option value="service_advisor">Service advisor</option>
                      <option value="garage_owner">Owner</option>
                    </Select>
                  </Field>
                </ActionForm>
              </div>
            </Panel>
          )}

          <Callout tone="neutral" title="What a technician cannot see">
            A technician&rsquo;s account cannot read your purchase costs, your margins, a quotation, an invoice or any other
            garage&rsquo;s data. That is enforced by row-level security on every query, so it holds even if someone goes
            looking outside the app.
            {!can("technician" as Role, "finance.view") && ""}
          </Callout>
        </div>
      </div>
    </>
  );
}
