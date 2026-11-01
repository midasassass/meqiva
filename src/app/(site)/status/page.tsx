import { Badge, Panel } from "@/components/ui";
import { cameraMode, paymentMode } from "@/lib/payments";
import { hasSupabase } from "@/lib/supabase/env";

export const metadata = {
  title: "System status",
  description: "Which MEQIVA integrations are live, which are in sandbox and which are not configured.",
};

const TONE = { live: "success", sandbox: "warn", unavailable: "neutral" } as const;
const MEANS = {
  live: "Connected to a real provider.",
  sandbox: "Test mode. No real money moves and no real messages are sent.",
  unavailable: "Not configured. The feature is hidden or shown as unavailable rather than simulated.",
};

export default function Status() {
  const env = process.env as Record<string, string | undefined>;
  const rows = [
    { name: "Database and sign-in", detail: "Supabase Postgres with row-level security", mode: hasSupabase() ? "live" : "unavailable" },
    { name: "Payments", detail: "Customer payments, refunds and settlement records", mode: paymentMode(env) },
    { name: "Live service camera", detail: "Permission-scoped video during your own service session", mode: cameraMode(env) },
    { name: "WhatsApp and SMS", detail: "Booking and approval notifications", mode: env.WHATSAPP_TOKEN || env.SMS_API_KEY ? "live" : "unavailable" },
    { name: "Email", detail: "Receipts and account email", mode: env.RESEND_API_KEY ? "live" : "unavailable" },
    { name: "Maps", detail: "Distance and directions to a garage", mode: env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ? "live" : "unavailable" },
    { name: "AI business questions", detail: "Plain-language questions over your own garage data", mode: env.AI_PROVIDER ? "live" : "unavailable" },
  ] as const;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="display-2">System status</h1>
      <p className="mt-3 text-[15px] text-ink2">
        Each integration reports what it actually is. Nothing here is ever shown as live when it is not — a feature
        without credentials says so rather than pretending.
      </p>

      <Panel className="mt-8">
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.name} className="flex items-start justify-between gap-4 px-4 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{r.name}</p>
                <p className="mt-0.5 text-[12.5px] text-ink2">{r.detail}</p>
              </div>
              <Badge tone={TONE[r.mode]}>{r.mode}</Badge>
            </li>
          ))}
        </ul>
      </Panel>

      <dl className="mt-6 space-y-2 text-[13px] text-ink2">
        {(["live", "sandbox", "unavailable"] as const).map((k) => (
          <div key={k} className="flex gap-2">
            <dt><Badge tone={TONE[k]}>{k}</Badge></dt>
            <dd>{MEANS[k]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
