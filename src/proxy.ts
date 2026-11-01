import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROUTE_ROLES, homeFor, type Role } from "@/lib/permissions";
import { SUPABASE_ANON, SUPABASE_URL, hasSupabase } from "@/lib/supabase/env";

/**
 * Edge gate: refreshes the session and keeps people out of workspaces that are not
 * theirs. This is the first line of defence and a redirect for the right reason —
 * the real enforcement is Supabase row-level security on every single query.
 */
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Layouts cannot read the pathname, so pass it down for sub-navigation highlighting.
  const withPath = () => {
    const h = new Headers(req.headers);
    h.set("x-pathname", path + (req.nextUrl.search || ""));
    return h;
  };

  const prefix = Object.keys(ROUTE_ROLES).find((p) => path === p || path.startsWith(p + "/"));
  if (!prefix || !hasSupabase()) return NextResponse.next({ request: { headers: withPath() } });

  let res = NextResponse.next({ request: { headers: withPath() } });
  const sb = createServerClient(SUPABASE_URL, SUPABASE_ANON, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: { headers: withPath() } });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  const { data: p } = await sb.from("profiles").select("role").eq("id", user.id).single();
  const role = (p?.role ?? "customer") as Role;
  if (!ROUTE_ROLES[prefix]!.includes(role)) {
    const url = req.nextUrl.clone();
    url.pathname = homeFor(role);
    url.search = "";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)"],
};
