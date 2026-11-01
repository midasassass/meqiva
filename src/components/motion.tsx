"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "./ui";

/**
 * Motion primitives. Everything here is small and hand-rolled rather than a library,
 * because a workshop phone on a patchy connection should not download an animation
 * engine to watch a number change.
 */

/** Counts to a value when it first appears. Respects reduced-motion by jumping to the end. */
export function CountUp({
  value, format, durationMs = 850, className,
}: { value: number; format?: (n: number) => string; durationMs?: number; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;
    const delta = value - start;
    if (reduce || delta === 0) { from.current = value; setShown(value); return; }

    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(start + delta * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value, durationMs]);

  return <span className={cx("tnum", className)}>{format ? format(shown) : Math.round(shown).toLocaleString("en-IN")}</span>;
}

/** Fades and lifts children in when they scroll into view. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) { setSeen(true); return; }
    const io = new IntersectionObserver(
      ([e]) => { if (e?.isIntersecting) { setSeen(true); io.disconnect(); } },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={cx(seen && "rise", className)}
      style={{ animationDelay: `${delay}ms`, opacity: seen ? undefined : 0 }}>
      {children}
    </div>
  );
}

/** A number that flashes when it changes, so a live total is visibly live. */
export function LiveValue({ children, watch, className }: { children: ReactNode; watch: unknown; className?: string }) {
  const [key, setKey] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setKey((k) => k + 1);
  }, [watch]);
  return <span key={key} className={cx(key > 0 && "pop", className)}>{children}</span>;
}

/** Toast that announces the result of an action, then retires itself. */
export function Toast({ message, tone = "success", onDone }: {
  message: string; tone?: "success" | "danger" | "brand"; onDone?: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(() => onDone?.(), 4000);
    return () => clearTimeout(t);
  }, [onDone]);
  const bg = tone === "danger" ? "bg-danger text-white" : tone === "brand" ? "bg-brand text-brand-fg" : "bg-success text-white";
  return (
    <div role="status" aria-live="polite"
      className={cx("pop fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-panel px-4 py-2.5 text-sm font-medium shadow-float md:bottom-8", bg)}>
      {message}
    </div>
  );
}
