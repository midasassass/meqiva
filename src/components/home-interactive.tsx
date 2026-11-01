"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Car, Wrench, ShieldCheck, CheckCircle2, Clock, Sparkles, ArrowRight,
  FileText, Smartphone, Ban, Receipt, QrCode, UserCheck, AlertTriangle
} from "lucide-react";
import { cx, Button } from "./ui";

export function HeroTrustBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft/70 px-4 py-1.5 text-xs font-semibold text-brand shadow-soft backdrop-blur-sm transition-transform hover:scale-[1.02]">
      <span className="flex h-2 w-2 rounded-full bg-brand animate-ping" />
      <span>🇮🇳 The Unified Auto-Tech Platform for Indian Garages & Car Owners</span>
      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-brand font-bold">
        Zoho for Auto
      </span>
    </div>
  );
}

export function EcosystemToggleDemo() {
  const [activeTab, setActiveTab] = useState<"owner" | "garage">("owner");
  const [activeStep, setActiveStep] = useState(1);

  const ownerSteps = [
    {
      num: 1,
      title: "Vahan Lookup & Honest Basket",
      desc: "Enter your car number (e.g. DL 03 CC 4421). Instant make & model lookup. Compare real garage baskets with parts, labour, and GST broken down clearly.",
      badge: "No Hidden Costs",
      preview: {
        title: "Maruti Suzuki Swift Dzire VXi (Petrol)",
        status: "Standard Periodic Service Basket",
        tag: "Verified Rate Card",
        price: "₹3,450",
        breakdown: [
          { item: "Synthetic Engine Oil (3.5L) — Castrol", cost: "₹1,450 (MRP Checked ✓)" },
          { item: "OEM Oil Filter & Air Filter", cost: "₹520" },
          { item: "Workshop Labour & 40-pt Check", cost: "₹950" },
          { item: "GST (18% itemised)", cost: "₹530" },
        ],
      },
    },
    {
      num: 2,
      title: "Live Bay Tracking & Photo Evidence",
      desc: "Watch your vehicle move from Inspection to Ramp. When a technician flags worn brake pads, you get timestamped before-and-after photos on your phone.",
      badge: "Real-time Inspection",
      preview: {
        title: "Bay 2: Active Vehicle Inspection",
        status: "Technician R. Sharma • Ramp #2",
        tag: "In Progress",
        price: "Live Bay Camera",
        breakdown: [
          { item: "Engine Oil Flushed & Filled", cost: "Completed ✓" },
          { item: "Brake Pad Inspection", cost: "Photo attached: 2.5mm remaining" },
          { item: "Suspension Link Rods", cost: "Inspected — Good condition" },
          { item: "Washing & Detailing", cost: "Queued" },
        ],
      },
    },
    {
      num: 3,
      title: "WhatsApp Approval Before Any Extra Work",
      desc: "If the garage notices anything extra, work stops. You receive a detailed WhatsApp notification with parts, labour, and statutory MRP. Zero unapproved bills.",
      badge: "Zero Bill Shocks",
      preview: {
        title: "WhatsApp Repair Approval Request",
        status: "Front Brake Pads need replacement",
        tag: "Requires Your Approval",
        price: "+₹1,850 Total",
        breakdown: [
          { item: "Bosch Front Brake Pad Set (Pair)", cost: "₹1,450 (MRP Cap: ₹1,450)" },
          { item: "Fitting Labour", cost: "₹400" },
          { item: "Status", cost: "Awaiting customer tap to approve" },
        ],
      },
    },
    {
      num: 4,
      title: "Itemised GST Bill & UPI QR Payment",
      desc: "Get an authorized GST tax invoice with dynamic UPI QR code. Pay directly to the garage with GPay, PhonePe, or Paytm. The record permanently saves to your Vehicle Passport.",
      badge: "Digital Passport",
      preview: {
        title: "Tax Invoice #MEQ-2026-0891",
        status: "SAC: 998714 • GSTIN: 06AAACG1234F1Z8",
        tag: "Paid via UPI",
        price: "₹5,300 Total",
        breakdown: [
          { item: "Saved to Digital Glovebox", cost: "Download PDF" },
          { item: "Transferable on resale", cost: "Increases resale value" },
          { item: "Warranty recorded", cost: "6 Months / 10,000 KM" },
        ],
      },
    },
  ];

  const garageSteps = [
    {
      num: 1,
      title: "Zoho Desk: Digital Job Card & Dent Sheet",
      desc: "Replace messy paper pads. Intake vehicles on any smartphone with an interactive scratch/dent marker, fuel level, odometer photo, and customer complaint list.",
      badge: "Paperless Intake",
      preview: {
        title: "Job Card #JC-9021 • Intake Complete",
        status: "Hyundai Creta 1.5 SX • HR 26 DQ 8820",
        tag: "Advisor: Sunil V.",
        price: "Estimated: ₹7,800",
        breakdown: [
          { item: "Reported: AC cooling drop + 40k Service", cost: "Assigned: Bay 4" },
          { item: "Inventory: 4 Scratches documented", cost: "Customer Signed" },
          { item: "Fuel: 60% | Odo: 41,200 km", cost: "Verified" },
        ],
      },
    },
    {
      num: 2,
      title: "Zoho Inventory: MRP-Protected Stock & Parts",
      desc: "Track fast-moving parts, consumables, and supplier bills. Software strictly enforces the statutory MRP ceiling so technicians never enter illegal inflated prices.",
      badge: "Statutory MRP Guard",
      preview: {
        title: "Workshop Spare Parts Inventory",
        status: "Central Stock Room • Shelf B4",
        tag: "Auto-Reorder Ready",
        price: "Stock: 48 Units",
        breakdown: [
          { item: "Bosch Dot 4 Brake Fluid (500ml)", cost: "Stock: 14 • MRP ₹280" },
          { item: "Motul 5W30 Fully Synthetic Oil", cost: "Stock: 8 Barrels • In-Stock" },
          { item: "Attempted Price Override (> MRP)", cost: "BLOCKED by System 🛡️" },
        ],
      },
    },
    {
      num: 3,
      title: "Zoho CRM: Automated WhatsApp Service Reminders",
      desc: "Retain 80%+ of your customer base. System calculates driving patterns and sends polite, personalized WhatsApp reminders for periodic service, insurance renewal, and PUC.",
      badge: "Automated Retention",
      preview: {
        title: "Automated CRM Reminder Engine",
        status: "34 Customers Due for Periodic Service",
        tag: "WhatsApp Delivery",
        price: "+₹1.2L Monthly Pipeline",
        breakdown: [
          { item: "Rajiv K. (Honda City) — Due in 5 days", cost: "WhatsApp Sent (Delivered)" },
          { item: "Pooja S. (Tata Tiago) — Insurance Due", cost: "WhatsApp Sent (Read)" },
          { item: "Walk-ins & regulars retained", cost: "Zero Commission" },
        ],
      },
    },
    {
      num: 4,
      title: "Zoho Books: 1-Click GST Invoices & UPI QR",
      desc: "Generate clean GST e-invoices with HSN/SAC codes, CGST/SGST breakdowns, and dynamic instant-settlement UPI QR codes for zero payment gateway delays.",
      badge: "Instant Settlement",
      preview: {
        title: "Automated GST Invoicing & Ledger",
        status: "Daily Revenue: ₹48,600",
        tag: "Tally / Zoho Export Ready",
        price: "100% Tax Compliant",
        breakdown: [
          { item: "Direct UPI QR Payment to your bank", cost: "0% Gateway Fee" },
          { item: "HSN / SAC Codes itemized", cost: "Auto-Calculated" },
          { item: "Monthly GSTR-1 Summary Export", cost: "Ready for CA" },
        ],
      },
    },
  ];

  const steps = activeTab === "owner" ? ownerSteps : garageSteps;
  const currentStep = steps.find((s) => s.num === activeStep) ?? steps[0]!;

  return (
    <div className="mt-12 rounded-panel border border-line bg-surface p-6 shadow-card md:p-8">
      {/* Ecosystem Tab Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-brand">
            Interactive Product Tour
          </span>
          <h3 className="display-3 mt-1">See how MEQIVA works in real workshop life</h3>
        </div>

        <div className="inline-flex rounded-panel bg-surface2 p-1 border border-line">
          <button
            type="button"
            onClick={() => { setActiveTab("owner"); setActiveStep(1); }}
            className={cx(
              "flex items-center gap-2 rounded-card px-4 py-2 text-xs font-bold transition-all duration-200",
              activeTab === "owner"
                ? "bg-brand text-brand-fg shadow-soft"
                : "text-ink2 hover:text-ink"
            )}
          >
            <Car className="h-4 w-4" />
            <span>For Car Owners</span>
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab("garage"); setActiveStep(1); }}
            className={cx(
              "flex items-center gap-2 rounded-card px-4 py-2 text-xs font-bold transition-all duration-200",
              activeTab === "garage"
                ? "bg-brand text-brand-fg shadow-soft"
                : "text-ink2 hover:text-ink"
            )}
          >
            <Wrench className="h-4 w-4" />
            <span>For Workshops (Zoho ERP)</span>
          </button>
        </div>
      </div>

      {/* 4 Steps Navigation Bar */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {steps.map((s) => {
          const isCurrent = s.num === activeStep;
          return (
            <button
              key={s.num}
              type="button"
              onClick={() => setActiveStep(s.num)}
              className={cx(
                "group relative flex flex-col items-start rounded-card p-3 text-left transition-all duration-200 border",
                isCurrent
                  ? "border-brand bg-brand-soft/40 shadow-soft"
                  : "border-line bg-surface hover:border-line-strong hover:bg-surface2/50"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={cx(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                    isCurrent ? "bg-brand text-brand-fg" : "bg-surface2 text-ink2 group-hover:text-ink"
                  )}
                >
                  {s.num}
                </span>
                <span className="text-[10.5px] font-semibold text-brand truncate">
                  {s.badge}
                </span>
              </div>
              <p
                className={cx(
                  "mt-2 text-xs font-bold leading-snug line-clamp-2",
                  isCurrent ? "text-ink" : "text-ink2 group-hover:text-ink"
                )}
              >
                {s.title}
              </p>
            </button>
          );
        })}
      </div>

      {/* Step Detail + Interactive Preview Card */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1.2fr] lg:items-center rounded-panel bg-surface2/40 border border-line p-5 sm:p-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent-fg">
            <Sparkles className="h-3 w-3" /> Step {currentStep.num} of 4
          </div>
          <h4 className="headline text-ink text-lg sm:text-xl font-bold">{currentStep.title}</h4>
          <p className="text-sm leading-relaxed text-ink2">{currentStep.desc}</p>

          <div className="pt-2">
            {activeTab === "owner" ? (
              <Link
                href="/find"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
              >
                Try this with your vehicle <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <Link
                href="/for-garages"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline"
              >
                Explore MEQIVA Workshop ERP Suite <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>

        {/* Realistic Mobile/Tablet Interactive Dashboard Preview */}
        <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <div className="flex items-center justify-between border-b border-line bg-surface2 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="text-[11px] font-mono text-ink3 ml-1">meqiva.in • verified live</span>
            </div>
            <span className="rounded bg-brand/10 px-2 py-0.5 text-[10.5px] font-bold text-brand">
              {currentStep.preview.tag}
            </span>
          </div>

          <div className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
              <div>
                <p className="text-xs font-bold text-ink">{currentStep.preview.title}</p>
                <p className="text-[11px] text-ink2 mt-0.5">{currentStep.preview.status}</p>
              </div>
              <p className="tnum text-sm font-bold text-brand text-right shrink-0">
                {currentStep.preview.price}
              </p>
            </div>

            <div className="mt-3 space-y-2">
              {currentStep.preview.breakdown.map((row, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 rounded bg-surface2/60 px-3 py-1.5 text-xs"
                >
                  <span className="text-ink2 truncate">{row.item}</span>
                  <span className="tnum font-medium text-ink shrink-0">{row.cost}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between text-[11px] text-ink3 border-t border-line/60 pt-2.5">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> Indian Statutory Compliance Checked
              </span>
              <span>Encrypted & Signed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function IndiaGarageFeatures() {
  const pillars = [
    {
      icon: Receipt,
      title: "Zoho Books for Garages",
      desc: "One-click GST tax invoices with HSN/SAC codes, CGST/SGST splits, and printed MRP ceiling blocks. Export to Tally or Excel with zero hassle.",
    },
    {
      icon: Smartphone,
      title: "Automated WhatsApp CRM",
      desc: "Job card status alerts, repair approvals, and service reminders sent directly to car owners via official WhatsApp Business API.",
    },
    {
      icon: QrCode,
      title: "Dynamic UPI Instant Pay",
      desc: "Print instant-settlement UPI QR codes directly on invoices. Customer scans with GPay/PhonePe/Paytm; money hits your bank account directly.",
    },
    {
      icon: Car,
      title: "Vahan Registration Lookup",
      desc: "Type the car number plate to auto-populate chassis, engine, fuel type, variant, and insurance/PUC validity dates via Vahan API.",
    },
    {
      icon: Ban,
      title: "Statutory MRP Protection",
      desc: "The only platform in India that prevents selling spare parts above the printed MRP, keeping you 100% legal under the Legal Metrology Act.",
    },
    {
      icon: UserCheck,
      title: "Technician & Bay Allocation",
      desc: "Assign specific ramps, technicians, and time slots. Track technician productivity and job turnaround times in real-time.",
    },
  ];

  return (
    <section className="border-t border-line bg-surface2/30 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand mb-3">
            <Sparkles className="h-3.5 w-3.5" />
            <span>The All-In-One Workshop Operating System</span>
          </div>
          <h2 className="display-2">The ZOHO built specifically for Indian auto workshops.</h2>
          <p className="mt-3 text-base text-ink2 leading-relaxed">
            Replace fragmented accounting, scattered registers, and manual phone calls with an end-to-end cloud platform designed for Indian garage owners, service advisors, and mechanics.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((p, idx) => (
            <div
              key={p.title}
              className="rise group flex flex-col rounded-panel border border-line bg-surface p-6 shadow-soft transition-all duration-300 hover:shadow-card hover:-translate-y-1 hover:border-brand/40"
              style={{ "--i": idx } as React.CSSProperties}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-card bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-brand-fg">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-[16px] font-bold text-ink">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink2">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
