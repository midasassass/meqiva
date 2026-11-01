"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { homeFor, type Role } from "@/lib/permissions";

export interface AuthState { error?: string; info?: string; field?: "email" | "password" | "name" | "phone" }

/** Only ever follow a path inside this app. */
const safeNext = (v: unknown) => {
  const s = String(v ?? "");
  return s.startsWith("/") && !s.startsWith("//") ? s : null;
};

const email = z.string().trim().toLowerCase().email("That does not look like an email address");
const password = z.string()
  .min(8, "Use at least 8 characters")
  .max(72, "That password is too long")
  .refine((v) => /[a-zA-Z]/.test(v) && /[0-9]/.test(v), "Include at least one letter and one number");

export async function signIn(_: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = z.object({ email, password: z.string().min(1, "Enter your password") })
    .safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: i?.message, field: i?.path[0] as AuthState["field"] };
  }

  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword(parsed.data);
  if (error) {
    // Deliberately the same message either way, so this cannot be used to discover
    // which email addresses have accounts.
    return error.message.toLowerCase().includes("confirm")
      ? { error: "Confirm your email address first. Check your inbox for the link." }
      : { error: "That email and password do not match an account.", field: "password" };
  }

  const { data: { user } } = await sb.auth.getUser();
  const { data: p } = await sb.from("profiles").select("role").eq("id", user!.id).single();
  redirect(safeNext(fd.get("next")) ?? homeFor((p?.role ?? "customer") as Role));
}

export async function signUp(_: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = z.object({
    name: z.string().trim().min(2, "Enter your name").max(80),
    email,
    password,
    phone: z.string().trim().regex(/^$|^[0-9+\-\s]{7,15}$/, "Enter a valid phone number").optional(),
  }).safeParse({
    name: fd.get("name"), email: fd.get("email"),
    password: fd.get("password"), phone: fd.get("phone") ?? "",
  });
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: i?.message, field: i?.path[0] as AuthState["field"] };
  }

  // Where to land afterwards. A garage goes straight into setting itself up.
  const intent = String(fd.get("intent") ?? "customer");
  const next = safeNext(fd.get("next")) ?? (intent === "garage" ? "/onboarding" : "/app");

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.name, phone: parsed.data.phone || null } },
  });

  if (error) {
    const m = error.message.toLowerCase();
    if (m.includes("already") || m.includes("registered")) {
      return { error: "An account with this email already exists. Sign in instead.", field: "email" };
    }
    if (m.includes("password")) return { error: error.message, field: "password" };
    return { error: "Could not create the account. Try again in a moment." };
  }

  if (!data.session) {
    return { info: `Almost there. We sent a confirmation link to ${parsed.data.email} — open it, then sign in.` };
  }

  redirect(next);
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/");
}

export async function requestPasswordReset(_: AuthState, fd: FormData): Promise<AuthState> {
  const parsed = email.safeParse(fd.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, field: "email" };

  const sb = await supabaseServer();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await sb.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${origin}/login` });

  // Always the same answer, whether or not that address has an account.
  return { info: "If that address has an account, a reset link is on its way. It expires in an hour." };
}
