import { notFound } from "next/navigation";
import Link from "next/link";
import { ButtonLink, Card, Empty } from "@/components/ui";
import { Stamp } from "@/components/stamp";
import { getLocalities } from "@/lib/public-data";
import { hasSupabase } from "@/lib/supabase/env";
import { supabasePublic } from "@/lib/supabase/public";

export const revalidate = 1800;
export const dynamicParams = true;

export async function generateStaticParams() {
  const list = await getLocalities();
  return list.map((l) => ({ locality: l.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ locality: string }> }) {
  const { locality } = await params;
  const list = await getLocalities();
  const found = list.find((l) => l.slug === locality);
  if (!found) return { title: "Area not found" };
  return {
    title: `Car service in ${found.name}, ${found.city}`,
    description: found.intro ?? `Compare itemised service estimates from verified garages serving ${found.name}.`,
  };
}

export default async function Locality({ params }: { params: Promise<{ locality: string }> }) {
  const { locality } = await params;
  const list = await getLocalities();
  const area = list.find((l) => l.slug === locality);
  if (!area) notFound();

  let garages: { id: string; slug: string; public_name: string; locality: string | null; verification: "none" | "listed" | "verified" | "quality_assured" }[] = [];
  if (hasSupabase()) {
    const { data } = await supabasePublic()
      .from("garages").select("id, slug, public_name, locality, verification")
      .eq("status", "active").eq("locality", area.name).limit(20);
    garages = (data ?? []) as typeof garages;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="display-2">Car service in {area.name}</h1>
      {area.intro && <p className="mt-4 max-w-[60ch] text-[15px] text-ink2">{area.intro}</p>}

      <div className="mt-8">
        {garages.length === 0 ? (
          <Empty
            title={`No garages listed in ${area.name} yet`}
            body="MEQIVA is onboarding workshops across Gurugram. Nearby areas may already have verified garages that will collect from here."
            action={<ButtonLink href="/find">See everything in Gurugram</ButtonLink>}
          />
        ) : (
          <ul className="grid gap-3">
            {garages.map((g) => (
              <li key={g.id}>
                <Card className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <Link href={`/garages/${g.slug}`} className="font-medium hover:underline">{g.public_name}</Link>
                    <p className="mt-0.5 text-[12.5px] text-ink2">{g.locality}</p>
                  </div>
                  <Stamp level={g.verification} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>

      <nav aria-label="Other areas" className="mt-12 border-t border-line pt-6">
        <p className="text-[13px] font-medium">Other areas in {area.city}</p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          {list.filter((l) => l.slug !== area.slug).map((l) => (
            <li key={l.slug}><Link href={`/in/${l.slug}`} className="text-[13px] text-ink2 hover:text-ink hover:underline">{l.name}</Link></li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
