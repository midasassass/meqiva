import Link from "next/link";
import { Clock, MapPin, ShieldAlert, Truck } from "lucide-react";
import { Badge, ButtonLink, Callout, Card, Empty, Select, cx } from "@/components/ui";
import { PriceBreakdown } from "@/components/estimate";
import { Stamp, VerificationDisclaimer } from "@/components/stamp";
import { formatINR } from "@/lib/money";
import { compareOffers, priceBand, SOURCE_LABEL, type Offer, type RankedOffer } from "@/lib/compare";
import { getLocalities, getServicePackages } from "@/lib/public-data";
import { hasSupabase } from "@/lib/supabase/env";
import { supabasePublic } from "@/lib/supabase/public";

export const revalidate = 300;
export const metadata = {
  title: "Compare garage prices in Gurugram",
  description: "Itemised estimates from verified garages — parts, labour and tax shown before you book.",
};

interface Row {
  id: string; name: string; labour_paise: number; parts_paise: number; consumables_paise: number;
  gst_rate_bps: number; est_minutes: number; warranty_days: number; included_items: string[];
  price_source: Offer["priceSource"]; source_effective_on: string | null; package_id: number | null;
  garages: {
    id: string; slug: string; public_name: string; locality: string | null; verification: Offer["verification"];
    pickup_drop: boolean; is_demo: boolean;
  };
}

async function loadOffers(packageId: number | null, locality?: string): Promise<Offer[]> {
  if (!hasSupabase()) return [];
  let q = supabasePublic()
    .from("garage_services")
    .select(`id, name, labour_paise, parts_paise, consumables_paise, gst_rate_bps, est_minutes, warranty_days,
             included_items, price_source, source_effective_on, package_id,
             garages!inner(id, slug, public_name, locality, verification, pickup_drop, is_demo, status)`)
    .eq("active", true)
    .eq("garages.status", "active")
    .limit(40);
  if (packageId) q = q.eq("package_id", packageId);
  if (locality) q = q.eq("garages.locality", locality);

  const { data } = await q;
  const rows = (data ?? []) as unknown as Row[];
  return rows.map((r) => {
    const base = r.labour_paise + r.parts_paise + r.consumables_paise;
    const tax = Math.round((base * r.gst_rate_bps) / 10000);
    return {
      garageId: r.garages.id, garageName: r.garages.public_name, slug: r.garages.slug,
      locality: r.garages.locality, verification: r.garages.verification,
      rating: null, reviewCount: 0, distanceKm: null,
      totalPaise: base + tax, labourPaise: r.labour_paise, partsPaise: r.parts_paise,
      consumablesPaise: r.consumables_paise, taxPaise: tax,
      estMinutes: r.est_minutes, warrantyDays: r.warranty_days, pickupDrop: r.garages.pickup_drop,
      includedItems: r.included_items ?? [], priceSource: r.price_source,
      sourceEffectiveOn: r.source_effective_on,
    };
  });
}

export default async function Find({ searchParams }: { searchParams: Promise<{ service?: string; locality?: string }> }) {
  const sp = await searchParams;
  const [packages, localities] = await Promise.all([getServicePackages(), getLocalities()]);
  const pkg = packages.find((p) => p.slug === sp.service) ?? packages[0] ?? null;
  const offers = await loadOffers(pkg?.id ?? null, sp.locality);

  const result = pkg
    ? compareOffers(offers, { name: pkg.name, requiredItems: pkg.required_items })
    : { comparable: [], limited: [], packageName: "Service", requiredItems: [] };
  const band = priceBand(result);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="display-2">What this service should cost</h1>
      <p className="mt-3 max-w-[58ch] text-[15px] text-ink2">
        Every price below includes parts, labour, consumables and tax. Quotes that leave out part of the standard job are
        listed separately, never ranked against a complete one.
      </p>

      {/* Filters submit as a plain GET form — works with JavaScript off and keeps the page cacheable. */}
      <form className="mt-6 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">Service</span>
          <Select name="service" defaultValue={pkg?.slug}>
            {packages.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </Select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">Area</span>
          <Select name="locality" defaultValue={sp.locality ?? ""}>
            <option value="">All of Gurugram</option>
            {localities.map((l) => <option key={l.slug} value={l.name}>{l.name}</option>)}
          </Select>
        </label>
        <button className="h-11 self-end rounded-card bg-brand px-5 text-sm font-medium text-brand-fg transition-colors hover:bg-brand-hover">
          Update
        </button>
      </form>

      {pkg && (
        <Card className="mt-5 p-4">
          <p className="text-[13px] font-medium">A complete {pkg.name.toLowerCase()} covers</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {pkg.required_items.map((i) => (
              <li key={i}><Badge tone="outline">{i}</Badge></li>
            ))}
          </ul>
        </Card>
      )}

      {band && (
        <div className="tnum mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-panel border border-line bg-surface px-5 py-4">
          <p className="text-sm text-ink2">Across {result.comparable.length} comparable {result.comparable.length === 1 ? "quote" : "quotes"}</p>
          <p className="text-lg font-semibold">{formatINR(band.low)} – {formatINR(band.high)}</p>
          <p className="text-sm text-ink2">Typical {formatINR(band.median)}</p>
        </div>
      )}

      <section className="mt-8">
        {result.comparable.length === 0 ? (
          <Empty
            title={hasSupabase() ? "No garages listed for this yet" : "Connect a database to see live prices"}
            body={hasSupabase()
              ? "MEQIVA is onboarding workshops in Gurugram now. Tell us what you need and we will come back when a verified garage nearby can quote for it."
              : "Add your Supabase keys and run the migrations to see real garage prices here."}
            action={<ButtonLink href="/for-garages">Know a garage that should be here?</ButtonLink>}
          />
        ) : (
          <ul className="grid gap-3">
            {result.comparable.map((o) => <li key={o.garageId + o.slug}><OfferCard offer={o} /></li>)}
          </ul>
        )}
      </section>

      {result.limited.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-warn" aria-hidden />
            <h2 className="text-[15px] font-semibold">Cheaper, but not the same job</h2>
          </div>
          <p className="mt-1.5 max-w-[60ch] text-[13px] text-ink2">
            These quotes leave out something a complete {result.packageName.toLowerCase()} includes. They may still suit you —
            just do not read them as the same work for less.
          </p>
          <ul className="mt-4 grid gap-3">
            {result.limited.map((o) => <li key={o.garageId + o.slug}><OfferCard offer={o} /></li>)}
          </ul>
        </section>
      )}

      <div className="mt-10 space-y-3">
        <VerificationDisclaimer />
        <Callout tone="neutral">
          Prices are set by each garage and were current when last published. A diagnosis may change what the job needs —
          if it does, you will be asked to approve the difference before any extra work starts.
        </Callout>
      </div>
    </div>
  );
}

function OfferCard({ offer: o }: { offer: RankedOffer }) {
  const hours = o.estMinutes >= 60 ? `${Math.round((o.estMinutes / 60) * 10) / 10} hr` : `${o.estMinutes} min`;
  return (
    <Card className={cx("p-4 sm:p-5", o.scope === "limited" && "border-dashed")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/garages/${o.slug}`} className="text-[17px] font-semibold tracking-tight hover:underline">{o.garageName}</Link>
            <Stamp level={o.verification} />
            {o.sponsored && <Badge tone="outline">Sponsored</Badge>}
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink2">
            <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{o.locality ?? "Gurugram"}</span>
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" aria-hidden />{hours} in workshop</span>
            {o.pickupDrop && <span className="inline-flex items-center gap-1"><Truck className="h-3.5 w-3.5" aria-hidden />Pickup available</span>}
            {o.warrantyDays > 0 && <span>{o.warrantyDays}-day warranty</span>}
          </p>
        </div>
        <div className="text-right">
          <p className="tnum text-[22px] font-semibold tracking-tight">{formatINR(o.totalPaise)}</p>
          <p className="text-[11.5px] text-ink2">including GST</p>
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-3">
        <PriceBreakdown parts={o.partsPaise} labour={o.labourPaise} consumables={o.consumablesPaise} tax={o.taxPaise} />
      </div>

      {o.missingItems.length > 0 && (
        <p className="mt-3 text-[12.5px] text-warn">
          <span className="font-medium">Not included:</span> {o.missingItems.join(", ")}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11.5px] text-ink2">
          {SOURCE_LABEL[o.priceSource]}
          {o.sourceEffectiveOn && <span className="tnum"> · effective {o.sourceEffectiveOn}</span>}
        </p>
        <ButtonLink href={`/garages/${o.slug}`} size="sm" variant={o.scope === "full" ? "primary" : "outline"}>
          View and book
        </ButtonLink>
      </div>
    </Card>
  );
}
