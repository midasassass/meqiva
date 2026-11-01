"use client";
import { useState } from "react";
import { ACCENT_PRESETS, contrastRatio, resolveTheme } from "@/lib/theme";
import { cx } from "./ui";

/** Shows the chosen accent on a real button, and refuses to leave a garage with unreadable contrast. */
export function AccentPicker({ name, defaultValue }: { name: string; defaultValue?: string | null }) {
  const [hex, setHex] = useState((defaultValue ?? "#0E5157").toLowerCase());
  const theme = resolveTheme(hex);
  const ratio = contrastRatio(theme.accent, theme.accentFg);

  return (
    <div>
      <input type="hidden" name={name} value={hex} />
      <div className="flex flex-wrap gap-2">
        {ACCENT_PRESETS.map((p) => (
          <button key={p.hex} type="button" onClick={() => setHex(p.hex.toLowerCase())}
            aria-label={p.name} aria-pressed={hex === p.hex.toLowerCase()} title={p.name}
            className={cx("h-9 w-9 rounded-card border-2 transition-transform",
              hex === p.hex.toLowerCase() ? "border-ink scale-105" : "border-transparent hover:scale-105")}
            style={{ background: p.hex }} />
        ))}
        <label className="flex items-center gap-2 rounded-card border border-line-strong px-2.5">
          <span className="text-[12px] text-ink2">Custom</span>
          <input type="color" value={hex} onChange={(e) => setHex(e.target.value.toLowerCase())}
            aria-label="Custom accent colour" className="h-7 w-8 cursor-pointer border-0 bg-transparent p-0" />
        </label>
      </div>

      <div className="mt-4 rounded-card border border-line bg-surface2 p-4"
        style={{ "--accent": theme.accent, "--accent-fg": theme.accentFg, "--accent-hover": theme.accentHover } as React.CSSProperties}>
        <p className="text-[12px] text-ink2">How it will look</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex h-10 items-center rounded-card bg-brand px-4 text-sm font-medium text-brand-fg">Book a slot</span>
          <span className="tnum text-[13px] text-ink2">{hex}</span>
        </div>
        <p className="mt-2 text-[12px] text-ink2">
          Text contrast {ratio.toFixed(1)}:1 — MEQIVA picks the readable text colour for you, so this never drops below
          the accessible minimum.
        </p>
      </div>
    </div>
  );
}
