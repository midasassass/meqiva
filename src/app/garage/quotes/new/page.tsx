import { notFound } from "next/navigation";
import { Callout, Empty, PageTitle } from "@/components/ui";
import { ButtonLink } from "@/components/ui";
import { QuoteBuilder, type PartOption } from "./builder";
import { getSettings } from "@/lib/garage-data";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "New quotation" };

export default async function NewQuote({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const sp = await searchParams;
  const { sb, garage } = await requireGarageOrRedirect();

  if (!sp.job) {
    const { data: open } = await sb.from("job_cards")
      .select("id, complaints, vehicles(reg_no, vehicle_models(name, vehicle_makes(name)))")
      .eq("garage_id", garage.id).is("completed_at", null).order("checked_in_at", { ascending: false }).limit(20);

    const rows = (open ?? []) as unknown as {
      id: string; complaints: string | null;
      vehicles: { reg_no: string | null; vehicle_models: { name: string; vehicle_makes: { name: string } } } | null;
    }[];

    return (
      <>
        <PageTitle title="New quotation" sub="Pick the job card this quotation belongs to." />
        {rows.length === 0 ? (
          <Empty title="No open job cards" body="A quotation is always attached to a job, so that approvals and the invoice line up." action={<ButtonLink href="/garage/jobs/new">Open a job card</ButtonLink>} />
        ) : (
          <ul className="grid gap-2">
            {rows.map((j) => (
              <li key={j.id}>
                <ButtonLink href={`/garage/quotes/new?job=${j.id}`} variant="outline" className="w-full justify-start">
                  {j.vehicles ? `${j.vehicles.vehicle_models.vehicle_makes.name} ${j.vehicles.vehicle_models.name}` : "Walk-in"}
                  {j.vehicles?.reg_no && <span className="tnum text-ink2"> · {j.vehicles.reg_no}</span>}
                </ButtonLink>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  const { data: job } = await sb.from("job_cards")
    .select("id, complaints, diagnostics, origin, vehicles(reg_no, vehicle_models(name, vehicle_makes(name)))")
    .eq("id", sp.job).eq("garage_id", garage.id).maybeSingle();
  if (!job) notFound();

  const [settings, partsRes, ratesRes] = await Promise.all([
    getSettings(sb, garage.id),
    sb.from("parts").select("id, name, brand, sell_paise, purchase_paise, mrp_applies, mrp_paise, pack_qty, gst_rate_bps, stock")
      .eq("garage_id", garage.id).order("name").limit(300),
    sb.from("garage_labour_rates").select("id, name, rate_per_hour_paise, is_default").eq("garage_id", garage.id).eq("active", true),
  ]);

  const parts: PartOption[] = (partsRes.data ?? []).map((p) => ({
    id: p.id, label: `${p.name}${p.brand ? ` · ${p.brand}` : ""}`,
    sell: Number(p.sell_paise) / 100, cost: Number(p.purchase_paise) / 100,
    mrpApplies: p.mrp_applies, mrp: p.mrp_paise != null ? Number(p.mrp_paise) / 100 : null,
    packQty: p.pack_qty ?? 1, gstPct: Number(p.gst_rate_bps) / 100, stock: p.stock,
  }));

  const v = job.vehicles as unknown as { reg_no: string | null; vehicle_models: { name: string; vehicle_makes: { name: string } } } | null;
  const defaultRate = (ratesRes.data ?? []).find((r) => r.is_default)?.rate_per_hour_paise ?? settings?.default_labour_rate_paise ?? 60000;

  return (
    <>
      <PageTitle
        title="New quotation"
        sub={v ? `${v.vehicle_models.vehicle_makes.name} ${v.vehicle_models.name}${v.reg_no ? ` · ${v.reg_no}` : ""}` : "Walk-in vehicle"}
        back={{ href: `/garage/jobs/${job.id}`, label: "Back to the job card" }}
      />

      {job.diagnostics && (
        <Callout tone="neutral" title="Diagnostic findings">{job.diagnostics}</Callout>
      )}

      <div className="mt-5">
        <QuoteBuilder
          jobCardId={job.id}
          parts={parts}
          defaultGstPct={(settings?.default_gst_bps ?? 1800) / 100}
          defaultLabourRate={Number(defaultRate) / 100}
          lowMarginPct={(settings?.low_margin_alert_bps ?? 1000) / 100}
          targetMarginPct={(settings?.target_margin_bps ?? 3000) / 100}
          defaultWarrantyDays={settings?.default_warranty_days ?? 30}
        />
      </div>
    </>
  );
}
