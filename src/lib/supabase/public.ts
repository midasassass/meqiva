import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON, SUPABASE_URL } from "./env";

/** Cookie-less anon client for public, cacheable reads (keeps pages static/ISR => cheaper on Vercel + Supabase). */
export const supabasePublic = () => createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });
