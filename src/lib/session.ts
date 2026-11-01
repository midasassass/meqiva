import { redirect } from "next/navigation";
import { getSessionUser, supabaseServer } from "@/lib/supabase/server";
import type { Role } from "./permissions";

export async function requireUser() {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireRole(...roles: Role[]) {
  const u = await requireUser();
  if (!roles.includes(u.role)) redirect("/app");
  return u;
}

export interface GarageContext {
  id: string;
  name: string;
  slug: string;
  status: string;
  verification: string;
  baysCount: number;
  /** The caller's role inside this garage. */
  memberRole: "garage_owner" | "service_advisor" | "technician";
  isOwner: boolean;
  isManager: boolean;
}

/**
 * Resolves which garage the signed-in staff member works in. RLS already restricts
 * every query to their own garage; this just saves looking it up on every page.
 */
export async function requireGarage() {
  const user = await requireUser();
  const sb = await supabaseServer();
  const { data } = await sb
    .from("garage_members")
    .select("garage_id, role, garages(id, public_name, slug, status, verification, bays_count)")
    .eq("user_id", user.id)
    .order("role")
    .limit(1)
    .maybeSingle();

  const row = data as unknown as {
    garage_id: string;
    role: GarageContext["memberRole"];
    garages: { id: string; public_name: string; slug: string; status: string; verification: string; bays_count: number } | null;
  } | null;

  const garage: GarageContext | null = row?.garages
    ? {
        id: row.garage_id,
        name: row.garages.public_name,
        slug: row.garages.slug,
        status: row.garages.status,
        verification: row.garages.verification,
        baysCount: row.garages.bays_count ?? 1,
        memberRole: row.role,
        isOwner: row.role === "garage_owner",
        isManager: row.role === "garage_owner" || row.role === "service_advisor",
      }
    : null;

  return { user, sb, garage, garageId: garage?.id ?? null };
}

/** For pages that cannot render at all without a garage. */
export async function requireGarageOrRedirect() {
  const ctx = await requireGarage();
  if (!ctx.garage) redirect("/garage");
  return { ...ctx, garage: ctx.garage, garageId: ctx.garage.id };
}
