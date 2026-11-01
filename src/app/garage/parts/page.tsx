import { ActionForm } from "@/components/action-form";
import { Badge, Callout, Check, Empty, Field, Input, PageTitle, Panel, SegmentedLinks, Select, Table, Td, Tr } from "@/components/ui";
import { adjustStock, savePart } from "@/server/garage-ops";
import { formatINR } from "@/lib/money";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Parts and stock" };

export default async function Parts({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { sb, garage } = await requireGarageOrRedirect();
  const sp = await searchParams;

  const [partsRes, violationsRes] = await Promise.all([
    sb.from("parts")
      .select("id, name, brand, part_no, stock, reorder_at, purchase_paise, sell_paise, mrp_applies, mrp_paise, category")
      .eq("garage_id", garage.id).order("name").limit(300),
    sb.from("pricing_violations").select("id, description, attempted_paise, mrp_paise, created_at")
      .eq("garage_id", garage.id).is("resolved_at", null).order("created_at", { ascending: false }).limit(10),
  ]);

  const all = partsRes.data ?? [];
  const violations = violationsRes.data ?? [];
  const parts = sp.filter === "low" ? all.filter((p) => p.stock <= p.reorder_at) : all;

  const valuation = all.reduce((a, p) => a + p.stock * Number(p.purchase_paise), 0);
  const retail = all.reduce((a, p) => a + p.stock * Number(p.sell_paise), 0);

  return (
    <>
      <PageTitle
        title="Parts and stock"
        sub={`${all.length} parts · ${formatINR(valuation)} at cost, ${formatINR(retail)} at retail`}
      />

      {sp.filter === "mrp" && violations.length > 0 && (
        <Callout tone="danger" title={`${violations.length} pricing attempt${violations.length === 1 ? "" : "s"} above MRP were blocked`}>
          <ul className="mt-1 space-y-1">
            {violations.map((v) => (
              <li key={v.id} className="tnum">
                {v.description ?? "Part"} — tried {formatINR(Number(v.attempted_paise ?? 0))} against an MRP of {formatINR(Number(v.mrp_paise ?? 0))}
              </li>
            ))}
          </ul>
        </Callout>
      )}

      <SegmentedLinks
        current={sp.filter ? `/garage/parts?filter=${sp.filter}` : "/garage/parts"}
        items={[
          { href: "/garage/parts", label: "All", count: all.length },
          { href: "/garage/parts?filter=low", label: "Low stock", count: all.filter((p) => p.stock <= p.reorder_at).length },
          { href: "/garage/parts?filter=mrp", label: "Blocked prices", count: violations.length },
        ]}
      />

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <Panel>
          {parts.length === 0 ? (
            <div className="p-5"><Empty title="No parts yet" body="Add the parts you keep on the shelf. Stock moves on its own as jobs consume them." /></div>
          ) : (
            <Table head={["Part", "Stock", "Cost", "Sells for"]}>
              {parts.map((p) => (
                <Tr key={p.id}>
                  <Td>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-ink2">
                      {[p.brand, p.part_no].filter(Boolean).join(" · ")}
                      {p.mrp_applies && p.mrp_paise != null && <span className="tnum"> · MRP {formatINR(Number(p.mrp_paise))}</span>}
                    </p>
                  </Td>
                  <Td>
                    <Badge tone={p.stock <= p.reorder_at ? "warn" : "neutral"}>
                      <span className="tnum">{p.stock}</span>
                    </Badge>
                  </Td>
                  <Td className="tnum text-[13px] text-ink2">{formatINR(Number(p.purchase_paise))}</Td>
                  <Td className="tnum text-right font-medium">{formatINR(Number(p.sell_paise))}</Td>
                </Tr>
              ))}
            </Table>
          )}
        </Panel>

        <div className="space-y-6">
          <Panel title="Add a part">
            <div className="p-4">
              <ActionForm action={savePart} submitLabel="Add part" resetOnSuccess fullWidth>
                <Field label="Name" required><Input name="name" required maxLength={160} placeholder="Engine oil 5W-30, 3.5L" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Brand"><Input name="brand" maxLength={80} /></Field>
                  <Field label="Part number"><Input name="partNo" maxLength={80} /></Field>
                </div>
                <Check name="mrpApplies" label="Packaged good with a printed MRP"
                  hint="MEQIVA then refuses any price above it, and never adds GST on top." />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Printed MRP (₹)"><Input name="mrp" type="number" inputMode="decimal" min={0} step="0.01" /></Field>
                  <Field label="Pack quantity"><Input name="packQty" type="number" inputMode="numeric" min={1} defaultValue={1} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="You pay (₹)" required><Input name="purchase" type="number" inputMode="decimal" min={0} step="0.01" required /></Field>
                  <Field label="You charge (₹)" required><Input name="sell" type="number" inputMode="decimal" min={0} step="0.01" required /></Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="GST %"><Input name="gstPct" type="number" inputMode="decimal" min={0} max={28} step="0.5" defaultValue={18} /></Field>
                  <Field label="Opening stock"><Input name="stock" type="number" inputMode="numeric" min={0} defaultValue={0} /></Field>
                  <Field label="Reorder at"><Input name="reorderAt" type="number" inputMode="numeric" min={0} defaultValue={2} /></Field>
                </div>
                <Field label="Category">
                  <Select name="category" defaultValue="unknown">
                    <option value="genuine">Genuine</option>
                    <option value="oem">OEM</option>
                    <option value="aftermarket">Aftermarket</option>
                    <option value="unknown">Not stated</option>
                  </Select>
                </Field>
              </ActionForm>
            </div>
          </Panel>

          {all.length > 0 && (
            <Panel title="Record stock movement">
              <div className="p-4">
                <ActionForm action={adjustStock} submitLabel="Record" variant="outline" resetOnSuccess fullWidth>
                  <Field label="Part" required>
                    <Select name="partId" required defaultValue="">
                      <option value="" disabled>Choose a part</option>
                      {all.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.stock} in stock</option>)}
                    </Select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Movement" required>
                      <Select name="kind" defaultValue="inward">
                        <option value="inward">Stock received</option>
                        <option value="outward">Stock issued</option>
                        <option value="adjustment">Correction</option>
                      </Select>
                    </Field>
                    <Field label="Quantity" required hint="Use a negative number for a downward correction.">
                      <Input name="qty" type="number" inputMode="numeric" required defaultValue={1} />
                    </Field>
                  </div>
                  <Field label="Note"><Input name="note" maxLength={200} placeholder="Received against invoice 4412" /></Field>
                </ActionForm>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
