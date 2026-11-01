const TZ = "Asia/Kolkata";

const dt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: TZ, ...o });

export const fmtDate = (v: string | Date | null | undefined) =>
  v ? dt({ day: "numeric", month: "short", year: "numeric" }).format(new Date(v)) : "—";

export const fmtDateTime = (v: string | Date | null | undefined) =>
  v ? dt({ day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(v)) : "—";

export const fmtTime = (v: string | Date | null | undefined) =>
  v ? dt({ hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(v)) : "—";

export const fmtDayLabel = (ymd: string) =>
  dt({ weekday: "short", day: "numeric", month: "short" }).format(new Date(`${ymd}T06:00:00Z`));

export const fmtKm = (km: number | null | undefined) =>
  km == null ? "—" : `${km.toLocaleString("en-IN")} km`;

export function fmtRelative(v: string | Date | null | undefined, now = new Date()): string {
  if (!v) return "—";
  const then = new Date(v).getTime();
  const diff = Math.round((then - now.getTime()) / 1000);
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.trunc(diff), "second");
  if (abs < 3600) return rtf.format(Math.trunc(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.trunc(diff / 3600), "hour");
  if (abs < 2592000) return rtf.format(Math.trunc(diff / 86400), "day");
  return fmtDate(v);
}

/** Phone shown in the Indian grouping, left as entered if it is not 10 digits. */
export function fmtPhone(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = raw.replace(/\D/g, "");
  const ten = d.length > 10 ? d.slice(-10) : d;
  return ten.length === 10 ? `${ten.slice(0, 5)} ${ten.slice(5)}` : raw;
}

export const titleCase = (s: string) =>
  s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const sentence = (s: string) => {
  const t = s.replace(/[_-]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
};

export const initials = (name: string | null | undefined) =>
  (name ?? "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
