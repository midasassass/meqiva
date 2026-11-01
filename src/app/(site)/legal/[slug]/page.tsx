import { notFound } from "next/navigation";
import { getCmsPage } from "@/lib/public-data";
import { fmtDate } from "@/lib/format";

export const revalidate = 3600;
export const dynamicParams = true;

const PAGES = ["about", "terms", "privacy", "grievance"] as const;
export const generateStaticParams = async () => PAGES.map((slug) => ({ slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getCmsPage(slug);
  return page ? { title: page.title, description: page.meta_description ?? undefined } : { title: "Not found" };
}

/** Light markdown: paragraphs, and **bold** at the start of a paragraph as a lead-in. */
function render(body: string) {
  return body.split(/\n{2,}/).map((para, i) => {
    const parts = para.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return (
      <p key={i}>
        {parts.map((p, j) =>
          p.startsWith("**") && p.endsWith("**")
            ? <strong key={j}>{p.slice(2, -2)}</strong>
            : <span key={j}>{p}</span>,
        )}
      </p>
    );
  });
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getCmsPage(slug);
  if (!page) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="display-2">{page.title}</h1>
      <p className="mt-2 text-[13px] text-ink2">Last updated {fmtDate(page.updated_at)}</p>
      <div className="prose-read mt-8 text-ink">{render(page.body)}</div>
    </article>
  );
}
