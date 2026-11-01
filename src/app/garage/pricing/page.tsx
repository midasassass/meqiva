import { Callout, Empty, PageTitle, Panel, Progress, Stat } from "@/components/ui";
import { PricingGrid, type PackageRow } from "./grid";
import { CATEGORY_LABEL, type VehicleCategory } from "@/lib/estimate";
import { formatINR } from "@/lib/money";
import { requireGarageOrRedirect } from "@/lib/session";

export const metadata = { title: "Pricing" };

/**
 * The price matrix is what makes the public estimator data-backed rather than a guess:
 * every figure a customer is shown comes from rows a real garage saved here.
 */
export default async function Pricing({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const { sb, garage } = await requireGarageOrRedirect();

  const [pkgRes, matrixRes, coverageRes, positionRes] = await Promise.all([
    sb.from("service_packages").select("id, name, applies_to, required_items, typical_minutes")
      .eq("active", true).order("id"),
    sb.from("garage_price_matrix")
      .select("package_id, vehicle_category, labour_paise, parts_paise, consumables_paise, gst_rate_bps, est_minutes, warranty_days")
      .eq("garage_id", garage.id).eq("active", true),
    sb.rpc("garage_pricing_coverage", { p_garage: garage.id }).single(),
    sb.rpc("garage_price_position", { p_garage: garage.id }),
  ]);

  const packages = (pkgRes.data ?? []) as unknown as {
    id: number; name: string; applies_to: VehicleCategory[]; required_items: string[]; typical_minutes: number;
  }[];
  const matrix = (matrixRes.data ?? []) as unknown as ({ package_id: number } & PackageRow["rows"][number])[];
  const coverage = coverageRes.data as { priced: number; possible: number; pct: number } | null;
  const position = (positionRes.data ?? []) as unknown as {
    package_id: number; package_name: string; vehicle_category: VehicleCategory;
    own_paise: number; market_median_paise: number | null; market_garages: number; delta_bps: number;
  }[];

  // Market medians, keyed for the grid so each row can be priced against something real.
  const market: Record<number, PackageRow["market"]> = {};
  for (const p of position) {
    if (p.market_median_paise == null || p.market_garages < 2) continue;
    market[p.package_id] ??= {};
    market[p.package_id]![p.vehicle_category] = {
      medianPaise: Number(p.market_median_paise), garages: p.market_garages,
    };
  }

  const rows: PackageRow[] = packages.map((p) => ({
    id: p.id, name: p.name, appliesTo: p.applies_to ?? [], requiredItems: p.required_items ?? [],
    typicalMinutes: p.typical_minutes,
    market: market[p.id] ?? {},
    rows: matrix.filter((m) => m.package_id === p.id),
  }));

  const dearest = position
    .filter((p) => p.market_garages >= 2 && p.delta_bps > 1500)
    .sort((a, b) => b.delta_bps - a.delta_bps).slice(0, 3);

  return (
    <>
      <PageTitle
        title="Pricing"
        sub="One price per service, per vehicle type. This is what the public estimator reads, so a gap here is a customer you never see."
      />

      {welcome && (
        <Callout tone="success" title="Your garage is created">
          It is not listed publicly yet — MEQIVA reviews new workshops first. Meanwhile, price what you offer below.
          That is the one thing that decides whether customers find you.
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Prices published" value={coverage?.priced ?? 0} hint={`of ${coverage?.possible ?? 0} possible`} />
        <Stat label="Coverage" value={`${coverage?.pct ?? 0}%`} tone={(coverage?.pct ?? 0) < 50 ? "warn" : "success"} />
        <Stat label="Services offered" value={rows.filter((r) => r.rows.length > 0).length} hint={`of ${rows.length}`} />
        <Stat label="Above market" value={dearest.length} tone={dearest.length ? "warn" : "default"} hint="by more than 15%" />
      </div>

      <div className="mt-4">
        <Progress value={coverage?.pct ?? 0} label="How complete your price list is" />
      </div>

      {(coverage?.pct ?? 0) < 100 && (
        <Callout tone="brand" title="Every gap is a search you do not appear in">
          A customer picks their car and their service, and the estimator shows the garages that priced exactly that
          combination. Price a vehicle type you genuinely serve, even roughly — you can refine it later.
        </Callout>
      )}

      {dearest.length > 0 && (
        <Callout tone="warn" title="Noticeably above the market">
          {dearest.map((d) => (
            <span key={`${d.package_id}-${d.vehicle_category}`} className="tnum mr-3 inline-block">
              {d.package_name} · {CATEGORY_LABEL[d.vehicle_category]} at {formatINR(Number(d.own_paise))} against a
              median of {formatINR(Number(d.market_median_paise))}
            </span>
          ))}
          <span className="mt-1 block">
            Being dearer is a legitimate choice when the work is better. Just make sure the service description says why.
          </span>
        </Callout>
      )}

      <div className="mt-6 space-y-3">
        {rows.length === 0 ? (
          <Empty title="No standard services configured" body="MEQIVA admin publishes the standard service list. Ask them to add one for your trade." />
        ) : (
          rows.map((p, i) => (
            <div key={p.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
              <PricingGrid pkg={p} />
            </div>
          ))
        )}
      </div>

      <Panel title="How a customer sees this" className="mt-8">
        <div className="space-y-2 p-5 text-[13.5px] leading-relaxed text-ink2">
          <p>
            Your figures go straight into the public estimator. A customer who picks a Honda City and a basic service
            sees the spread across every garage that priced a sedan for that service, with yours among them.
          </p>
          <p>
            They never see your labour and parts split as costs — only the total and what it includes. Your margins stay
            on your side of the product.
          </p>
        </div>
      </Panel>
    </>
  );
}
