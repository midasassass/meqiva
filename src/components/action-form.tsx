"use client";
import { useActionState, type ReactNode } from "react";
import { Button, cx } from "./ui";
import type { ActionState } from "@/server/booking";

/**
 * One form wrapper for every server action in the product, so success and failure
 * always look and behave the same way. Messages speak in the interface's voice and
 * say what to do next rather than apologising.
 */
export function ActionForm({
  action, children, submitLabel, pendingLabel, variant = "primary", size = "md",
  className, footer, fullWidth, resetOnSuccess,
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "accent" | "secondary" | "outline" | "ghost" | "danger" | "soft";
  size?: "sm" | "md" | "lg";
  className?: string;
  footer?: ReactNode;
  fullWidth?: boolean;
  resetOnSuccess?: boolean;
}) {
  const [state, dispatch, pending] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={dispatch} className={cx("space-y-4", className)} key={resetOnSuccess && state.ok ? "reset" : "form"}>
      {children}
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.ok && state.message && <p role="status" className="text-sm text-success">{state.message}</p>}
      <div className={cx("flex flex-wrap items-center gap-3", fullWidth && "block")}>
        <Button type="submit" variant={variant} size={size} disabled={pending} className={cx(fullWidth && "w-full")}>
          {pending ? (pendingLabel ?? "Working…") : submitLabel}
        </Button>
        {footer}
      </div>
    </form>
  );
}

/** A single-button form, for one-click actions inside a list. */
export function ActionButton({
  action, label, pendingLabel, hidden, variant = "outline", size = "sm", className, confirm,
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  label: string;
  pendingLabel?: string;
  hidden?: Record<string, string>;
  variant?: "primary" | "accent" | "secondary" | "outline" | "ghost" | "danger" | "soft";
  size?: "sm" | "md" | "lg";
  className?: string;
  confirm?: string;
}) {
  const [state, dispatch, pending] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={dispatch} className={className}
      onSubmit={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}>
      {Object.entries(hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Button type="submit" variant={variant} size={size} disabled={pending}>
        {pending ? (pendingLabel ?? "Working…") : label}
      </Button>
      {state.error && <p role="alert" className="mt-1 text-xs text-danger">{state.error}</p>}
    </form>
  );
}
