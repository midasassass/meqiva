/**
 * Demo data for MEQIVA. Creates several fictional garages with complete price matrices,
 * which is what the estimator, the comparison and the market bands all read — without
 * them the product looks empty even though everything works.
 *
 * Run once against a dev or staging project:
 *   npm run seed -- --yes
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local, and every
 * migration plus supabase/seed.sql already applied. Safe to re-run.
 */
import { createClient } from "@supabase/supabase-js";

if (!process.argv.includes("--yes")) {
  console.error("Refusing to run without --yes (creates demo users with a shared password).");
  process.exit(1);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const sb = createClient(url, key, { auth: { persistSession: false } });
const PASSWORD = "Demo-Meqiva-2026!";
const R = (n) => Math.round(n * 100);
const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString();
const ymdAgo = (d) => daysAgo(d).slice(0, 10);
const ymdIn = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
const step = (m) => console.log("  " + m);

/* ───────────── accounts ───────────── */

const ACCOUNTS = [
  ["customer@demo.meqiva.test", "Demo Customer", "customer", "9876500001"],
  ["family@demo.meqiva.test", "Demo Family Member", "customer", "9876500010"],
  ["owner@demo.meqiva.test", "Demo Garage Owner", "garage_owner", "9876500002"],
  ["advisor@demo.meqiva.test", "Demo Service Advisor", "service_advisor", "9876500003"],
  ["tech@demo.meqiva.test", "Demo Technician", "technician", "9876500004"],
  ["owner2@demo.meqiva.test", "Demo Owner — Sohna Road", "garage_owner", "9876500005"],
  ["owner3@demo.meqiva.test", "Demo Owner — DLF Phase 3", "garage_owner", "9876500006"],
  ["owner4@demo.meqiva.test", "Demo Owner — Sector 14", "garage_owner", "9876500007"],
  ["auditor@demo.meqiva.test", "Demo Quality Auditor", "quality_auditor", "9876500008"],
  ["support@demo.meqiva.test", "Demo Support Agent", "support_agent", "9876500009"],
  ["admin@demo.meqiva.test", "Demo Super Admin", "super_admin", "9876500000"],
];

const ids = {};
console.log("Accounts…");
for (const [email, name, role, phone] of ACCOUNTS) {
  const { data, error } = await sb.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: name },
  });
  let id = data?.user?.id;
  if (error) {
    const list = await sb.auth.admin.listUsers({ perPage: 200 });
    id = list.data.users.find((u) => u.email === email)?.id;
    if (!id) throw error;
  }
  ids[email] = id;
  await sb.from("profiles").update({ role, full_name: name, phone, is_demo: true }).eq("id", id);
}
step(`${ACCOUNTS.length} accounts ready`);

/* ───────────── garages ───────────── */

// Four workshops with genuinely different pricing, so comparison has something to compare.
const GARAGES = [
  {
    slug: "demo-sector-29-motors", name: "DEMO · Sector 29 Motors", owner: "owner@demo.meqiva.test",
    locality: "Sector 29", address: "Plot 14, Market Road", pincode: "122001", lat: 28.4675, lng: 77.0620,
    bays: 3, accent: "#2b59ff", verification: "quality_assured", pickup: true, factor: 1.0,
    tagline: "Maruti and Hyundai specialists, three bays, same-day service on most jobs",
    about: "Family-run workshop off the Sector 29 market road. Periodic servicing, brakes, suspension and AC work on petrol and diesel cars. We will always show you the old part.",
  },
  {
    slug: "demo-sohna-road-autocare", name: "DEMO · Sohna Road Auto Care", owner: "owner2@demo.meqiva.test",
    locality: "Sohna Road", address: "Unit 7, Service Lane", pincode: "122018", lat: 28.4089, lng: 77.0426,
    bays: 4, accent: "#0f9d74", verification: "verified", pickup: true, factor: 1.14,
    tagline: "Four bays, longer warranty, pickup across south Gurugram",
    about: "We take a little longer and charge a little more, and we put 45 days on our labour. Diagnostics, engine work and suspension on most makes.",
  },
  {
    slug: "demo-dlf-phase-3-service", name: "DEMO · DLF Phase 3 Service Point", owner: "owner3@demo.meqiva.test",
    locality: "DLF Phase 3", address: "Near Sikanderpur metro", pincode: "122002", lat: 28.4938, lng: 77.0926,
    bays: 2, accent: "#c2410c", verification: "listed", pickup: false, factor: 0.88,
    tagline: "Quick turnaround on routine servicing, walk-ins welcome",
    about: "Two bays near Sikanderpur. Routine servicing, brakes and batteries. No appointment needed for an oil change.",
  },
  {
    slug: "demo-sector-14-workshop", name: "DEMO · Sector 14 Workshop", owner: "owner4@demo.meqiva.test",
    locality: "Sector 14", address: "Old Gurugram, near the market", pincode: "122001", lat: 28.4663, lng: 77.0315,
    bays: 2, accent: "#7c3aed", verification: "verified", pickup: false, factor: 0.97,
    tagline: "Thirty years in Old Gurugram. Two-wheelers and cars.",
    about: "We have been on this road a long time. Cars and two-wheelers, mechanical and electrical work, honest about what can wait.",
  },
];

console.log("Garages…");
const garageIds = {};
for (const g of GARAGES) {
  let { data: row } = await sb.from("garages").select("id").eq("slug", g.slug).maybeSingle();
  if (!row) {
    const { data, error } = await sb.from("garages").insert({
      slug: g.slug, public_name: g.name, legal_name: `${g.name.replace("DEMO · ", "")} (fictional)`,
      owner_id: ids[g.owner], status: "active", verification: g.verification,
      verified_at: g.verification === "none" ? null : daysAgo(120),
      verification_expires_at: g.verification === "none" ? null : ymdIn(245),
      address: g.address, locality: g.locality, city: "Gurugram", pincode: g.pincode,
      lat: g.lat, lng: g.lng, phone: "9876500002", gstin: "06AAAAA0000A1Z5",
      bays_count: g.bays, pickup_drop: g.pickup, is_demo: true,
      supported_categories: ["hatchback", "sedan", "suv"],
    }).select("id").single();
    if (error) throw error;
    row = data;
  }
  garageIds[g.slug] = row.id;

  await sb.from("garage_settings").update({
    accent_hex: g.accent, tagline: g.tagline, about: g.about,
    online_booking: true, min_lead_minutes: 120, max_advance_days: 30, slot_minutes: 30,
    buffer_minutes: 15, concurrent_jobs_per_bay: 1, cancellation_window_hours: 6,
    pickup_enabled: g.pickup, pickup_fee_paise: g.pickup ? R(250) : 0, pickup_radius_km: 8,
    gst_registered: true, place_of_supply_code: "06",
    invoice_prefix: g.slug.includes("29") ? "S29" : g.slug.includes("sohna") ? "SRA" : g.slug.includes("dlf") ? "DP3" : "S14",
    invoice_terms: "Labour warranted 30 days or 1,000 km, whichever is earlier. Parts carry the manufacturer's warranty.",
    default_labour_rate_paise: R(800 * g.factor), target_margin_bps: 3000, low_margin_alert_bps: 1200,
    default_warranty_days: g.slug.includes("sohna") ? 45 : 30,
    features: { inventory: true, crm: true, reminders: true, purchase_orders: true, marketplace_listing: true },
  }).eq("garage_id", row.id);

  await sb.from("garage_terms").upsert({
    garage_id: row.id,
    warranty_policy: "Labour is warranted for 30 days or 1,000 km, whichever comes first. Parts carry the manufacturer's own warranty and we will help you claim it.",
    cancellation_policy: "Cancel free of charge up to 6 hours before your slot. If we have already ordered a part for your vehicle, we will tell you what it cost before you decide.",
  });

  await sb.from("garage_members").upsert({ garage_id: row.id, user_id: ids[g.owner], role: "garage_owner" });

  const { data: bays } = await sb.from("service_bays").select("id").eq("garage_id", row.id);
  if (!bays?.length) {
    await sb.from("service_bays").insert(
      Array.from({ length: g.bays }, (_, i) => ({ garage_id: row.id, name: `Bay ${i + 1}` })),
    );
  }

  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  await sb.from("garage_hours").delete().eq("garage_id", row.id).is("branch_id", null);
  await sb.from("garage_hours").insert(days.map((day) => ({
    garage_id: row.id, branch_id: null, day,
    opens: day === "sun" ? "10:00" : "09:30",
    closes: day === "sun" ? "14:00" : "19:00",
    closed: day === "sun",
  })));
}
step(`${GARAGES.length} garages ready`);

// The flagship garage gets a full team.
const FLAG = garageIds["demo-sector-29-motors"];
await sb.from("garage_members").upsert([
  { garage_id: FLAG, user_id: ids["advisor@demo.meqiva.test"], role: "service_advisor" },
  { garage_id: FLAG, user_id: ids["tech@demo.meqiva.test"], role: "technician" },
]);

/* ───────────── the price matrix ─────────────
   This is the part that was missing. Without it the estimator has nothing to read. */

const { data: packages } = await sb.from("service_packages")
  .select("id, slug, applies_to, typical_minutes").eq("active", true);

// Base figures for a hatchback, in rupees. Other classes scale from here.
const BASE = {
  "periodic-basic":   { labour: 720,  parts: 1650, consumables: 80,  warranty: 30 },
  "periodic-full":    { labour: 1400, parts: 3100, consumables: 250, warranty: 30 },
  "brake-front":      { labour: 600,  parts: 2400, consumables: 0,   warranty: 60 },
  "ac-service":       { labour: 900,  parts: 2100, consumables: 150, warranty: 30 },
  "battery-replace":  { labour: 250,  parts: 5400, consumables: 0,   warranty: 365 },
  "align-balance":    { labour: 700,  parts: 0,    consumables: 100, warranty: 15 },
  "tw-periodic":      { labour: 350,  parts: 650,  consumables: 50,  warranty: 15 },
};
const CLASS_FACTOR = { hatchback: 1, sedan: 1.14, suv: 1.38, mpv: 1.45, ev: 1.2, motorcycle: 0.34, scooter: 0.3 };

console.log("Price matrix…");
const matrix = [];
for (const g of GARAGES) {
  // Each garage skips one package, so coverage differs and the grid has something to show.
  const skip = { "demo-dlf-phase-3-service": "periodic-full", "demo-sector-14-workshop": "ac-service" }[g.slug];
  for (const p of packages ?? []) {
    if (p.slug === skip) continue;
    const base = BASE[p.slug];
    if (!base) continue;
    for (const cat of p.applies_to ?? []) {
      const f = (CLASS_FACTOR[cat] ?? 1) * g.factor;
      matrix.push({
        garage_id: garageIds[g.slug], package_id: p.id, vehicle_category: cat,
        labour_paise: R(Math.round(base.labour * f / 10) * 10),
        parts_paise: R(Math.round(base.parts * f / 10) * 10),
        consumables_paise: R(Math.round(base.consumables * f / 10) * 10),
        gst_rate_bps: 1800,
        est_minutes: Math.round((p.typical_minutes ?? 90) * (cat === "suv" ? 1.2 : 1)),
        warranty_days: g.slug.includes("sohna") ? base.warranty + 15 : base.warranty,
        active: true,
      });
    }
  }
}
if (matrix.length) {
  const { error } = await sb.from("garage_price_matrix")
    .upsert(matrix, { onConflict: "garage_id,package_id,vehicle_category" });
  if (error) throw error;
}
step(`${matrix.length} prices published across ${GARAGES.length} garages`);

// Add-ons, where the catalogue has any.
const { data: addons } = await sb.from("addon_catalog").select("id, slug").eq("active", true);
if (addons?.length) {
  const addonRows = [];
  for (const g of GARAGES) {
    for (const a of addons) {
      for (const cat of ["hatchback", "sedan", "suv"]) {
        addonRows.push({
          garage_id: garageIds[g.slug], addon_id: a.id, vehicle_category: cat,
          price_paise: R(Math.round(450 * (CLASS_FACTOR[cat] ?? 1) * g.factor / 10) * 10),
          gst_rate_bps: 1800, est_minutes: 30, active: true,
        });
      }
    }
  }
  await sb.from("garage_addon_prices").upsert(addonRows, { onConflict: "garage_id,addon_id,vehicle_category" });
  step(`${addonRows.length} add-on prices`);
}

/* ───────────── services, parts, credentials ───────────── */

const { data: cats } = await sb.from("service_categories").select("id, slug");
const catId = Object.fromEntries((cats ?? []).map((c) => [c.slug, c.id]));

for (const g of GARAGES) {
  const gid = garageIds[g.slug];
  const { data: has } = await sb.from("garage_services").select("id").eq("garage_id", gid).limit(1);
  if (!has?.length) {
    const basic = (packages ?? []).find((p) => p.slug === "periodic-basic");
    await sb.from("garage_services").insert({
      garage_id: gid, category_id: catId["oil"], package_id: basic?.id ?? null,
      name: "Basic periodic service", description: "Oil, filter and a full multi-point check.",
      labour_paise: R(720 * g.factor), parts_paise: R(1650 * g.factor), consumables_paise: R(80 * g.factor),
      est_minutes: 90, warranty_days: 30,
      included_items: ["Engine oil", "Oil filter", "Labour", "Multi-point inspection"],
    });
  }
}

const { data: hasParts } = await sb.from("parts").select("id").eq("garage_id", FLAG).limit(1);
if (!hasParts?.length) {
  await sb.from("parts").insert([
    { garage_id: FLAG, name: "Engine oil 5W-30, 3.5L", brand: "DemoLube", part_no: "DL-5W30-35",
      mrp_applies: true, mrp_paise: R(1180), pack_qty: 1, purchase_paise: R(800), sell_paise: R(1100), stock: 6, reorder_at: 3, category: "genuine" },
    { garage_id: FLAG, name: "Oil filter", brand: "DemoFilt", part_no: "DF-OF-221",
      mrp_applies: true, mrp_paise: R(350), pack_qty: 1, purchase_paise: R(180), sell_paise: R(330), stock: 2, reorder_at: 3, category: "oem" },
    { garage_id: FLAG, name: "Front brake pad set", brand: "DemoStop", part_no: "DS-BP-104",
      mrp_applies: true, mrp_paise: R(2400), pack_qty: 1, purchase_paise: R(1500), sell_paise: R(2300), stock: 4, reorder_at: 2, category: "aftermarket" },
    { garage_id: FLAG, name: "Air filter", brand: "DemoFilt",
      mrp_applies: true, mrp_paise: R(480), pack_qty: 1, purchase_paise: R(260), sell_paise: R(450), stock: 5, reorder_at: 2, category: "oem" },
  ]);
}

const { data: credTypes } = await sb.from("credential_types").select("id, slug");
const credId = Object.fromEntries((credTypes ?? []).map((c) => [c.slug, c.id]));
const { data: hasCreds } = await sb.from("technician_credentials").select("id").eq("garage_id", FLAG).limit(1);
if (!hasCreds?.length && credId["iti-mmv"]) {
  await sb.from("technician_credentials").insert([
    { garage_id: FLAG, user_id: ids["tech@demo.meqiva.test"], display_name: "Demo Technician",
      credential_type_id: credId["iti-mmv"], issued_on: ymdAgo(2800), years_experience: 11,
      verified_by: ids["auditor@demo.meqiva.test"], verified_at: daysAgo(120) },
    { garage_id: FLAG, user_id: ids["tech@demo.meqiva.test"], display_name: "Demo Technician",
      credential_type_id: credId["ac-refrigerant"], issued_on: ymdAgo(900),
      verified_by: ids["auditor@demo.meqiva.test"], verified_at: daysAgo(120) },
    { garage_id: FLAG, display_name: "Demo Senior Technician",
      credential_type_id: credId["diagnostics"], issued_on: ymdAgo(1500), years_experience: 16,
      verified_by: ids["auditor@demo.meqiva.test"], verified_at: daysAgo(118) },
  ]);
  step("technician credentials verified");
}

/* ───────────── a household, vehicles, and real history ───────────── */

const { data: models } = await sb.from("vehicle_models").select("id, name, category");
const model = (n) => (models ?? []).find((m) => m.name === n);

let { data: household } = await sb.from("households").select("id").eq("created_by", ids["customer@demo.meqiva.test"]).maybeSingle();
if (!household) {
  const { data } = await sb.from("households").insert({ name: "Demo Family", created_by: ids["customer@demo.meqiva.test"] }).select("id").single();
  household = data;
  await sb.from("household_members").insert([
    { household_id: household.id, user_id: ids["customer@demo.meqiva.test"], role: "owner", can_book: true, can_approve: true },
    { household_id: household.id, user_id: ids["family@demo.meqiva.test"], role: "member", can_book: true, can_approve: false },
  ]);
  step("household created with two members");
}

const VEHICLES = [
  { model: "City", year: 2018, reg: "HR26AB1234", odo: 62000, lastOn: ymdAgo(340), lastKm: 51000, owner: "customer@demo.meqiva.test" },
  { model: "Creta", year: 2021, reg: "HR26CD5678", odo: 38000, lastOn: ymdAgo(150), lastKm: 31000, owner: "customer@demo.meqiva.test" },
  { model: "Swift", year: 2016, reg: "HR26EF9012", odo: 94000, lastOn: ymdAgo(400), lastKm: 82000, owner: "family@demo.meqiva.test" },
];
const vehicleIds = [];
for (const v of VEHICLES) {
  const m = model(v.model);
  if (!m) continue;
  let { data: row } = await sb.from("vehicles").select("id").eq("reg_no", v.reg).maybeSingle();
  if (!row) {
    const { data } = await sb.from("vehicles").insert({
      owner_id: ids[v.owner], model_id: m.id, year: v.year, reg_no: v.reg,
      odometer_km: v.odo, last_service_on: v.lastOn, last_service_km: v.lastKm,
      household_id: household?.id ?? null,
    }).select("id").single();
    row = data;
  } else {
    await sb.from("vehicles").update({ household_id: household?.id ?? null }).eq("id", row.id);
  }
  if (row) vehicleIds.push({ ...v, id: row.id, category: m.category });
}
step(`${vehicleIds.length} vehicles, shared with the household`);

// Completed history, so the impact figures and the vehicle passport are not empty.
const { data: existingBookings } = await sb.from("bookings").select("id").eq("garage_id", FLAG).limit(1);
if (!existingBookings?.length && vehicleIds.length) {
  const { data: svc } = await sb.from("garage_services").select("id, est_minutes").eq("garage_id", FLAG).limit(1).single();
  const v = vehicleIds[0];

  for (let i = 0; i < 3; i++) {
    const when = daysAgo(90 * (i + 1));
    const { data: bk } = await sb.from("bookings").insert({
      garage_id: FLAG, customer_id: ids["customer@demo.meqiva.test"], vehicle_id: v.id, service_id: svc.id,
      origin: "marketplace", status: "completed", slot_start: when,
      slot_end: new Date(Date.parse(when) + 90 * 60000).toISOString(),
      quoted_total_paise: R(2895), customer_note: "Routine service (DEMO).",
    }).select("id").single();

    const { data: jc } = await sb.from("job_cards").insert({
      garage_id: FLAG, booking_id: bk.id, customer_id: ids["customer@demo.meqiva.test"], vehicle_id: v.id,
      origin: "marketplace", complaints: "Periodic service (DEMO).", odometer_km: v.odo - (3 - i) * 9000,
      technician_id: ids["tech@demo.meqiva.test"], checked_in_at: when, started_at: when, completed_at: when,
      qc_passed: true, custom: { key_tag_number: `A-${10 + i}`, fuel_level: "Half", wash_included: true },
    }).select("id").single();

    const lines = [
      { kind: "part", description: "Engine oil 5W-30, 3.5L", qty: 1, line_total_paise: R(1100), line_subtotal_paise: R(932), mrp_paise: R(1180), gst_bps: 1800 },
      { kind: "part", description: "Oil filter", qty: 1, line_total_paise: R(330), line_subtotal_paise: R(280), mrp_paise: R(350), gst_bps: 1800 },
      { kind: "labour", description: "Labour", qty: 1, line_total_paise: R(850), line_subtotal_paise: R(720), gst_bps: 1800 },
    ];
    const { data: inv } = await sb.from("invoices").insert({
      garage_id: FLAG, job_card_id: jc.id, booking_id: bk.id, customer_id: ids["customer@demo.meqiva.test"],
      number: `S29/26/${String(1000 + i)}`, lines,
      subtotal_paise: R(1932), tax_paise: R(348), total_paise: R(2280), paid_paise: R(2280),
      cgst_paise: R(174), sgst_paise: R(174), igst_paise: 0, place_of_supply: "06", issued_at: when,
    }).select("id").single();

    await sb.from("warranties").insert({
      garage_id: FLAG, job_card_id: jc.id, invoice_id: inv.id, vehicle_id: v.id,
      customer_id: ids["customer@demo.meqiva.test"], kind: "labour", provider_name: "DEMO · Sector 29 Motors",
      covers: "Workmanship on the periodic service carried out on this invoice.",
      excludes: "Wear items, and any fault arising from a part supplied by someone else.",
      starts_on: when.slice(0, 10), expires_on: new Date(Date.parse(when) + 30 * 864e5).toISOString().slice(0, 10),
      km_limit: 1000, odometer_at_start: v.odo - (3 - i) * 9000, reference: `S29/26/${String(1000 + i)}`,
    });

    if (i === 0) {
      await sb.from("reviews").insert({
        garage_id: FLAG, booking_id: bk.id, customer_id: ids["customer@demo.meqiva.test"],
        rating: 5, quality: 5, price_transparency: 5, timeliness: 4, communication: 5,
        remarks: "Showed me the old filter before fitting the new one. Final bill matched the estimate exactly (DEMO).",
      });
    }
  }
  step("3 completed services with invoices, warranties and a review");

  // One live job so the workshop board and the customer timeline have something on them.
  const live = new Date(Date.now() + 3600_000).toISOString();
  const { data: lb } = await sb.from("bookings").insert({
    garage_id: FLAG, customer_id: ids["customer@demo.meqiva.test"], vehicle_id: vehicleIds[1]?.id ?? v.id,
    service_id: svc.id, origin: "marketplace", status: "service_in_progress",
    slot_start: live, slot_end: new Date(Date.parse(live) + 90 * 60000).toISOString(),
    quoted_total_paise: R(3295), customer_note: "Slight squeak from the front when braking (DEMO).",
  }).select("id").single();
  await sb.from("job_cards").insert({
    garage_id: FLAG, booking_id: lb.id, customer_id: ids["customer@demo.meqiva.test"],
    vehicle_id: vehicleIds[1]?.id ?? v.id, origin: "marketplace",
    complaints: "Periodic service. Slight squeak from the front when braking (DEMO).",
    odometer_km: 38000, technician_id: ids["tech@demo.meqiva.test"],
    checked_in_at: new Date().toISOString(), started_at: new Date().toISOString(),
    custom: { key_tag_number: "A-14", fuel_level: "Half", dropped_off_by: "Owner", wash_included: true },
  });
  await sb.from("job_cards").insert({
    garage_id: FLAG, origin: "walk_in", complaints: "AC not cooling (DEMO walk-in).",
    odometer_km: 48000, checked_in_at: new Date().toISOString(),
    advisor_notes: "Walk-in: Demo Walkin (9876500011)",
    custom: { key_tag_number: "A-15", fuel_level: "Quarter" },
  });
  step("1 live job and 1 walk-in on the board");
}

for (const g of GARAGES) {
  const { data: s } = await sb.from("subscriptions").select("id").eq("garage_id", garageIds[g.slug]).maybeSingle();
  if (!s) {
    await sb.from("subscriptions").insert({
      garage_id: garageIds[g.slug], plan_id: "growth", status: "trialing",
      current_period_end: new Date(Date.now() + 30 * 864e5).toISOString(),
    });
  }
}

/* ───────────── testimonials ─────────────
   Marked is_demo so the public site can label them. Replace with real, consented
   quotes before launch — the admin panel has a form for exactly that. */

const { data: hasTesti } = await sb.from("testimonials").select("id").limit(1);
if (!hasTesti?.length) {
  await sb.from("testimonials").insert([
    { author_name: "Demo customer — Sector 29", author_context: "Honda City, 2018", city: "Gurugram",
      quote: "The estimate said ₹2,895 and the invoice said ₹2,895. That has never happened to me at a workshop before.",
      rating: 5, source: "platform_review", published: true, is_demo: true, sort: 1 },
    { author_name: "Demo customer — Sohna Road", author_context: "Hyundai Creta, 2021", city: "Gurugram",
      quote: "They found a worn suspension link mid-service. I got a message with a photo and the price, approved it on my phone, and that was that.",
      rating: 5, source: "platform_review", published: true, is_demo: true, sort: 2 },
    { author_name: "Demo garage owner", author_context: "Two-bay workshop, Old Gurugram", city: "Gurugram",
      quote: "I was paying a monthly fee elsewhere and still writing job cards in a register. Here my own walk-ins cost me nothing and the job card is on the boy's phone.",
      rating: 5, source: "interview", published: true, is_demo: true, sort: 3 },
  ]);
  step("3 demo testimonials (labelled, replace before launch)");
}

console.log("\nDone. Everything above is fictional and labelled DEMO.");
console.log("Password for every demo user:", PASSWORD, "\n");
for (const [email, , role] of ACCOUNTS) console.log("  " + role.padEnd(16) + email);
console.log("\nTry:  /estimate   /find   /garages/demo-sector-29-motors   /garage/pricing");
