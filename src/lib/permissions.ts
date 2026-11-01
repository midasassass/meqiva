export const ROLES = [
  "customer",
  "garage_owner",
  "service_advisor",
  "technician",
  "super_admin",
  "quality_auditor",
  "support_agent",
  "supplier",
  "fleet_manager",
] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | "garage.manage"
  | "garage.staff"
  | "pricing.edit"
  | "quote.create"
  | "quote.approve_extra_work"
  | "job.view"
  | "job.update_progress"
  | "job.assign"
  | "inventory.manage"
  | "finance.view"
  | "booking.create"
  | "vehicle.manage_own"
  | "audit.perform"
  | "ticket.handle"
  | "platform.admin"
  | "fleet.manage";

const MAP: Record<Role, Permission[]> = {
  customer: ["booking.create", "vehicle.manage_own", "quote.approve_extra_work"],
  garage_owner: [
    "garage.manage", "garage.staff", "pricing.edit", "quote.create", "job.view", "job.update_progress",
    "job.assign", "inventory.manage", "finance.view",
  ],
  service_advisor: ["quote.create", "job.view", "job.update_progress", "job.assign", "inventory.manage"],
  technician: ["job.view", "job.update_progress"], // no finance, no pricing, no extra-work approval
  super_admin: ["platform.admin", "finance.view", "ticket.handle", "audit.perform"],
  quality_auditor: ["audit.perform"],
  support_agent: ["ticket.handle"],
  supplier: [],
  fleet_manager: ["fleet.manage", "booking.create", "vehicle.manage_own"],
};

export const can = (role: Role, perm: Permission) => MAP[role].includes(perm);

export function homeFor(role: Role): string {
  switch (role) {
    case "customer": return "/app";
    case "garage_owner":
    case "service_advisor": return "/garage";
    case "technician": return "/tech";
    case "super_admin":
    case "quality_auditor":
    case "support_agent": return "/admin";
    case "fleet_manager": return "/app";
    case "supplier": return "/app";
  }
}

/** Route prefix -> roles allowed. Enforced in middleware AND again by Supabase RLS. */
export const ROUTE_ROLES: Record<string, Role[]> = {
  "/app": ["customer", "fleet_manager", "supplier"],
  "/garage": ["garage_owner", "service_advisor"],
  "/tech": ["technician", "garage_owner", "service_advisor"],
  "/admin": ["super_admin", "quality_auditor", "support_agent"],
};
