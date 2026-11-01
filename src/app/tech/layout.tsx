import { CheckCircle2, Wrench } from "lucide-react";
import { Shell } from "@/components/shell";
import { requireUser } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import { getSettings } from "@/lib/garage-data";

export default async function TechLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const sb = await supabaseServer();
  const { data: m } = await sb.from("garage_members").select("garage_id, garages(public_name)").eq("user_id", u.id).limit(1).maybeSingle();
  const row = m as unknown as { garage_id: string; garages: { public_name: string } | null } | null;
  const settings = row ? await getSettings(sb, row.garage_id) : null;

  const i = "h-[18px] w-[18px]";
  const items = [
    { href: "/tech", label: "My jobs", icon: <Wrench className={i} aria-hidden />, exact: true },
    { href: "/tech/done", label: "Finished", icon: <CheckCircle2 className={i} aria-hidden /> },
  ];

  return (
    <Shell
      workspace={row?.garages?.public_name ?? "My jobs"}
      subtitle={u.fullName ?? undefined}
      user={{ email: u.email, name: u.fullName }}
      accentHex={settings?.accent_hex}
      groups={[{ items }]}
      bottom={items}
    >
      {children}
    </Shell>
  );
}
