import { notFound } from "next/navigation";
import Link from "next/link";
import { Clock, MapPin, Phone, Truck } from "lucide-react";
import { Badge, ButtonLink, Callout, Card, Empty, Panel, Section } from "@/components/ui";
import { Stamp, VerificationDisclaimer, LEVEL_MEANS, type Level } from "@/components/stamp";
import { formatINR } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import { resolveTheme, themeVars } from "@/lib/theme";
import { DEFAULT_HOURS } from "@/lib/availability";
import { hasSupabase } from "@/lib/supabase/env";
import { supabasePublic } from "@/lib/supabase/public";

export const revalidate = 600;

const DAY_NAME: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday",
};
const ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

async function load(slug: string) {
  if (!hasSupabase()) return null;
  const sb = supabasePublic();
  const { data: garage } = await sb
    .from("garages")
    .select("id, slug, public_name, locality, city, address, pincode, phone, verification, verified_at, verification_expires_at, pickup_drop, bays_count, is_demo, status")
    .eq("slug", slug).eq("status", "active").maybeSingle();
  if (!garage) return null;

  const [settings, services, hours, terms, reviews] = await Promise.all([
    sb.from("garage_settings").select("accent_hex, tagline, about, pickup_enabled, pickup_fee_paise, cancellation_window_hours, default_warranty_days").eq("garage_id", garage.id).maybeSingle(),
    sb.from("garage_services").select("id, name, description, labour_paise, parts_paise, consumables_paise, gst_rate_bps, est_minutes, warranty_days, included_items, exclusions").eq("garage_id", garage.id).eq("active", true).order("labour_paise").limit(24),
    sb.from("garage_hours").select("day, opens, closes, closed").eq("garage_id", garage.id),
    sb.from("garage_terms").select("warranty_policy, cancellation_policy").eq("garage_id", garage.id).maybeSingle(),
    sb.from("reviews").select("id, rating, remarks, created_at, quality, price_transparency, timeliness, communication").eq("garage_id", garage.id).order("created_at", { ascending: false }).limit(8),
  ]);

  return {
    garage, settings: settings.data, services: services.data ?? [],
    hours: hours.data ?? [], terms: terms.data, reviews: reviews.data ?? [],
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) return { title: "Garage not found" };
  return {
    title: `${d.garage.public_name} — service prices in ${d.garage.locality ?? d.garage.city}`,
    description: d.settings?.tagline ?? `Itemised service prices, verification status and booking for ${d.garage.public_name}.`,
  };
}

export default async function GarageProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  const { garage, settings, services, terms, reviews } = d;
  const level = garage.verification as Level;

  const theme = resolveTheme(settings?.accent_hex);
  const hours = d.hours.length
    ? [...d.hours].sort((a, b) => ORDER.indexOf(a.day) - ORDER.indexOf(b.day))
    : DEFAULT_HOURS.map((h) => ({ day: h.day, opens: h.opens, closes: h.closes, closed: !!h.closed }));

  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null;

  // JSON-LD helps this page appear correctly in search results.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoRepair",
    name: garage.public_name,
    address: { "@type": "PostalAddress", streetAddress: garage.address ?? undefined, addressLocality: garage.locality ?? garage.city, postalCode: garage.pincode ?? undefined, addressRegion: "Haryana", addressCountry: "IN" },
    telephone: garage.phone ?? undefined,
    ...(avg && reviews.length >= 3 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: avg.toFixed(1), reviewCount: reviews.length } } : {}),
  };

  return (
    <div style={themeVars(theme) as React.CSSProperties}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {garage.is_demo && (
          <Callout tone="warn" title="Demonstration garage">
            This is seeded data for testing. The business, prices and records are fictional.
          </Callout>
        )}

        <header className="mt-4 flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0">
            <h1 className="display-2">{garage.public_name}</h1>
            {settings?.tagline && <p className="mt-2 max-w-[55ch] text-[15px] text-ink2">{settings.tagline}</p>}
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink2">
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" aria-hidden />{[garage.address, garage.locality, garage.city].filter(Boolean).join(", ")}</span>
              {garage.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" aria-hidden />{garage.phone}</span>}
              {garage.pickup_drop && <span className="inline-flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" aria-hidden />Pickup and drop</span>}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3">
            <Stamp level={level} size="lg" verifiedAt={garage.verified_at} expiresAt={garage.verification_expires_at} />
            <ButtonLink href={`/book/${garage.slug}`} size="lg">Book a slot</ButtonLink>
          </div>
        </header>

        <p className="mt-4 max-w-[70ch] text-[13px] text-ink2">{LEVEL_MEANS[level]}</p>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <div className="space-y-6">
            <Panel title="Services and prices" description="Everything shown includes parts, labour, consumables and GST.">
              {services.length === 0 ? (
                <div className="p-5"><Empty title="No published prices yet" body="This garage has not published a price list. Ask for a quotation through MEQIVA and it will be itemised." /></div>
              ) : (
                <ul className="divide-y divide-line">
                  {services.map((s) => {
                    const base = s.labour_paise + s.parts_paise + s.consumables_paise;
                    const total = base + Math.round((base * s.gst_rate_bps) / 10000);
                    return (
                      <li key={s.id} className="px-4 py-4 sm:px-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-medium">{s.name}</p>
                            {s.description && <p className="mt-1 text-[13px] text-ink2">{s.description}</p>}
                            {s.included_items?.length > 0 && (
                              <ul className="mt-2 flex flex-wrap gap-1.5">
                                {s.included_items.map((i: string) => <li key={i}><Badge tone="outline">{i}</Badge></li>)}
                              </ul>
                            )}
                            {s.exclusions && <p className="mt-2 text-[12.5px] text-warn">Not included: {s.exclusions}</p>}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="tnum text-lg font-semibold">{formatINR(total)}</p>
                            <p className="text-[11.5px] text-ink2">
                              <span className="tnum">{s.est_minutes}</span> min
                              {s.warranty_days > 0 && <> · <span className="tnum">{s.warranty_days}</span>-day warranty</>}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel title={`Reviews${reviews.length ? ` (${reviews.length})` : ""}`} description="Only customers whose booking completed through MEQIVA can leave one.">
              {reviews.length === 0 ? (
                <div className="p-5"><Empty title="No reviews yet" body="Reviews appear here once customers complete bookings through MEQIVA." /></div>
              ) : (
                <ul className="divide-y divide-line">
                  {reviews.map((r) => (
                    <li key={r.id} className="px-4 py-4 sm:px-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="tnum text-sm font-semibold">{r.rating}/5</p>
                        <p className="text-xs text-ink2">{fmtDate(r.created_at)}</p>
                      </div>
                      {r.remarks && <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink2">{r.remarks}</p>}
                      <p className="mt-2"><Badge tone="success">Verified booking</Badge></p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <aside className="space-y-6">
            <Panel title="Opening hours">
              <ul className="divide-y divide-line text-[13.5px]">
                {hours.map((h) => (
                  <li key={h.day} className="flex justify-between px-4 py-2.5">
                    <span className="text-ink2">{DAY_NAME[h.day]}</span>
                    <span className="tnum">{h.closed ? "Closed" : `${String(h.opens).slice(0, 5)} – ${String(h.closes).slice(0, 5)}`}</span>
                  </li>
                ))}
              </ul>
              <p className="flex items-center gap-1.5 border-t border-line px-4 py-2.5 text-xs text-ink2">
                <Clock className="h-3.5 w-3.5" aria-hidden />Slots offered respect these hours and bay capacity.
              </p>
            </Panel>

            {(settings?.about || terms?.warranty_policy || terms?.cancellation_policy) && (
              <Card>
                {settings?.about && (
                  <Section title="About this workshop"><p className="prose-read text-[14.5px] text-ink2">{settings.about}</p></Section>
                )}
                {terms?.warranty_policy && (
                  <Section title="Warranty"><p className="text-[13px] leading-relaxed text-ink2">{terms.warranty_policy}</p></Section>
                )}
                {terms?.cancellation_policy && (
                  <Section title="Cancellation"><p className="text-[13px] leading-relaxed text-ink2">{terms.cancellation_policy}</p></Section>
                )}
              </Card>
            )}

            <Card>
              <p className="text-[13px] font-medium">Booking terms</p>
              <ul className="mt-2 space-y-1.5 text-[12.5px] text-ink2">
                <li>Free cancellation up to <span className="tnum">{settings?.cancellation_window_hours ?? 6}</span> hours before the slot.</li>
                {settings?.pickup_enabled && (
                  <li>Pickup and drop{settings.pickup_fee_paise ? ` at ${formatINR(Number(settings.pickup_fee_paise))}` : " at no charge"}.</li>
                )}
                <li>Extra work is billed only after you approve it.</li>
              </ul>
            </Card>

            <VerificationDisclaimer />
            <p className="text-xs text-ink2">
              Repairs are performed by this garage, which issues the tax invoice and owns the workmanship warranty.{" "}
              <Link href="/legal/terms" className="underline">Terms</Link>.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
