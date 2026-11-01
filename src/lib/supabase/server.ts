import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { SUPABASE_ANON, SUPABASE_URL, hasSupabase } from "./env";
import type { Role } from "@/lib/permissions";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* called from a Server Component */ }
      },
    },
  });
}

export interface SessionUser { id: string; email: string | null; role: Role; fullName: string | null }

/** One auth + profile lookup per request (React cache). Verified server-side with getUser(). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  if (!hasSupabase()) return null;
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: p } = await sb.from("profiles").select("role, full_name").eq("id", user.id).single();
  return { id: user.id, email: user.email ?? null, role: (p?.role as Role) ?? "customer", fullName: p?.full_name ?? null };
});
