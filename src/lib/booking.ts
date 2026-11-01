export const BOOKING_STATUSES = [
  "requested",
  "awaiting_garage_confirmation",
  "confirmed",
  "vehicle_arrived",
  "inspection_in_progress",
  "awaiting_customer_approval",
  "awaiting_parts",
  "service_in_progress",
  "quality_check",
  "ready_for_delivery",
  "completed",
  "cancelled",
  "disputed",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type Actor = "customer" | "garage_owner" | "service_advisor" | "technician" | "system" | "support" | "admin";

const GARAGE: Actor[] = ["garage_owner", "service_advisor"];
const SHOP: Actor[] = ["garage_owner", "service_advisor", "technician"];

interface Edge { to: BookingStatus; by: Actor[] }

const T: Record<BookingStatus, Edge[]> = {
  requested: [{ to: "awaiting_garage_confirmation", by: ["system", "customer"] }, { to: "cancelled", by: ["customer"] }],
  awaiting_garage_confirmation: [
    { to: "confirmed", by: GARAGE },
    { to: "cancelled", by: [...GARAGE, "customer", "system"] }, // garage reject / customer cancel / expiry
  ],
  confirmed: [
    { to: "vehicle_arrived", by: GARAGE },
    { to: "cancelled", by: [...GARAGE, "customer", "system"] }, // includes no-show
  ],
  vehicle_arrived: [{ to: "inspection_in_progress", by: SHOP }, { to: "cancelled", by: ["customer", ...GARAGE] }],
  inspection_in_progress: [
    { to: "awaiting_customer_approval", by: SHOP },
    { to: "service_in_progress", by: SHOP },
  ],
  awaiting_customer_approval: [
    { to: "service_in_progress", by: ["customer", ...GARAGE] }, // approved (customer) or declined extra work
    { to: "awaiting_parts", by: SHOP },
    { to: "cancelled", by: ["customer"] },
  ],
  awaiting_parts: [{ to: "service_in_progress", by: SHOP }, { to: "cancelled", by: ["customer", ...GARAGE] }],
  service_in_progress: [
    { to: "awaiting_customer_approval", by: SHOP },
    { to: "awaiting_parts", by: SHOP },
    { to: "quality_check", by: SHOP },
  ],
  quality_check: [
    { to: "service_in_progress", by: GARAGE }, // QC failed -> rework
    { to: "ready_for_delivery", by: GARAGE },
  ],
  ready_for_delivery: [{ to: "completed", by: GARAGE }, { to: "disputed", by: ["customer", "support"] }],
  completed: [{ to: "disputed", by: ["customer", "support", "admin"] }], // complaint after completion
  cancelled: [],
  disputed: [{ to: "completed", by: ["support", "admin"] }, { to: "cancelled", by: ["support", "admin"] }],
};

export function canTransition(from: BookingStatus, to: BookingStatus, actor: Actor): boolean {
  return T[from].some((e) => e.to === to && e.by.includes(actor));
}

export function assertTransition(from: BookingStatus, to: BookingStatus, actor: Actor): void {
  if (!canTransition(from, to, actor)) throw new Error(`Transition ${from} -> ${to} not allowed for ${actor}`);
}

export const nextStatuses = (from: BookingStatus, actor: Actor) =>
  T[from].filter((e) => e.by.includes(actor)).map((e) => e.to);

export const isTerminal = (s: BookingStatus) => s === "cancelled";
