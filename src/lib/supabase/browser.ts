"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON, SUPABASE_URL } from "./env";

export const supabaseBrowser = () => createBrowserClient(SUPABASE_URL, SUPABASE_ANON);
