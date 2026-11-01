"use client";
import { useState } from "react";
import {
  MessageSquareQuote, Edit3, Trash2, Globe, EyeOff, Sparkles, Filter, X, CheckCircle2,
} from "lucide-react";
import { ActionButton, ActionForm } from "./action-form";
import { StarRatingInput, StarRatingDisplay } from "./star-rating";
import { Badge, Card, Check, Empty, Field, Input, Panel, Section, Select, Stat, Textarea, cx, Button } from "./ui";
import { saveTestimonial, setTestimonialPublished, deleteTestimonial } from "@/server/trust-admin";
import { fmtDate } from "@/lib/format";

export interface TestimonialRow {
  id: string;
  author_name: string;
  author_context: string | null;
  quote: string;
  rating: number | null;
  city: string | null;
  source: string;
  consent_on: string | null;
  published: boolean;
  is_demo: boolean;
  created_at: string;
  garages: { public_name: string } | null;
}

export interface GarageOption {
  id: string;
  public_name: string;
}

const SOURCE_LABELS: Record<string, string> = {
  platform_review: "From a MEQIVA review",
  interview: "Said in an interview",
  written: "Written to us directly",
};

export function TestimonialAdminManager({
  initialRows,
  garages,
}: {
  initialRows: TestimonialRow[];
  garages: GarageOption[];
}) {
  const [filter, setFilter] = useState<"all" | "published" | "draft" | "demo" | "5star" | "4star">("all");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states for live preview & editing
  const [formAuthor, setFormAuthor] = useState("");
  const [formContext, setFormContext] = useState("");
  const [formQuote, setFormQuote] = useState("");
  const [formRating, setFormRating] = useState<number | null>(5);
  const [formCity, setFormCity] = useState("");
  const [formSource, setFormSource] = useState("platform_review");
  const [formGarageId, setFormGarageId] = useState("");
  const [formConsent, setFormConsent] = useState(new Date().toISOString().slice(0, 10));
  const [formPublished, setFormPublished] = useState(true);

  const real = initialRows.filter((r) => !r.is_demo);
  const demo = initialRows.filter((r) => r.is_demo);

  const startEdit = (t: TestimonialRow) => {
    setEditingId(t.id);
    setFormAuthor(t.author_name);
    setFormContext(t.author_context ?? "");
    setFormQuote(t.quote);
    setFormRating(t.rating);
    setFormCity(t.city ?? "");
    setFormSource(t.source ?? "platform_review");
    setFormConsent(t.consent_on ?? new Date().toISOString().slice(0, 10));
    setFormPublished(t.published);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormAuthor("");
    setFormContext("");
    setFormQuote("");
    setFormRating(5);
    setFormCity("");
    setFormSource("platform_review");
    setFormConsent(new Date().toISOString().slice(0, 10));
    setFormPublished(true);
  };

  // Filter rows
  const filteredRows = initialRows.filter((r) => {
    if (filter === "published") return r.published;
    if (filter === "draft") return !r.published && !r.is_demo;
    if (filter === "demo") return r.is_demo;
    if (filter === "5star") return r.rating === 5;
    if (filter === "4star") return r.rating === 4;
    return true;
  });

  const avgRating = real.length > 0
    ? (real.reduce((acc, r) => acc + (r.rating ?? 5), 0) / real.length).toFixed(1)
    : "5.0";

  return (
    <div className="space-y-6">
      {/* Top metrics bar */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Live on site"
          value={String(real.filter((r) => r.published).length)}
          tone="success"
          hint={`${real.length} real quotes total`}
        />
        <Stat
          label="Average Star Rating"
          value={`${avgRating} ★`}
          tone="brand"
          hint="Calculated across verified testimonials"
        />
        <Stat
          label="Drafts / Pending"
          value={String(real.filter((r) => !r.published).length)}
          hint="Unpublished quotes pending review"
        />
        <Stat
          label="Demo Samples"
          value={String(demo.length)}
          tone={demo.length > 0 ? "warn" : undefined}
          hint={demo.length > 0 ? "Replace with real quotes prior to full launch" : "All clean!"}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        {/* Left Column: Manage Testimonials */}
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="mr-1 inline-flex items-center text-ink3 font-medium">
                <Filter className="mr-1 h-3.5 w-3.5" /> Filter:
              </span>
              {[
                { id: "all", label: `All (${initialRows.length})` },
                { id: "published", label: `Live (${initialRows.filter((r) => r.published).length})` },
                { id: "draft", label: `Drafts (${real.filter((r) => !r.published).length})` },
                { id: "5star", label: `5-Star (${initialRows.filter((r) => r.rating === 5).length})` },
                { id: "4star", label: `4-Star (${initialRows.filter((r) => r.rating === 4).length})` },
                { id: "demo", label: `Samples (${demo.length})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id as typeof filter)}
                  className={cx(
                    "rounded-sm2 px-2.5 py-1 font-medium transition-colors",
                    filter === tab.id
                      ? "bg-brand text-brand-fg shadow-soft"
                      : "bg-surface2 text-ink2 hover:text-ink"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Testimonials List */}
          {filteredRows.length === 0 ? (
            <Empty
              title="No testimonials found"
              body="No entries match your current filter. Record a genuine customer quote on the right."
              icon={<MessageSquareQuote className="h-6 w-6 text-ink3" />}
            />
          ) : (
            <div className="space-y-4">
              {filteredRows.map((r) => {
                const isSelectedForEdit = editingId === r.id;
                return (
                  <Card
                    key={r.id}
                    className={cx(
                      "p-5 transition-all duration-200",
                      isSelectedForEdit && "ring-2 ring-brand border-brand/50 bg-brand-soft/10",
                      r.is_demo && "border-warn/40 bg-warn-soft/20"
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[14px] font-bold text-ink">{r.author_name}</p>
                          {r.is_demo ? (
                            <Badge tone="warn">Sample</Badge>
                          ) : (
                            <Badge tone={r.published ? "success" : "neutral"}>
                              {r.published ? "Live on site" : "Draft"}
                            </Badge>
                          )}
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-ink2">
                          {r.rating != null && (
                            <StarRatingDisplay rating={r.rating} size="sm" showNumber />
                          )}
                          {r.author_context && <span>• {r.author_context}</span>}
                          {r.city && <span>• {r.city}</span>}
                          {r.garages?.public_name && (
                            <span className="font-medium text-brand">• {r.garages.public_name}</span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => (isSelectedForEdit ? cancelEdit() : startEdit(r))}
                          title="Edit this testimonial"
                          className="h-8 px-2 text-xs"
                        >
                          <Edit3 className="mr-1 h-3.5 w-3.5" />
                          {isSelectedForEdit ? "Editing" : "Edit"}
                        </Button>

                        <ActionButton
                          action={setTestimonialPublished}
                          label={r.published ? "Take down" : "Publish"}
                          variant={r.published ? "ghost" : "outline"}
                          size="sm"
                          className="h-8 text-xs"
                          hidden={{ id: r.id, publish: r.published ? "0" : "1" }}
                        />

                        {!r.is_demo && (
                          <ActionButton
                            action={deleteTestimonial}
                            label="Delete"
                            variant="danger"
                            size="sm"
                            className="h-8 text-xs"
                            confirm="Are you sure you want to permanently delete this testimonial?"
                            hidden={{ id: r.id }}
                          />
                        )}
                      </div>
                    </div>

                    <blockquote className="mt-3.5 border-l-2 border-brand/60 pl-3.5 text-[13.5px] leading-relaxed text-ink/90">
                      &ldquo;{r.quote}&rdquo;
                    </blockquote>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-ink3 border-t border-line/60 pt-2.5">
                      <span>Source: {SOURCE_LABELS[r.source] ?? r.source}</span>
                      {r.consent_on && (
                        <span>Consent date: {fmtDate(r.consent_on)}</span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Record / Edit Form + Live Preview */}
        <div className="space-y-6">
          <Panel
            title={editingId ? "Edit testimonial" : "Record a customer testimonial"}
            description={
              editingId
                ? "Updating existing customer review details. Remember to respect customer consent."
                : "Real words said by a car owner, verified with a publication consent date."
            }
            tone="brand"
            action={
              editingId ? (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1 text-xs text-ink3 hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
              ) : undefined
            }
          >
            <div className="p-5">
              <ActionForm
                action={saveTestimonial}
                submitLabel={editingId ? "Update Testimonial" : "Save Testimonial"}
                pendingLabel="Saving…"
                resetOnSuccess={!editingId}
                fullWidth
              >
                {editingId && <input type="hidden" name="id" value={editingId} />}

                <Field label="Author Name" required hint="Real name as agreed (e.g. Rahul Sharma)">
                  <Input
                    name="authorName"
                    required
                    minLength={2}
                    maxLength={80}
                    value={formAuthor}
                    onChange={(e) => setFormAuthor(e.target.value)}
                    placeholder="e.g. Vikram Malhotra"
                  />
                </Field>

                <Field label="Customer Context / Vehicle" hint="e.g. Swift Dzire owner, Sector 45">
                  <Input
                    name="authorContext"
                    maxLength={120}
                    value={formContext}
                    onChange={(e) => setFormContext(e.target.value)}
                    placeholder="e.g. Creta SX owner, DLF Phase 5"
                  />
                </Field>

                <Field label="Star Rating" hint="Click to select star rating (1 to 5)">
                  <StarRatingInput
                    name="rating"
                    value={formRating}
                    onChange={(val) => setFormRating(val)}
                  />
                </Field>

                <Field label="Customer's Quote" required hint="Keep exact words. Do not fabricate praise.">
                  <Textarea
                    name="quote"
                    rows={4}
                    required
                    minLength={20}
                    maxLength={600}
                    value={formQuote}
                    onChange={(e) => setFormQuote(e.target.value)}
                    placeholder="They quoted ₹4,200 for suspension bushes and that was the exact amount on the final bill. No unexpected charges."
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="City" hint="Optional">
                    <Input
                      name="city"
                      maxLength={60}
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                      placeholder="e.g. Gurugram"
                    />
                  </Field>

                  <Field label="Where was it stated?" required>
                    <Select
                      name="source"
                      required
                      value={formSource}
                      onChange={(e) => setFormSource(e.target.value)}
                    >
                      {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <Field label="Associated Garage" hint="Select if quote praises a specific workshop">
                  <Select
                    name="garageId"
                    value={formGarageId}
                    onChange={(e) => setFormGarageId(e.target.value)}
                  >
                    <option value="">Platform-wide / Not garage-specific</option>
                    {garages.map((g) => (
                      <option key={g.id} value={g.id}>{g.public_name}</option>
                    ))}
                  </Select>
                </Field>

                <Field
                  label="Consent Date"
                  required
                  hint="Mandatory. Date customer confirmed consent to public display."
                >
                  <Input
                    name="consentOn"
                    type="date"
                    required
                    max={new Date().toISOString().slice(0, 10)}
                    value={formConsent}
                    onChange={(e) => setFormConsent(e.target.value)}
                  />
                </Field>

                <div className="pt-1">
                  <Check
                    name="published"
                    label="Publish to Public Website immediately"
                    hint="Uncheck to save as draft for quality check."
                    defaultChecked={formPublished}
                  />
                </div>
              </ActionForm>
            </div>
          </Panel>

          {/* Live Card Preview */}
          <div className="rounded-panel border border-line bg-surface2/60 p-5">
            <div className="flex items-center justify-between border-b border-line/80 pb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink2">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Live Public Card Preview
              </span>
              <span className="text-[11px] text-ink3">How this renders on homepage</span>
            </div>

            <div className="mt-4">
              <Card className="flex flex-col p-6 shadow-card bg-surface border-line">
                <div className="flex items-center justify-between gap-3">
                  <StarRatingDisplay rating={formRating ?? 5} size="md" showNumber />
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Verified Car Owner
                  </span>
                </div>

                <blockquote className="mt-3.5 grow text-[14px] leading-relaxed text-ink italic">
                  &ldquo;{formQuote || "Customer feedback quote will appear here as you type in the form..."}&rdquo;
                </blockquote>

                <div className="mt-5 flex items-center gap-3 border-t border-line/70 pt-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand/20 to-brand text-xs font-bold text-brand-fg">
                    {(formAuthor || "C").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink leading-tight">
                      {formAuthor || "Customer Name"}
                    </p>
                    <p className="text-[11.5px] text-ink2 truncate mt-0.5">
                      {[formContext || "Car Owner", formCity || "Gurugram"].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

