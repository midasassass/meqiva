"use client";
import { useState } from "react";
import { Star, X } from "lucide-react";
import { cx } from "./ui";

const LABELS: Record<number, string> = {
  1: "1 Star — Poor experience",
  2: "2 Stars — Below expectations",
  3: "3 Stars — Satisfactory / Average",
  4: "4 Stars — Great service",
  5: "5 Stars — Outstanding / Highly recommended",
};

interface StarRatingInputProps {
  name?: string;
  value?: number | null;
  onChange?: (val: number | null) => void;
  required?: boolean;
  className?: string;
}

export function StarRatingInput({
  name = "rating",
  value: initialValue = null,
  onChange,
  className,
}: StarRatingInputProps) {
  const [rating, setRating] = useState<number | null>(initialValue);
  const [hovered, setHovered] = useState<number | null>(null);

  const activeRating = hovered ?? rating ?? 0;

  const handleSelect = (r: number) => {
    const next = rating === r ? null : r;
    setRating(next);
    onChange?.(next);
  };

  const handleClear = () => {
    setRating(null);
    setHovered(null);
    onChange?.(null);
  };

  return (
    <div className={cx("space-y-2", className)}>
      <input type="hidden" name={name} value={rating ?? ""} />
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= activeRating;
          return (
            <button
              key={star}
              type="button"
              onClick={() => handleSelect(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(null)}
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
              className={cx(
                "group relative p-1 transition-transform duration-150 hover:scale-125 focus:outline-none",
                isFilled ? "text-amber-500" : "text-ink3/40 hover:text-amber-400/60"
              )}
            >
              <Star
                className={cx(
                  "h-6 w-6 transition-colors duration-150",
                  isFilled ? "fill-amber-400 text-amber-500 drop-shadow-[0_1px_4px_rgba(245,158,11,0.35)]" : "fill-transparent"
                )}
              />
            </button>
          );
        })}

        {rating != null && (
          <button
            type="button"
            onClick={handleClear}
            className="ml-2 inline-flex items-center gap-1 rounded-sm2 px-2 py-0.5 text-xs text-ink3 hover:bg-surface2 hover:text-ink2"
            title="Clear rating"
          >
            <X className="h-3 w-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      <div className="text-[12px] font-medium text-ink2">
        {activeRating > 0 ? (
          <span className="text-amber-600 dark:text-amber-400 font-semibold">{LABELS[activeRating]}</span>
        ) : (
          <span className="text-ink3">Select 1 to 5 stars (optional)</span>
        )}
      </div>
    </div>
  );
}

export function StarRatingDisplay({
  rating,
  max = 5,
  size = "md",
  showNumber = false,
  className,
}: {
  rating: number | null | undefined;
  max?: number;
  size?: "sm" | "md" | "lg";
  showNumber?: boolean;
  className?: string;
}) {
  if (rating == null || rating <= 0) return null;

  const starSizes = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const textSizes = {
    sm: "text-[11.5px]",
    md: "text-[13px]",
    lg: "text-[15px]",
  };

  return (
    <div className={cx("inline-flex items-center gap-1", className)}>
      <div className="flex items-center gap-0.5" aria-label={`${rating} out of ${max} stars`}>
        {Array.from({ length: max }).map((_, i) => {
          const isFilled = i < rating;
          return (
            <Star
              key={i}
              className={cx(
                starSizes[size],
                isFilled
                  ? "fill-amber-400 text-amber-500 drop-shadow-[0_1px_3px_rgba(245,158,11,0.25)]"
                  : "fill-transparent text-ink3/30"
              )}
              aria-hidden
            />
          );
        })}
      </div>
      {showNumber && (
        <span className={cx("tnum font-semibold text-ink ml-1", textSizes[size])}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  );
}

