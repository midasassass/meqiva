import { ActionForm } from "@/components/action-form";
import { Badge, Callout, Empty, Field, Input, PageTitle, Panel, Select, Stat, Table, Td, Tr } from "@/components/ui";
import { saveCommissionRule } from "@/server/admin";
import { formatINR } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Commission" };

export default async function Commissions() {
  await requireRole("super_admin");
  const sb = await supabaseServer();

  const [rulesRes, garagesRes, recordsRes] = await Promise.all([
    sb.from("commission_rules").select("id, garage_id, type, rate_bps, amount_paise, active, garages(public_name)").order("garage_id", { nullsFirst: true }),
    sb.from("garages").select("id, public_name").eq("status", "active").order("public_name"),
    sb.from("commission_records").select("id, fee_paise, gst_paise, created_at, garages(public_name)").order("created_at", { ascending: false }).limit(50),
  ]);

  const rules = (rulesRes.data ?? []) as unknown as {
    id: number; garage_id: string | null; type: string; rate_bps: number | null; amount_paise: number | null;
    active: boolean; garages: { public_name: string } | null;
  }[];
  const garages = garagesRes.data ?? [];
  const records = (recordsRes.data ?? []) as unknown as { id: string; fee_paise: number; gst_paise: number; created_at: string; garages: { public_name: string } | null }[];
  const total = records.reduce((a, r) => a + Number(r.fee_paise) + Number(r.gst_paise), 0);

  const describe = (r: typeof rules[number]) =>
    r.type === "fixed" ? `${formatINR(Number(r.amount_paise ?? 0))} per completed booking`
    : r.type === "pct_labour" ? `${(Number(r.rate_bps) / 100).toFixed(1)}% of labour`
    : `${(Number(r.rate_bps) / 100).toFixed(1)}% of the transaction`;

  return (
    <>
      <PageTitle title="Commission" sub="Applied only to marketplace bookings that complete. Never to a garage's own customers." />

      <Callout tone="neutral" title="How a rule is chosen">
        A rule set for a specific garage overrides the platform default. Commission accrues once per booking, on
        completion, against the origin recorded on the job card — so a walk-in or a fleet job can never be charged by
        mistake.
      </Callout>

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div className="space-y-6">
          <Panel title="Rules">
            {rules.length === 0 ? (
              <div className="p-5"><Empty title="No rules configured" body="Without a rule, no commission is charged at all." /></div>
            ) : (
              <Table head={["Applies to", "Basis", ""]}>
                {rules.map((r) => (
                  <Tr key={r.id}>
                    <Td className="font-medium">{r.garages?.public_name ?? "Every garage (default)"}</Td>
                    <Td className="text-[13px]">{describe(r)}</Td>
                    <Td className="text-right"><Badge tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Off"}</Badge></Td>
                  </Tr>
                ))}
              </Table>
            )}
          </Panel>

          <Panel title="Recently accrued">
            {records.length === 0 ? (
              <p className="px-4 py-4 text-[13px] text-ink2">Nothing has accrued yet.</p>
            ) : (
              <Table head={["Garage", "Fee", "Tax", "When"]}>
                {records.map((r) => (
                  <Tr key={r.id}>
                    <Td className="text-[13px]">{r.garages?.public_name ?? "—"}</Td>
                    <Td className="tnum">{formatINR(Number(r.fee_paise))}</Td>
                    <Td className="tnum text-[13px] text-ink2">{formatINR(Number(r.gst_paise))}</Td>
                    <Td className="tnum text-right text-[13px] text-ink2">{fmtDate(r.created_at)}</Td>
                  </Tr>
                ))}
              </Table>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Stat label="Accrued in the last 50 records" value={formatINR(total)} />

          <Panel title="Add or replace a rule">
            <div className="p-4">
              <ActionForm action={saveCommissionRule} submitLabel="Save rule" resetOnSuccess fullWidth>
                <Field label="Applies to">
                  <Select name="garageId" defaultValue="">
                    <option value="">Every garage (platform default)</option>
                    {garages.map((g) => <option key={g.id} value={g.id}>{g.public_name}</option>)}
                  </Select>
                </Field>
                <Field label="Basis" required>
                  <Select name="type" defaultValue="pct_labour">
                    <option value="pct_labour">Percentage of labour</option>
                    <option value="pct_total">Percentage of the transaction</option>
                    <option value="fixed">Fixed fee per booking</option>
                  </Select>
                </Field>
                <Field label="Percentage" hint="For either percentage basis.">
                  <Input name="ratePct" type="number" inputMode="decimal" min={0} max={100} step="0.1" placeholder="10" />
                </Field>
                <Field label="Fixed fee (₹)" hint="For a fixed fee only.">
                  <Input name="amount" type="number" inputMode="decimal" min={0} step="1" />
                </Field>
              </ActionForm>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
