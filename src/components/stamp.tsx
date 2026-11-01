import { BadgeCheck, ShieldCheck, Signature } from "lucide-react";
import { fmtDate } from "@/lib/format";
import { cx } from "./ui";

/**
 * The verification stamp. Drawn like a workshop calibration label, and it cannot be
 * rendered without the date it was issued — which is what makes it worth trusting.
 */

export type Level = "none" | "listed" | "verified" | "quality_assured";

export const LEVEL_NAME: Record<Level, string> = {
  none: "Not verified",
  listed: "Listed",
  verified: "Verified",
  quality_assured: "Quality-Assured",
};

export const LEVEL_MEANS: Record<Level, string> = {
  none: "This garage has not completed a MEQIVA check.",
  listed: "Identity, ownership and contact details were checked by MEQIVA.",
  verified: "A MEQIVA auditor inspected the workshop and its documents in person.",
  quality_assured: "The workshop met MEQIVA's higher operational and quality criteria, reassessed periodically.",
};

const STYLE: Record<Exclude<Level, "none">, { box: string; icon: typeof BadgeCheck }> = {
  listed: { box: "text-ink2", icon: Signature },
  verified: { box: "text-success", icon: BadgeCheck },
  quality_assured: { box: "text-warn", icon: ShieldCheck },
};

export function Stamp({ level, verifiedAt, expiresAt, size = "sm" }: {
  level: Level; verifiedAt?: string | null; expiresAt?: string | null; size?: "sm" | "lg";
}) {
  if (level === "none") {
    return <span className="text-xs text-ink2">{LEVEL_NAME.none}</span>;
  }
  const s = STYLE[level];
  const Icon = s.icon;
  const lapsed = expiresAt ? new Date(expiresAt) < new Date() : false;

  if (size === "sm") {
    return (
      <span
        title={`${LEVEL_MEANS[level]}${verifiedAt ? ` Checked ${fmtDate(verifiedAt)}.` : ""}`}
        className={cx("inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium",
          lapsed ? "border-line text-ink2" : cx("border-current/35", s.box))}>
        <Icon className="h-3 w-3" aria-hidden />
        {LEVEL_NAME[level]}
        {lapsed && <span className="text-ink2">(lapsed)</span>}
      </span>
    );
  }

  return (
    <div className={cx("inline-block rounded-card border-2 p-[3px]", lapsed ? "border-line text-ink2" : cx("border-current/30", s.box))}>
      <div className={cx("rounded-sm border border-dashed px-3 py-2", lapsed ? "border-line" : "border-current/40")}>
        <p className="flex items-center gap-1.5 text-sm font-semibold leading-none">
          <Icon className="h-4 w-4" aria-hidden />
          {LEVEL_NAME[level]}{lapsed && " — lapsed"}
        </p>
        <p className="tnum mt-1.5 text-[11px] leading-snug text-ink2">
          {verifiedAt ? `Checked ${fmtDate(verifiedAt)}` : "Check date not recorded"}
          {expiresAt && <><br />{lapsed ? "Lapsed" : "Valid to"} {fmtDate(expiresAt)}</>}
        </p>
      </div>
    </div>
  );
}

/** Used wherever the badge appears, so nobody mistakes it for a government mark. */
export const VerificationDisclaimer = () => (
  <p className="text-xs text-ink2">
    A MEQIVA inspection, not a government or manufacturer certification. Levels are set by audit and cannot be bought.
  </p>
);
