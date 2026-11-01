"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button, Callout, Field, Input, cx } from "./ui";
import { requestPasswordReset, signIn, signUp, type AuthState } from "@/app/actions";

/* Scored on what actually resists guessing: length first, variety second. */
function strength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  if (!pw) return { score: 0, label: "" };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/[0-9]/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) s++;
  const label = ["", "Weak", "Fair", "Good", "Strong"][s] ?? "";
  return { score: Math.min(s, 4) as 0 | 1 | 2 | 3 | 4, label };
}

const BAR = ["bg-line", "bg-danger", "bg-warn", "bg-brand", "bg-success"];

function PasswordField({ error }: { error?: string }) {
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const s = strength(pw);
  const rules = [
    { ok: pw.length >= 8, text: "At least 8 characters" },
    { ok: /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw), text: "A letter and a number" },
  ];

  return (
    <Field label="Password" required error={error}>
      <div className="relative">
        <Input
          name="password" type={show ? "text" : "password"} required minLength={8}
          autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)}
          className="pr-11" aria-describedby="pw-rules"
        />
        <button type="button" onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className="press absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-sm2 text-ink2 hover:bg-surface2 hover:text-ink">
          {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
        </button>
      </div>

      {pw && (
        <div className="mt-2">
          <div className="flex gap-1" aria-hidden>
            {[1, 2, 3, 4].map((i) => (
              <span key={i} className={cx("h-1 flex-1 rounded-full transition-colors duration-300",
                i <= s.score ? BAR[s.score] : "bg-line")} />
            ))}
          </div>
          <p className="mt-1.5 text-[12px] text-ink2" role="status">{s.label} password</p>
        </div>
      )}

      <ul id="pw-rules" className="mt-2 space-y-1">
        {rules.map((r) => (
          <li key={r.text} className={cx("flex items-center gap-1.5 text-[12px] transition-colors",
            r.ok ? "text-success" : "text-ink2")}>
            <Check className={cx("h-3.5 w-3.5 shrink-0 transition-opacity", r.ok ? "opacity-100" : "opacity-30")} aria-hidden />
            {r.text}
          </li>
        ))}
      </ul>
    </Field>
  );
}

export function SignInForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, {});
  const [reset, setReset] = useState(false);

  if (reset) return <ResetForm onBack={() => setReset(false)} />;

  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field label="Email" required error={state.field === "email" ? state.error : undefined}>
        <Input name="email" type="email" inputMode="email" autoComplete="email" required autoFocus placeholder="you@example.com" />
      </Field>
      <Field label="Password" required error={state.field === "password" ? state.error : undefined}>
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>

      {state.error && !state.field && <p role="alert" className="text-sm text-danger">{state.error}</p>}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? "Signing in…" : "Sign in"}
      </Button>

      <button type="button" onClick={() => setReset(true)}
        className="w-full text-center text-[13px] text-ink2 underline-offset-2 hover:text-ink hover:underline">
        Forgotten your password?
      </button>
    </form>
  );
}

function ResetForm({ onBack }: { onBack: () => void }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {});
  return (
    <form action={action} className="space-y-4">
      <p className="text-[13.5px] text-ink2">
        Enter the email you signed up with and we will send a link to set a new password.
      </p>
      <Field label="Email" required error={state.field === "email" ? state.error : undefined}>
        <Input name="email" type="email" inputMode="email" autoComplete="email" required autoFocus />
      </Field>
      {state.info && <Callout tone="success">{state.info}</Callout>}
      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Sending…" : "Send the link"}
      </Button>
      <button type="button" onClick={onBack} className="w-full text-center text-[13px] text-ink2 hover:text-ink hover:underline">
        Back to sign in
      </button>
    </form>
  );
}

export function SignUpForm({ intent, next }: { intent: "customer" | "garage"; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {});

  if (state.info) {
    return (
      <div className="pop space-y-4 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success-soft text-success">
          <Check className="h-7 w-7" aria-hidden />
        </span>
        <h2 className="display-3">Check your email</h2>
        <p className="text-[14px] leading-relaxed text-ink2">{state.info}</p>
        <Link href="/login" className="inline-block text-[13.5px] font-semibold text-brand hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="intent" value={intent} />
      {next && <input type="hidden" name="next" value={next} />}

      <Field label={intent === "garage" ? "Your name" : "Full name"} required
        error={state.field === "name" ? state.error : undefined}>
        <Input name="name" autoComplete="name" required autoFocus minLength={2}
          placeholder={intent === "garage" ? "The person who runs the workshop" : "As it should appear on invoices"} />
      </Field>

      <Field label="Email" required error={state.field === "email" ? state.error : undefined}>
        <Input name="email" type="email" inputMode="email" autoComplete="email" required placeholder="you@example.com" />
      </Field>

      <Field label="Phone" hint="Optional, but a garage can reach you faster on it."
        error={state.field === "phone" ? state.error : undefined}>
        <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98765 43210" />
      </Field>

      <PasswordField error={state.field === "password" ? state.error : undefined} />

      {state.error && !state.field && <p role="alert" className="text-sm text-danger">{state.error}</p>}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? "Creating your account…" : intent === "garage" ? "Create account and set up the garage" : "Create account"}
      </Button>

      <p className="text-center text-[12px] leading-relaxed text-ink2">
        By continuing you agree to the <Link href="/legal/terms" className="underline">terms</Link> and the{" "}
        <Link href="/legal/privacy" className="underline">privacy notice</Link>.
      </p>
    </form>
  );
}
