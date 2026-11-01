import { ActionForm } from "@/components/action-form";
import { Badge, Check, Empty, Field, Input, PageTitle, Panel, SegmentedLinks, Select, Table, Td, Textarea, Tr } from "@/components/ui";
import { saveCmsPage, saveFaq } from "@/server/admin";
import { fmtDate, titleCase } from "@/lib/format";
import { requireRole } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Content" };

export default async function Content({ searchParams }: { searchParams: Promise<{ tab?: string; edit?: string }> }) {
  await requireRole("super_admin");
  const sp = await searchParams;
  const tab = sp.tab ?? "faqs";
  const sb = await supabaseServer();

  const [pagesRes, faqsRes] = await Promise.all([
    sb.from("cms_pages").select("slug, title, published, updated_at").order("slug"),
    sb.from("faqs").select("id, topic, question, answer, audience, sort, published").order("audience").order("sort"),
  ]);
  const pages = pagesRes.data ?? [];
  const faqs = faqsRes.data ?? [];
  const editing = sp.edit ? pages.find((p) => p.slug === sp.edit) : null;

  const full = editing
    ? (await sb.from("cms_pages").select("slug, title, body, meta_description, published").eq("slug", editing.slug).maybeSingle()).data
    : null;

  return (
    <>
      <PageTitle title="Content" sub="The help centre and the legal pages, edited here and live immediately." />
      <SegmentedLinks
        current={tab === "faqs" ? "/admin/content" : "/admin/content?tab=pages"}
        items={[
          { href: "/admin/content", label: "Help articles", count: faqs.length },
          { href: "/admin/content?tab=pages", label: "Pages", count: pages.length },
        ]}
      />

      <div className="mt-5 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        {tab === "faqs" ? (
          <>
            <Panel title="Help articles">
              {faqs.length === 0 ? (
                <div className="p-5"><Empty title="No articles yet" /></div>
              ) : (
                <Table head={["Question", "Audience", "Topic", ""]}>
                  {faqs.map((f) => (
                    <Tr key={f.id}>
                      <Td className="text-[13px]">{f.question}</Td>
                      <Td><Badge tone={f.audience === "garage" ? "brand" : "neutral"}>{f.audience}</Badge></Td>
                      <Td className="text-[13px] text-ink2">{titleCase(f.topic)}</Td>
                      <Td className="text-right">{!f.published && <Badge tone="outline">Hidden</Badge>}</Td>
                    </Tr>
                  ))}
                </Table>
              )}
            </Panel>

            <Panel title="Add an article">
              <div className="p-4">
                <ActionForm action={saveFaq} submitLabel="Publish" resetOnSuccess fullWidth>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Audience">
                      <Select name="audience" defaultValue="customer">
                        <option value="customer">Vehicle owners</option>
                        <option value="garage">Garages</option>
                      </Select>
                    </Field>
                    <Field label="Topic" required><Input name="topic" required maxLength={40} placeholder="pricing" /></Field>
                  </div>
                  <Field label="Question" required><Input name="question" required minLength={5} maxLength={300} /></Field>
                  <Field label="Answer" required><Textarea name="answer" rows={5} required minLength={5} maxLength={4000} /></Field>
                  <Field label="Position"><Input name="sort" type="number" min={0} max={999} defaultValue={faqs.length} /></Field>
                  <Check name="hidden" label="Save without publishing" />
                </ActionForm>
              </div>
            </Panel>
          </>
        ) : (
          <>
            <Panel title="Pages">
              <Table head={["Page", "Updated", ""]}>
                {pages.map((p) => (
                  <Tr key={p.slug}>
                    <Td>
                      <a href={`/admin/content?tab=pages&edit=${p.slug}`} className="font-medium hover:underline">{p.title}</a>
                      <p className="tnum text-xs text-ink2">/legal/{p.slug}</p>
                    </Td>
                    <Td className="tnum text-[13px] text-ink2">{fmtDate(p.updated_at)}</Td>
                    <Td className="text-right">{!p.published && <Badge tone="outline">Hidden</Badge>}</Td>
                  </Tr>
                ))}
              </Table>
            </Panel>

            <Panel title={full ? `Edit ${full.title}` : "New page"}>
              <div className="p-4">
                <ActionForm action={saveCmsPage} submitLabel="Publish page" fullWidth>
                  <Field label="Slug" required hint="Appears at /legal/<slug>.">
                    <Input name="slug" required maxLength={60} pattern="[a-z0-9-]+" defaultValue={full?.slug ?? ""} />
                  </Field>
                  <Field label="Title" required><Input name="title" required maxLength={160} defaultValue={full?.title ?? ""} /></Field>
                  <Field label="Meta description" hint="Shown in search results.">
                    <Input name="metaDescription" maxLength={300} defaultValue={full?.meta_description ?? ""} />
                  </Field>
                  <Field label="Body" required hint="Blank lines separate paragraphs. **Bold** works at the start of one.">
                    <Textarea name="body" rows={14} required maxLength={60000} defaultValue={full?.body ?? ""} />
                  </Field>
                  <Check name="hidden" label="Save without publishing" defaultChecked={full ? !full.published : false} />
                </ActionForm>
              </div>
            </Panel>
          </>
        )}
      </div>
    </>
  );
}
