import { AlertTriangle, Phone, ShieldCheck } from "lucide-react";
import { Badge, Callout, Card, Empty, PageTitle, SegmentedLinks } from "@/components/ui";
import { ASSISTANCE_KIND } from "@/lib/trust";
import { fmtDate, fmtPhone } from "@/lib/format";
import { hasSupabase } from "@/lib/supabase/env";
import { supabasePublic } from "@/lib/supabase/public";

export const revalidate = 3600;
export const metadata = {
  title: "Roadside help in Gurugram",
  description:
    "Phone numbers for towing, battery, puncture, fuel, lockout and accident help across Gurugram. Free to use, no account needed.",
};

const ORDER = ["towing", "battery", "tyre", "fuel", "lockout", "accident", "ev_charge"] as const;

export default async function Assistance({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;

  const { data } = hasSupabase()
    ? await supabasePublic().from("assistance_partners")
        .select("id, name, kinds, phone, whatsapp, city, localities, hours, notes, verified_at, sort")
        .eq("active", true).order("sort").order("name")
    : { data: null };

  const partners = (data ?? []) as {
    id: string; name: string; kinds: string[]; phone: string; whatsapp: string | null;
    city: string; localities: string[]; hours: string; notes: string | null;
    verified_at: string | null; sort: number;
  }[];

  const active = kind && ORDER.includes(kind as (typeof ORDER)[number]) ? kind : null;
  const shown = active ? partners.filter((p) => p.kinds.includes(active)) : partners;

  const counts = new Map<string, number>();
  for (const p of partners) for (const k of p.kinds) counts.set(k, (counts.get(k) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <PageTitle
        title="Stuck on the road?"
        sub="Numbers for the people who come to you — towing, battery, punctures, fuel, lockouts. Free to use, nothing to sign up for, and you deal with them directly."
      />

      <Callout tone="danger" icon={<AlertTriangle className="h-4 w-4" aria-hidden />} title="If anyone is hurt, call 112 first">
        112 is the national emergency number and reaches police, ambulance and fire. Use it before you call anyone on
        this page. 1033 is the national highway helpline for a breakdown or accident on a highway.
      </Callout>

      {partners.length === 0 ? (
        <div className="mt-8">
          <Empty
            title="No partners listed yet"
            body="This directory lists only people we have actually spoken to and checked. It fills up as we verify them, rather than being padded out with numbers scraped off the internet."
            icon={<Phone className="h-5 w-5" aria-hidden />}
          />
        </div>
      ) : (
        <>
          {partners.every((p) => !p.verified_at) && (
            <div className="mt-6">
              <Callout tone="warn" title="Nothing in this list has been checked yet">
                Every entry below is marked <strong>not yet checked</strong>, which means nobody at MEQIVA has rung
                the number and confirmed it. Some are placeholder listings seeded for a demonstration. Treat the
                whole page as unverified until the badges say otherwise, and use 112 or 1033 in a real emergency.
              </Callout>
            </div>
          )}

          <div className="mt-8">
            <SegmentedLinks
              current={active ? `/assistance?kind=${active}` : "/assistance"}
              items={[
                { href: "/assistance", label: "Everything", count: partners.length },
                ...ORDER.filter((k) => counts.get(k)).map((k) => ({
                  href: `/assistance?kind=${k}`,
                  label: ASSISTANCE_KIND[k] ?? k,
                  count: counts.get(k),
                })),
              ]}
            />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {shown.map((p, i) => (
              <Card key={p.id} className="rise flex flex-col p-5" style={{ "--i": i } as React.CSSProperties}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-[15px] font-bold leading-snug">{p.name}</h2>
                  {p.verified_at ? (
                    <Badge tone="success">
                      <ShieldCheck className="mr-1 inline h-3 w-3" aria-hidden />
                      Checked {fmtDate(p.verified_at)}
                    </Badge>
                  ) : (
                    <Badge tone="warn">Not yet checked</Badge>
                  )}
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {p.kinds.map((k) => (
                    <Badge key={k} tone="neutral">{ASSISTANCE_KIND[k] ?? k}</Badge>
                  ))}
                </div>

                <p className="mt-3 text-[12.5px] text-ink2">
                  {p.hours} · {p.localities.length > 0 ? p.localities.join(", ") : p.city}
                </p>
                {p.notes && <p className="mt-2 text-[12.5px] leading-relaxed text-ink2">{p.notes}</p>}

                <div className="mt-4 flex flex-wrap gap-2 pt-1">
                  <a href={`tel:${p.phone.replace(/\s+/g, "")}`}
                    className="press inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-sm2 bg-brand px-4 text-sm font-semibold text-brand-fg hover:bg-brand-hover">
                    <Phone className="h-4 w-4" aria-hidden />
                    <span className="tnum">{fmtPhone(p.phone)}</span>
                  </a>
                  {p.whatsapp && (
                    <a href={`https://wa.me/${p.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"
                      className="press inline-flex h-10 items-center justify-center rounded-sm2 border border-line-strong px-4 text-sm font-semibold hover:bg-surface2">
                      WhatsApp
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {shown.length === 0 && (
            <p className="mt-6 text-[13.5px] text-ink2">
              Nobody listed for that yet. Try &ldquo;Everything&rdquo; above.
            </p>
          )}
        </>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        <Callout tone="neutral" title="What we check, and what we do not">
          Before anyone is listed we confirm the number answers, that they operate where they say, and what they
          charge for a callout. We do not supervise the job, we take no commission on it, and the price you agree is
          between you and them. A listing is not a guarantee.
        </Callout>
        <Callout tone="brand" title="Agree the price before they set off">
          Ask for the callout charge and the per-kilometre rate on the phone, and ask whether it changes at night.
          Most disputes on the roadside are about a number nobody said out loud.
        </Callout>
      </div>
    </div>
  );
}
