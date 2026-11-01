/**
 * Effective feature set for a garage:
 *   platform flag  AND  subscription plan  AND  the garage's own switch.
 * Any layer can switch a feature off; none can switch on what the layer above forbids.
 */

export const GARAGE_FEATURES = [
  "marketplace_listing",
  "online_booking",
  "pickup_drop",
  "inventory",
  "purchase_orders",
  "crm",
  "reminders",
  "checklists",
  "custom_fields",
  "camera",
  "voice_job_card",
  "multi_branch",
  "fleet",
  "ai_insights",
  "whatsapp",
] as const;
export type GarageFeature = (typeof GARAGE_FEATURES)[number];

export type FeatureMap = Partial<Record<GarageFeature, boolean>>;

export interface FeatureInputs {
  /** Platform kill switches from `feature_flags`. Absent key means "not gated". */
  platform?: Record<string, boolean>;
  /** `subscription_plans.features`. Absent key means the plan does not include it. */
  plan?: FeatureMap;
  /** `garage_settings.features` — the garage's own preference. Absent means "use plan default". */
  garage?: FeatureMap;
  /** Subscription in a usable state. An expired plan drops to the free baseline. */
  subscriptionActive?: boolean;
}

/** Available on every plan, including after a subscription lapses, so a garage is never locked out of its own records. */
const BASELINE: GarageFeature[] = ["online_booking", "custom_fields", "checklists"];

/** Needs platform credentials; the platform flag is the gate. */
const PLATFORM_GATED: Partial<Record<GarageFeature, string>> = {
  camera: "camera_module",
  whatsapp: "whatsapp",
  ai_insights: "ai_insights",
};

export function resolveFeatures(i: FeatureInputs): Record<GarageFeature, boolean> {
  const out = {} as Record<GarageFeature, boolean>;
  for (const f of GARAGE_FEATURES) {
    const gate = PLATFORM_GATED[f];
    const platformOk = gate ? i.platform?.[gate] === true : true;
    const planOk = i.subscriptionActive === false
      ? BASELINE.includes(f)
      : (i.plan?.[f] ?? BASELINE.includes(f));
    const garageOk = i.garage?.[f] ?? true;
    out[f] = platformOk && planOk && garageOk;
  }
  return out;
}

export const featureLabels: Record<GarageFeature, string> = {
  marketplace_listing: "Marketplace listing",
  online_booking: "Online booking",
  pickup_drop: "Pickup and drop",
  inventory: "Parts and inventory",
  purchase_orders: "Purchase orders",
  crm: "Customer records",
  reminders: "Service reminders",
  checklists: "Inspection checklists",
  custom_fields: "Custom job card fields",
  camera: "Live service camera",
  voice_job_card: "Voice to job card",
  multi_branch: "Multiple branches",
  fleet: "Fleet accounts",
  ai_insights: "AI business questions",
  whatsapp: "WhatsApp messages",
};
