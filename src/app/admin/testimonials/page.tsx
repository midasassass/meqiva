import { PageTitle, Callout } from "@/components/ui";
import { TestimonialAdminManager, type TestimonialRow, type GarageOption } from "@/components/testimonial-admin-manager";
import { requireRole } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Testimonials Management" };

export default async function AdminTestimonials() {
  await requireRole("super_admin", "support_agent");
  const sb = await supabaseServer();

  const [tRes, gRes] = await Promise.all([
    sb.from("testimonials")
      .select("id, author_name, author_context, quote, rating, city, source, consent_on, published, is_demo, created_at, garages(public_name)")
      .order("is_demo").order("sort").order("created_at", { ascending: false }),
    sb.from("garages").select("id, public_name").eq("status", "active").order("name").limit(200),
  ]);

  const rows = (tRes.data ?? []) as unknown as TestimonialRow[];
  const garages = (gRes.data ?? []) as unknown as GarageOption[];

  return (
    <>
      <PageTitle
        title="Testimonials & Social Proof"
        sub="Manage customer reviews and public quotes. Set star ratings (1–5), toggle publication, verify consent dates, or edit testimonials. Real words only — no manufactured quotes."
      />

      <TestimonialAdminManager initialRows={rows} garages={garages} />

      <div className="mt-8">
        <Callout tone="warn" title="The Non-Negotiable Authenticity Rule">
          Do not fabricate testimonials or inflate ratings. Do not attribute a real quote to an invented customer.
          Every testimonial published on MEQIVA is backed by a verified consent date and actual platform review or recorded customer statement.
        </Callout>
      </div>
    </>
  );
}
