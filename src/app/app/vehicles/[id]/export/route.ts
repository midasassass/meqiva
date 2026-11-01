import { NextResponse } from "next/server";
import { getSessionUser, supabaseServer } from "@/lib/supabase/server";

/** CSV export of a vehicle's full history. RLS makes sure it can only ever be the caller's own. */
const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  // Guard against spreadsheet formula injection in exported text.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return new NextResponse("Sign in to export your history", { status: 401 });

  const sb = await supabaseServer();
  const { data: vehicle } = await sb.from("vehicles")
    .select("id, year, reg_no, vehicle_models(name, vehicle_makes(name))").eq("id", id).maybeSingle();
  if (!vehicle) return new NextResponse("Not found", { status: 404 });

  const v = vehicle as unknown as { year: number | null; reg_no: string | null; vehicle_models: { name: string; vehicle_makes: { name: string } } };

  const [inv, own] = await Promise.all([
    sb.from("invoices").select("number, total_paise, issued_at, garages(public_name), job_cards!inner(vehicle_id, odometer_km, complaints)")
      .eq("job_cards.vehicle_id", id).order("issued_at"),
    sb.from("vehicle_service_records").select("serviced_on, odometer_km, garage_name, summary, amount_paise")
      .eq("vehicle_id", id).order("serviced_on"),
  ]);

  const rows: string[][] = [["Date", "Source", "Garage", "Odometer (km)", "Work", "Reference", "Amount (INR)"]];

  for (const r of (inv.data ?? []) as unknown as { number: string; total_paise: number; issued_at: string; garages: { public_name: string }; job_cards: { odometer_km: number | null; complaints: string | null } }[]) {
    rows.push([
      r.issued_at.slice(0, 10), "Verified through MEQIVA", r.garages?.public_name ?? "",
      String(r.job_cards?.odometer_km ?? ""), r.job_cards?.complaints ?? "", r.number,
      (Number(r.total_paise) / 100).toFixed(2),
    ]);
  }
  for (const r of own.data ?? []) {
    rows.push([
      r.serviced_on, "Added by owner, unverified", r.garage_name ?? "",
      String(r.odometer_km ?? ""), r.summary ?? "", "",
      r.amount_paise != null ? (Number(r.amount_paise) / 100).toFixed(2) : "",
    ]);
  }

  const name = `${v.vehicle_models.vehicle_makes.name}-${v.vehicle_models.name}${v.reg_no ? `-${v.reg_no}` : ""}`
    .replace(/[^A-Za-z0-9-]/g, "-").toLowerCase();

  return new NextResponse(rows.map((r) => r.map(csvCell).join(",")).join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="meqiva-history-${name}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
