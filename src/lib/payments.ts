import { createHmac, timingSafeEqual } from "node:crypto";

/** Verify a provider webhook signature (HMAC-SHA256 hex over the raw body). */
export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type IntegrationMode = "live" | "sandbox" | "unavailable";

/** Honest integration status. Never report "live" without real credentials. */
export function paymentMode(env: Record<string, string | undefined>): IntegrationMode {
  const p = env.PAYMENT_PROVIDER;
  if (p === "razorpay" && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) return "live";
  if (p === "sandbox" || !p) return "sandbox";
  return "unavailable";
}

export const cameraMode = (env: Record<string, string | undefined>): IntegrationMode =>
  env.VIDEO_PROVIDER ? "live" : "unavailable";
