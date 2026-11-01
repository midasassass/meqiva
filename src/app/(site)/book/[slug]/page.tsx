import { notFound } from "next/navigation";
import Link from "next/link";
import { ButtonLink, Callout, Card, Empty, Panel, Select } from "@/components/ui";
import { Stamp, type Level } from "@/components/stamp";
import { BookingForm } from "./booking-form";
import { formatINR } from "@/lib/money";
import { fmtDayLabel } from "@/lib/format";
import { istYmd, nextAvailableDays } from "@/lib/availability";
import { getBusy, getHolidays, getHours, getSettings, rulesFrom } from "@/lib/garage-data";
import { getSessionUser, supabaseServer } from "@/lib/supabase/server";
import { hasSupabase } from "@/lib/supabase/env";
import { resolveTheme, themeVars } from "@/lib/theme";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: `Book a slot`, description: `Choose a service and a time at ${slug}.`, robots: { index: false } };
}

export default async function BookPage({
  params, searchParams,
}: { params: Promise<{ slug: string }>; searchParams: Promise<{ service?: string; date?: string }> }) {
  if (!hasSupabase()) notFound();
  const { slug } = await params;
  const sp = await searchParams;
  const sb = await supabaseServer();

  const { data: garage } = await sb
    .from("garages")
    .select("id, slug, public_name, locality, city, bays_count, verification, verified_at, verification_expires_at, status")
    .eq("slug", slug).eq("status", "active").maybeSingle();
  if (!garage) notFound();

  const [settings, services, hours, holidays, user] = await Promise.all([
    getSettings(sb, garage.id),
    sb.from("garage_services")
      .select("id, name, description, labour_paise, parts_paise, consumables_paise, gst_rate_bps, est_minutes, warranty_days, included_items")
      .eq("garage_id", garage.id).eq("active", true).order("name"),
    getHours(sb, garage.id),
    getHolidays(sb, garage.id),
    getSessionUser(),
  ]);

  const list = services.data ?? [];
  const service = list.find((s) => s.id === sp.service) ?? list[0] ?? null;
  const duration = service?.est_minutes ?? 90;
  const theme = resolveTheme(settings?.accent_hex);

  const now = new Date();
  const busy = await getBusy(sb, garage.id, now, new Date(now.getTime() + 35 * 864e5));
  const rules = rulesFrom(settings, garage.bays_count ?? 1);
  const days = nextAvailableDays({ durationMinutes: duration, hours, holidays, busy, rules, now }, 21).slice(0, 10);
  const day = days.find((d) => d.ymd === sp.date) ?? days[0] ?? null;

  let vehicles: { id: string; label: string }[] = [];
  if (user) {
    const { data } = await sb.from("vehicles").select("id, year, reg_no, vehicle_models(name, vehicle_makes(name))").order("created_at", { ascending: false });
    vehicles = ((data ?? []) as unknown as { id: string; year: number | null; reg_no: string | null; vehicle_models: { name: string; vehicle_makes: { name: string } } }[])
      .map((v) => ({ id: v.id, label: `${v.vehicle_models.vehicle_makes.name} ${v.vehicle_models.name}${v.year ? ` ${v.year}` : ""}${v.reg_no ? ` · ${v.reg_no}` : ""}` }));
  }

  const base = service ? service.labour_paise + service.parts_paise + service.consumables_paise : 0;
  const total = service ? base + Math.round((base * service.gst_rate_bps) / 10000) : 0;
  const deposit = settings?.deposit_bps ? Math.round((total * settings.deposit_bps) / 10000) : 0;

  return (
    <div style={themeVars(theme) as React.CSSProperties} className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link href={`/garages/${garage.slug}`} className="text-[13px] text-ink2 hover:text-ink">Back to {garage.public_name}</Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="display-2">Book at {garage.public_name}</h1>
          <p className="mt-2 text-[14px] text-ink2">{garage.locality ?? garage.city}</p>
        </div>
        <Stamp level={garage.verification as Level} verifiedAt={garage.verified_at} expiresAt={garage.verification_expires_at} />
      </div>

      {list.length === 0 ? (
        <div className="mt-8"><Empty title="No bookable services" body="This garage has not published a service list yet. Contact them directly or try another workshop." action={<ButtonLink href="/find">Compare garages</ButtonLink>} /></div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <div className="space-y-6">
            <Panel title="1. What does it need?">
              <form className="flex flex-wrap items-end gap-2 p-4">
                <label className="min-w-[14rem] flex-1">
                  <span className="mb-1.5 block text-[13px] font-medium">Service</span>
                  <Select name="service" defaultValue={service?.id}>
                    {list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </label>
                <button className="h-11 rounded-card border border-line-strong px-4 text-sm font-medium transition-colors hover:bg-surface2">Update</button>
              </form>
              {service && (
                <div className="border-t border-line px-4 py-3 text-[13px] text-ink2">
                  {service.description && <p>{service.description}</p>}
                  {service.included_items?.length > 0 && <p className="mt-1">Includes {service.included_items.join(", ").toLowerCase()}.</p>}
                  <p className="tnum mt-1">About {service.est_minutes} minutes in the workshop{service.warranty_days > 0 && `, ${service.warranty_days}-day warranty`}.</p>
                </div>
              )}
            </Panel>

            <Panel title="2. When suits you?" description="Only times this workshop can genuinely honour are shown.">
              {days.length === 0 ? (
                <div className="p-5">
                  <Empty title="No slots in the next three weeks" body="The workshop is fully booked or has online booking switched off. Try another garage, or contact this one directly." />
                </div>
              ) : (
                <>
                  <form className="flex gap-1.5 overflow-x-auto p-4 pb-3">
                    <input type="hidden" name="service" value={service?.id ?? ""} />
                    {days.map((d) => (
                      <button key={d.ymd} name="date" value={d.ymd}
                        className={`shrink-0 rounded-card border px-3 py-2 text-[13px] transition-colors ${
                          d.ymd === day?.ymd ? "border-brand bg-brand-soft font-medium text-brand" : "border-line hover:bg-surface2"}`}>
                        <span className="block">{fmtDayLabel(d.ymd)}</span>
                        <span className="tnum block text-[11px] opacity-70">{d.slots.length} slots</span>
                      </button>
                    ))}
                  </form>

                  {day && service && (
                    <BookingForm
                      garageId={garage.id}
                      serviceId={service.id}
                      durationMinutes={duration}
                      slots={day.slots.map((s) => ({ iso: s.start.toISOString(), free: s.free }))}
                      vehicles={vehicles}
                      signedIn={!!user}
                      pickupEnabled={!!settings?.pickup_enabled}
                      pickupFeePaise={Number(settings?.pickup_fee_paise ?? 0)}
                      nextUrl={`/book/${garage.slug}?service=${service.id}&date=${day.ymd}`}
                    />
                  )}
                </>
              )}
            </Panel>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24">
            {service && (
              <Card>
                <p className="text-[13px] font-medium">{service.name}</p>
                <dl className="mt-3 space-y-2 text-[13px]">
                  <div className="flex justify-between"><dt className="text-ink2">Parts</dt><dd className="tnum">{formatINR(service.parts_paise)}</dd></div>
                  <div className="flex justify-between"><dt className="text-ink2">Labour</dt><dd className="tnum">{formatINR(service.labour_paise)}</dd></div>
                  {service.consumables_paise > 0 && <div className="flex justify-between"><dt className="text-ink2">Consumables</dt><dd className="tnum">{formatINR(service.consumables_paise)}</dd></div>}
                  <div className="flex justify-between"><dt className="text-ink2">GST</dt><dd className="tnum">{formatINR(total - base)}</dd></div>
                  <div className="flex justify-between border-t border-line pt-2 text-[15px] font-semibold"><dt>Estimate</dt><dd className="tnum">{formatINR(total)}</dd></div>
                </dl>
                {deposit > 0 && <p className="tnum mt-3 text-[12.5px] text-ink2">A deposit of {formatINR(deposit)} is taken at booking and adjusted against the final bill.</p>}
              </Card>
            )}
            <Callout tone="neutral">
              This is the estimate for the work as described. If the garage finds anything else, it has to send you a
              fresh authorisation before touching it — and nothing extra appears on your invoice without it.
            </Callout>
            <p className="text-xs text-ink2">
              Free cancellation up to <span className="tnum">{settings?.cancellation_window_hours ?? 6}</span> hours before the slot.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
