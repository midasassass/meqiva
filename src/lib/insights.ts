import { formatINR, type Paise } from "./money";

/**
 * MEQIVA Insights, rules-based. Every card is derived from the garage's own rows
 * so it works with no AI provider configured. An AI layer may explain these,
 * never invent them.
 */

export type Severity = "info" | "attention" | "urgent";

export interface Insight {
  id: string;
  severity: Severity;
  title: string;
  detail?: string;
  href: string;
  action: string;
}

export interface GarageSnapshot {
  unacceptedQuotes: number;
  unacceptedValuePaise: Paise;
  lowStock: { name: string; stock: number; reorderAt: number }[];
  pendingApprovals: number;
  overdueJobs: number;
  awaitingParts: number;
  uncollectedPaise: Paise;
  dueForService: number;
  openComplaints: number;
  bayUtilisationPct: number | null;
  idleBaysToday: number;
  lowMarginCategories: { name: string; marginPct: number }[];
  mrpViolations: number;
  subscriptionDaysLeft: number | null;
}

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function buildInsights(s: GarageSnapshot): Insight[] {
  const out: Insight[] = [];

  if (s.mrpViolations > 0) out.push({
    id: "mrp", severity: "urgent",
    title: `${plural(s.mrpViolations, "pricing attempt")} above MRP ${s.mrpViolations === 1 ? "was" : "were"} blocked`,
    detail: "Check the part records behind these. Repeated attempts are visible to MEQIVA compliance.",
    href: "/garage/inventory?filter=mrp", action: "Review parts",
  });

  if (s.pendingApprovals > 0) out.push({
    id: "approvals", severity: "urgent",
    title: `${plural(s.pendingApprovals, "job")} waiting on customer approval`,
    detail: "Work is stopped until the customer accepts. A phone call usually moves these faster than a reminder.",
    href: "/garage/jobs?status=awaiting_customer_approval", action: "Open jobs",
  });

  if (s.overdueJobs > 0) out.push({
    id: "overdue", severity: "urgent",
    title: `${plural(s.overdueJobs, "job")} past the promised time`,
    detail: "Tell the customer before they ask. Delays handled early rarely become complaints.",
    href: "/garage/workshop", action: "Open workshop board",
  });

  if (s.openComplaints > 0) out.push({
    id: "complaints", severity: "urgent",
    title: `${plural(s.openComplaints, "open complaint")}`,
    href: "/garage/tickets", action: "Respond",
  });

  if (s.subscriptionDaysLeft != null && s.subscriptionDaysLeft <= 7) out.push({
    id: "subscription", severity: "attention",
    title: s.subscriptionDaysLeft <= 0 ? "Your plan has lapsed" : `Your plan renews in ${plural(s.subscriptionDaysLeft, "day")}`,
    detail: "Jobs in progress are never interrupted. Some features pause until the plan is renewed.",
    href: "/garage/settings/subscription", action: "Manage plan",
  });

  if (s.unacceptedQuotes > 0) out.push({
    id: "quotes", severity: "attention",
    title: `${plural(s.unacceptedQuotes, "quotation")} unaccepted this week`,
    detail: `${formatINR(s.unacceptedValuePaise)} of work is sitting undecided.`,
    href: "/garage/crm/follow-ups", action: "Start follow-ups",
  });

  if (s.awaitingParts > 0) out.push({
    id: "parts_wait", severity: "attention",
    title: `${plural(s.awaitingParts, "job")} held up waiting for parts`,
    href: "/garage/purchase-orders", action: "Check orders",
  });

  if (s.lowStock.length) out.push({
    id: "stock", severity: "attention",
    title: `${plural(s.lowStock.length, "part")} at or below reorder level`,
    detail: s.lowStock.slice(0, 3).map((p) => `${p.name} (${p.stock} left)`).join(", "),
    href: "/garage/inventory?filter=low", action: "Reorder",
  });

  if (s.uncollectedPaise > 0) out.push({
    id: "collect", severity: "attention",
    title: `${formatINR(s.uncollectedPaise)} invoiced but not collected`,
    href: "/garage/invoices?status=unpaid", action: "Chase payment",
  });

  if (s.idleBaysToday > 0 && s.dueForService > 0) out.push({
    id: "idle", severity: "info",
    title: `${plural(s.idleBaysToday, "bay")} free today, and ${s.dueForService} customers are due for service`,
    detail: "Offer the open slots to customers whose vehicles are due. Only slots you can actually honour are shown.",
    href: "/garage/crm/reminders", action: "Fill the day",
  });
  else if (s.dueForService > 0) out.push({
    id: "due", severity: "info",
    title: `${plural(s.dueForService, "vehicle")} due for service`,
    href: "/garage/crm/reminders", action: "Send reminders",
  });

  if (s.bayUtilisationPct != null && s.bayUtilisationPct < 50) out.push({
    id: "util", severity: "info",
    title: `Bays ran at ${Math.round(s.bayUtilisationPct)}% this week`,
    detail: "Below half. Consider marketplace listing or a reminder run to even out the load.",
    href: "/garage/reports", action: "See the week",
  });

  for (const c of s.lowMarginCategories.slice(0, 2)) out.push({
    id: `margin_${c.name}`, severity: "info",
    title: `${c.name} is returning ${c.marginPct.toFixed(1)}% contribution`,
    detail: "Check the labour time you book against what it actually takes, and the part you buy for it.",
    href: "/garage/reports/margins", action: "Review pricing",
  });

  const rank: Record<Severity, number> = { urgent: 0, attention: 1, info: 2 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export const emptySnapshot: GarageSnapshot = {
  unacceptedQuotes: 0, unacceptedValuePaise: 0, lowStock: [], pendingApprovals: 0, overdueJobs: 0,
  awaitingParts: 0, uncollectedPaise: 0, dueForService: 0, openComplaints: 0, bayUtilisationPct: null,
  idleBaysToday: 0, lowMarginCategories: [], mrpViolations: 0, subscriptionDaysLeft: null,
};
