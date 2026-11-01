import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

/* ───────────────────────── Buttons ───────────────────────── */

type Variant = "primary" | "accent" | "secondary" | "outline" | "ghost" | "danger" | "soft"
  | "inverse" | "inverse-outline";
type Size = "sm" | "md" | "lg" | "xl";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-brand-fg hover:bg-brand-hover shadow-soft hover:shadow-card",
  accent: "bg-accent text-accent-fg hover:brightness-105 shadow-soft hover:shadow-card",
  secondary: "bg-ink text-bg hover:opacity-90",
  outline: "border border-line-strong bg-surface text-ink hover:border-brand hover:bg-brand-soft/40",
  ghost: "text-ink2 hover:bg-surface2 hover:text-ink",
  danger: "bg-danger text-white hover:brightness-105",
  soft: "bg-brand-soft text-brand hover:brightness-95",
  /*
    For a button sitting on a filled brand band. Overriding `primary` with a background
    utility does not work reliably — both are same-specificity Tailwind utilities, so
    which one wins depends on their order in the generated stylesheet, not on the order
    they appear in the class attribute. These two exist so that never has to be guessed.
  */
  inverse: "bg-white text-ink hover:bg-white/90 shadow-soft hover:shadow-card",
  "inverse-outline": "border border-white/45 text-white hover:border-white hover:bg-white/12",
};
const SIZE: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-sm2",
  md: "h-11 px-5 text-sm gap-2 rounded-card",
  lg: "h-13 px-6 text-[15px] gap-2.5 rounded-card",
  xl: "h-15 px-8 text-base gap-3 rounded-panel",
};
const BTN = "press inline-flex items-center justify-center font-semibold whitespace-nowrap transition-all duration-200 disabled:opacity-45 disabled:pointer-events-none";

export function Button({ variant = "primary", size = "md", className, ...p }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={cx(BTN, VARIANT[variant], SIZE[size], className)} {...p} />;
}
export function ButtonLink({ variant = "primary", size = "md", className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={cx(BTN, VARIANT[variant], SIZE[size], className)} {...p} />;
}

/* ───────────────────────── Surfaces ───────────────────────── */

export function Card({ className, hover, ...p }: ComponentProps<"div"> & { hover?: boolean }) {
  return <div className={cx("rounded-panel border border-line bg-surface shadow-soft", hover && "lift cursor-pointer", className ?? "p-5")} {...p} />;
}

export function Panel({ title, description, action, children, className, tone }: {
  title?: string; description?: string; action?: ReactNode; children: ReactNode; className?: string;
  tone?: "default" | "brand" | "accent";
}) {
  return (
    <section className={cx("overflow-hidden rounded-panel border border-line bg-surface shadow-soft", className)}>
      {(title || action) && (
        <header className={cx("flex items-start justify-between gap-4 border-b border-line px-5 py-4",
          tone === "brand" && "bg-brand-soft/50", tone === "accent" && "bg-accent-soft/50")}>
          <div className="min-w-0">
            {title && <h2 className="display-3">{title}</h2>}
            {description && <p className="mt-1 text-[13px] leading-relaxed text-ink2">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, tone, icon, trend }: {
  label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode;
  tone?: "default" | "brand" | "accent" | "success" | "warn" | "danger";
  trend?: { pct: number; label?: string };
}) {
  const colour = { default: "", brand: "text-brand", accent: "text-accent", success: "text-success", warn: "text-warn", danger: "text-danger" }[tone ?? "default"];
  return (
    <div className="rounded-panel border border-line bg-surface p-4 shadow-soft sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-ink2">{label}</p>
        {icon && <span className="shrink-0 text-ink3">{icon}</span>}
      </div>
      <p className={cx("font-display tnum mt-2 text-[26px] font-semibold leading-none tracking-tight sm:text-[30px]", colour)}>{value}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {trend && (
          <span className={cx("tnum inline-flex items-center gap-0.5 rounded-xs px-1.5 py-0.5 text-[11px] font-semibold",
            trend.pct >= 0 ? "bg-success-soft text-success" : "bg-danger-soft text-danger")}>
            {trend.pct >= 0 ? "↑" : "↓"} {Math.abs(trend.pct).toFixed(0)}%
            {trend.label && <span className="font-normal opacity-80"> {trend.label}</span>}
          </span>
        )}
        {hint && <p className="text-xs text-ink2">{hint}</p>}
      </div>
    </div>
  );
}

/* ───────────────────────── Status ───────────────────────── */

type Tone = "neutral" | "brand" | "accent" | "success" | "warn" | "danger" | "outline";
const TONE: Record<Tone, string> = {
  neutral: "bg-surface2 text-ink2",
  brand: "bg-brand-soft text-brand",
  accent: "bg-accent-soft text-accent",
  success: "bg-success-soft text-success",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  outline: "border border-line text-ink2",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-xs px-2 py-0.5 text-[11.5px] font-semibold", TONE[tone], className)}>{children}</span>;
}

export function Dot({ tone = "neutral", pulse, children }: { tone?: Tone; pulse?: boolean; children: ReactNode }) {
  const bg = { neutral: "bg-ink3", brand: "bg-brand", accent: "bg-accent", success: "bg-success", warn: "bg-warn", danger: "bg-danger", outline: "bg-ink3" }[tone];
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px]">
      <span className={cx("h-2 w-2 shrink-0 rounded-full", bg, pulse && "pulse-ring")} aria-hidden />
      {children}
    </span>
  );
}

export function Callout({ tone = "neutral", title, children, icon }: { tone?: Tone; title?: string; children?: ReactNode; icon?: ReactNode }) {
  const skin = {
    neutral: "border-line bg-surface", brand: "border-brand/30 bg-brand-soft/50", accent: "border-accent/30 bg-accent-soft/60",
    success: "border-success/30 bg-success-soft/60", warn: "border-warn/35 bg-warn-soft/60",
    danger: "border-danger/30 bg-danger-soft/60", outline: "border-line bg-surface",
  }[tone];
  return (
    <div className={cx("mt-4 flex gap-3 rounded-panel border px-4 py-3.5", skin)}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        {title && <p className="text-sm font-semibold">{title}</p>}
        {children && <div className={cx("text-[13px] leading-relaxed text-ink2", title && "mt-1")}>{children}</div>}
      </div>
    </div>
  );
}

/* ───────────────────────── Page furniture ───────────────────────── */

export function PageTitle({ title, sub, right, back }: {
  title: string; sub?: string; right?: ReactNode; back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2.5 inline-flex items-center gap-1 text-[13px] font-medium text-ink2 transition-colors hover:text-brand">
          <span aria-hidden>←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="display-2">{title}</h1>
          {sub && <p className="mt-2 max-w-prose text-[14.5px] leading-relaxed text-ink2">{sub}</p>}
        </div>
        {right && <div className="flex shrink-0 flex-wrap gap-2">{right}</div>}
      </div>
    </div>
  );
}

export function Empty({ title, body, action, icon }: { title: string; body?: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-panel border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
      {icon && <div className="mb-4 grid h-12 w-12 place-items-center rounded-panel bg-brand-soft text-brand">{icon}</div>}
      <p className="font-display text-[17px] font-semibold">{title}</p>
      {body && <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink2">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Section({ title, description, action, children, className }: {
  title?: string; description?: string; action?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={cx("mt-9 first:mt-0", className)}>
      {(title || action) && (
        <div className="mb-3.5 flex items-end justify-between gap-3">
          <div>
            {title && <h2 className="display-3">{title}</h2>}
            {description && <p className="mt-1 text-[13px] text-ink2">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/* ───────────────────────── Forms ───────────────────────── */

export const inputCls =
  "h-12 w-full rounded-card border border-line-strong bg-surface px-3.5 text-[15px] text-ink outline-none transition-all duration-200 placeholder:text-ink3 hover:border-ink3 focus:border-brand focus:ring-4 focus:ring-brand/12 disabled:bg-surface2 sm:text-sm";

export function Field({ label, hint, error, required, children, className }: {
  label?: string; hint?: string; error?: string; required?: boolean; children: ReactNode; className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      {label && (
        <span className="mb-1.5 flex items-baseline gap-1 text-[13px] font-semibold text-ink">
          {label}{required && <span className="text-danger" aria-hidden>*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs leading-relaxed text-ink2">{hint}</span>}
      {error && <span role="alert" className="slide-in mt-1.5 block text-xs font-medium text-danger">{error}</span>}
    </label>
  );
}

export const Input = (p: ComponentProps<"input">) => <input {...p} className={cx(inputCls, p.className)} />;
export const Textarea = (p: ComponentProps<"textarea">) => <textarea {...p} className={cx(inputCls, "h-auto min-h-24 py-3 leading-relaxed", p.className)} />;
export const Select = (p: ComponentProps<"select">) => <select {...p} className={cx(inputCls, "cursor-pointer pr-9", p.className)} />;

/** Money field with a rupee sign built in, so a garage never types the symbol. */
export function Money({ className, ...p }: ComponentProps<"input">) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-ink3" aria-hidden>₹</span>
      <input type="number" inputMode="decimal" step="1" min={0} {...p} className={cx(inputCls, "tnum pl-8", className)} />
    </div>
  );
}

export function Check({ label, hint, ...p }: ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-card py-1.5 transition-colors">
      <input type="checkbox" {...p} className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[var(--brand)]" />
      <span className="text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-relaxed text-ink2">{hint}</span>}
      </span>
    </label>
  );
}

export function Switch({ label, hint, ...p }: ComponentProps<"input"> & { label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span className="min-w-0 text-sm">
        <span className="font-medium">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-relaxed text-ink2">{hint}</span>}
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input type="checkbox" {...p} className="peer sr-only" />
        <span className="block h-6 w-11 rounded-full bg-line-strong transition-colors duration-200 peer-checked:bg-brand peer-focus-visible:ring-4 peer-focus-visible:ring-brand/25" />
        <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-soft transition-transform duration-200 peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function RadioCards({ name, options, defaultValue, columns = 1 }: {
  name: string; defaultValue?: string; columns?: 1 | 2 | 3;
  options: { value: string; label: string; hint?: string; icon?: ReactNode }[];
}) {
  return (
    <div className={cx("grid gap-2.5", columns === 2 && "sm:grid-cols-2", columns === 3 && "sm:grid-cols-3")}>
      {options.map((o) => (
        <label key={o.value}
          className="press flex cursor-pointer items-start gap-3 rounded-card border-2 border-line bg-surface p-3.5 transition-all duration-200 hover:border-line-strong has-checked:border-brand has-checked:bg-brand-soft/50 has-checked:shadow-soft">
          <input type="radio" name={name} value={o.value} defaultChecked={defaultValue === o.value}
            className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[var(--brand)]" />
          <span className="min-w-0 text-sm">
            <span className="flex items-center gap-2 font-semibold">{o.icon}{o.label}</span>
            {o.hint && <span className="mt-1 block text-xs leading-relaxed text-ink2">{o.hint}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

/* ───────────────────────── Tables ───────────────────────── */

export function Table({ head, children, caption }: { head: ReactNode[]; children: ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-line bg-surface2/60">
            {head.map((h, i) => (
              <th key={i} scope="col" className={cx("px-4 py-3 text-[11.5px] font-semibold uppercase tracking-wide text-ink2", i === 0 ? "text-left" : "text-left last:text-right")}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}
export const Td = ({ className, ...p }: ComponentProps<"td">) => <td className={cx("px-4 py-3.5 align-middle", className)} {...p} />;
export const Tr = ({ className, ...p }: ComponentProps<"tr">) => <tr className={cx("transition-colors hover:bg-surface2/50", className)} {...p} />;

export function DataList({ rows, cols = 2 }: { rows: [string, ReactNode][]; cols?: 1 | 2 }) {
  return (
    <dl className={cx("grid gap-x-6 gap-y-3.5", cols === 2 && "sm:grid-cols-2")}>
      {rows.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-[11.5px] font-medium uppercase tracking-wide text-ink3">{k}</dt>
          <dd className="mt-1 text-sm font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ───────────────────────── Navigation ───────────────────────── */

export function SegmentedLinks({ items, current }: { items: { href: string; label: string; count?: number }[]; current: string }) {
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {items.map((i) => {
        const active = i.href === current;
        return (
          <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
            className={cx("press shrink-0 rounded-card px-3.5 py-2 text-[13px] font-semibold transition-all duration-200",
              active ? "bg-brand text-brand-fg shadow-soft" : "text-ink2 hover:bg-surface2 hover:text-ink")}>
            {i.label}
            {i.count != null && <span className={cx("tnum ml-1.5 rounded-xs px-1.5 py-px text-[11px]", active ? "bg-white/20" : "bg-surface2 text-ink2")}>{i.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/** Numbered progress through a flow that genuinely has an order. */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-1.5 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const done = i < current, now = i === current;
        return (
          <li key={s} className="flex shrink-0 items-center gap-1.5">
            <span className={cx("flex items-center gap-2 rounded-card px-2.5 py-1.5 text-[12.5px] font-semibold transition-all duration-300",
              now ? "bg-brand text-brand-fg shadow-soft" : done ? "bg-success-soft text-success" : "bg-surface2 text-ink3")}>
              <span className={cx("tnum grid h-5 w-5 place-items-center rounded-full text-[11px]",
                now ? "bg-white/25" : done ? "bg-success text-white" : "bg-line-strong text-surface")}>
                {done ? "✓" : i + 1}
              </span>
              <span className={cx(!now && "hidden sm:inline")}>{s}</span>
            </span>
            {i < steps.length - 1 && <span className={cx("h-px w-4 shrink-0", done ? "bg-success" : "bg-line")} aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

/* ───────────────────────── Timeline ───────────────────────── */

export interface TimelineEntry { title: string; at?: string; detail?: ReactNode; tone?: Tone; done?: boolean; now?: boolean }

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="relative">
      {entries.map((e, i) => {
        const last = i === entries.length - 1;
        const ring = e.tone === "accent" || e.now ? "bg-accent" : e.tone === "danger" ? "bg-danger" : e.done ? "bg-success" : "bg-line-strong";
        return (
          <li key={i} className="relative flex gap-3.5 pb-5 last:pb-0">
            {!last && <span className={cx("absolute left-[6px] top-4 h-full w-0.5 rounded", e.done ? "bg-success/30" : "bg-line")} aria-hidden />}
            <span className={cx("relative mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-surface", ring, e.now && "pulse-ring")} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className={cx("text-sm", e.done || e.now ? "font-semibold" : "font-medium text-ink2")}>{e.title}</p>
              {e.at && <p className="tnum mt-0.5 text-xs text-ink3">{e.at}</p>}
              {e.detail && <div className="mt-1.5 text-[13px] leading-relaxed text-ink2">{e.detail}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ───────────────────────── Misc ───────────────────────── */

export function Progress({ value, label, tone = "brand" }: { value: number; label?: string; tone?: "brand" | "success" | "warn" | "danger" }) {
  const v = Math.max(0, Math.min(100, value));
  const bar = { brand: "bg-brand", success: "bg-success", warn: "bg-warn", danger: "bg-danger" }[tone];
  return (
    <div>
      {label && <div className="mb-1.5 flex justify-between text-xs font-medium text-ink2"><span>{label}</span><span className="tnum">{Math.round(v)}%</span></div>}
      <div className="h-2 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100} aria-label={label ?? "Progress"}>
        <div className={cx("h-full rounded-full transition-[width] duration-700 ease-out", bar)} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string | null | undefined; size?: number }) {
  const txt = (name ?? "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
  return (
    <span aria-hidden className="inline-grid shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand"
      style={{ width: size, height: size, fontSize: size * 0.36 }}>{txt}</span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton", className ?? "h-4 w-full")} />;
}

export function Logo({ tone = "ink", size = 24 }: { tone?: "ink" | "light"; size?: number }) {
  return (
    <span className={cx("font-display inline-flex items-center gap-2 font-bold tracking-[-0.03em]", tone === "light" ? "text-white" : "text-ink")}
      style={{ fontSize: size * 0.78 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
        <defs>
          <linearGradient id="mq" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--primary-2)" />
          </linearGradient>
        </defs>
        <rect width="24" height="24" rx="7" fill="url(#mq)" />
        <path d="M5.4 17.2V6.8h2.5l4.1 6 4.1-6h2.5v10.4h-2.6v-6.1l-4 5.7-4-5.7v6.1H5.4Z" fill="#fff" />
      </svg>
      MEQIVA
    </span>
  );
}

export function SetupNotice() {
  return (
    <Callout tone="warn" title="Connect Supabase to continue">
      Copy <code className="rounded-xs bg-surface2 px-1 font-mono text-[12px]">.env.example</code> to{" "}
      <code className="rounded-xs bg-surface2 px-1 font-mono text-[12px]">.env.local</code>, add your project URL and anon key,
      then run the files in <code className="rounded-xs bg-surface2 px-1 font-mono text-[12px]">supabase/migrations</code> in order.
    </Callout>
  );
}
