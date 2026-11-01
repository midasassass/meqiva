"use client";
import { ActionForm } from "@/components/action-form";
import { Field, Select, Textarea } from "@/components/ui";
import { submitReview } from "@/server/customer";

const SCORES = [5, 4, 3, 2, 1];
const ASPECTS = [
  ["quality", "Quality of work"],
  ["priceTransparency", "Price matched the estimate"],
  ["timeliness", "Ready when promised"],
  ["communication", "Kept you informed"],
] as const;

export function ReviewForm({ bookingId, garageId }: { bookingId: string; garageId: string }) {
  return (
    <ActionForm action={submitReview} submitLabel="Publish review" pendingLabel="Publishing…">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="garageId" value={garageId} />
      <Field label="Overall" required>
        <Select name="rating" required defaultValue="">
          <option value="" disabled>Choose a rating</option>
          {SCORES.map((s) => <option key={s} value={s}>{s} out of 5</option>)}
        </Select>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        {ASPECTS.map(([name, label]) => (
          <Field key={name} label={label}>
            <Select name={name} defaultValue="">
              <option value="">Not rated</option>
              {SCORES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
        ))}
      </div>
      <Field label="Anything worth saying?" hint="Other owners read this. Keep it about the work.">
        <Textarea name="remarks" rows={3} maxLength={2000} />
      </Field>
    </ActionForm>
  );
}
