import { ActionForm } from "@/components/action-form";
import { Badge, Check, Empty, Field, Input, Panel, Select, Table, Td, Tr } from "@/components/ui";
import { saveLabourRate } from "@/server/garage-settings";
import { formatINR } from "@/lib/money";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Labour rates" };

const CATEGORIES = ["", "hatchback", "sedan", "suv", "mpv", "motorcycle", "scooter", "ev"];

export default async function Rates() {
  const { sb, garage } = await requireGarageOrRedirect();
  const { data } = await sb.from("garage_labour_rates")
    .select("id, name, vehicle_category, rate_per_hour_paise, is_default")
    .eq("garage_id", garage.id).eq("active", true).order("is_default", { ascending: false });
  const rates = data ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
      <Panel title="Rate cards" description="The quotation builder suggests the matching rate for the vehicle being worked on.">
        {rates.length === 0 ? (
          <div className="p-5">
            <Empty title="No rate cards yet" body="Most workshops charge differently for a hatchback and an SUV, or for diagnostics against general work. Set those here once." />
          </div>
        ) : (
          <Table head={["Rate card", "Applies to", "Per hour"]}>
            {rates.map((r) => (
              <Tr key={r.id}>
                <Td>
                  <span className="font-medium">{r.name}</span>
                  {r.is_default && <Badge tone="brand" className="ml-2">Default</Badge>}
                </Td>
                <Td className="text-[13px] text-ink2">{r.vehicle_category ? r.vehicle_category : "All vehicles"}</Td>
                <Td className="tnum text-right font-medium">{formatINR(Number(r.rate_per_hour_paise))}</Td>
              </Tr>
            ))}
          </Table>
        )}
      </Panel>

      <Panel title="Add a rate card">
        <div className="p-4">
          <ActionForm action={saveLabourRate} submitLabel="Add rate card" resetOnSuccess fullWidth>
            <Field label="Name" required><Input name="name" required maxLength={80} placeholder="General mechanical — SUV" /></Field>
            <Field label="Vehicle category" hint="Leave blank to apply to everything.">
              <Select name="vehicleCategory" defaultValue="">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c === "" ? "All vehicles" : c}</option>)}
              </Select>
            </Field>
            <Field label="Rate per hour (₹)" required>
              <Input name="ratePerHour" type="number" inputMode="decimal" min={0} step="10" required placeholder="800" />
            </Field>
            <Check name="isDefault" label="Use as the default rate" hint="Only one card can be the default." />
          </ActionForm>
        </div>
      </Panel>
    </div>
  );
}
