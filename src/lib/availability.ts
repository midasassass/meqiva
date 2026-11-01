/**
 * Slot generation. A slot is offered only if the workshop is open, it is not a
 * holiday, enough notice remains, and a bay is genuinely free for the whole
 * service duration. Never offer a slot that cannot be honoured.
 */

export type Day = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const DAYS: Day[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** IST is a fixed +05:30 offset with no daylight saving, so this is exact. */
export const IST_OFFSET = "+05:30";

export function istDate(ymd: string, hm = "00:00"): Date {
  const d = new Date(`${ymd}T${hm.slice(0, 5)}:00${IST_OFFSET}`);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid IST date: ${ymd} ${hm}`);
  return d;
}

/** The IST calendar day (YYYY-MM-DD) an instant falls on. */
export function istYmd(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(at);
}

export function istDayOfWeek(ymd: string): Day {
  return DAYS[istDate(ymd, "12:00").getUTCDay()]!;
}

export interface OpeningHours { day: Day; opens: string; closes: string; closed?: boolean }
export interface BusyInterval { start: Date; end: Date; bayId?: string | null }

export interface AvailabilityRules {
  slotMinutes: 15 | 30 | 60;
  bufferMinutes: number;
  minLeadMinutes: number;
  maxAdvanceDays: number;
  bays: number;
  concurrentPerBay: number;
  onlineBooking: boolean;
}

export interface Slot { start: Date; end: Date; free: number }

export interface SlotQuery {
  ymd: string;
  durationMinutes: number;
  hours: OpeningHours[];
  holidays: string[];
  busy: BusyInterval[];
  rules: AvailabilityRules;
  now: Date;
}

const MIN = 60_000;
const overlaps = (aS: Date, aE: Date, bS: Date, bE: Date) => aS < bE && aE > bS;

export function slotsForDay(q: SlotQuery): Slot[] {
  const { rules: r } = q;
  if (!r.onlineBooking) return [];
  if (q.holidays.includes(q.ymd)) return [];
  if (q.durationMinutes <= 0) return [];

  const todayYmd = istYmd(q.now);
  if (q.ymd < todayYmd) return [];
  const lastYmd = istYmd(new Date(q.now.getTime() + r.maxAdvanceDays * 1440 * MIN));
  if (q.ymd > lastYmd) return [];

  const day = istDayOfWeek(q.ymd);
  const open = q.hours.find((h) => h.day === day && !h.closed);
  if (!open) return [];

  const dayOpen = istDate(q.ymd, open.opens);
  const dayClose = istDate(q.ymd, open.closes);
  const earliest = new Date(q.now.getTime() + r.minLeadMinutes * MIN);
  const capacity = Math.max(1, r.bays) * Math.max(1, r.concurrentPerBay);
  const occupy = q.durationMinutes + r.bufferMinutes;

  const out: Slot[] = [];
  for (let t = dayOpen.getTime(); t + q.durationMinutes * MIN <= dayClose.getTime(); t += r.slotMinutes * MIN) {
    const start = new Date(t);
    if (start < earliest) continue;
    const end = new Date(t + q.durationMinutes * MIN);
    const blockEnd = new Date(t + occupy * MIN);
    const used = q.busy.filter((b) => overlaps(start, blockEnd, b.start, b.end)).length;
    if (used >= capacity) continue;
    out.push({ start, end, free: capacity - used });
  }
  return out;
}

/** The next `days` calendar days that have at least one slot. */
export function nextAvailableDays(q: Omit<SlotQuery, "ymd">, days = 14): { ymd: string; slots: Slot[] }[] {
  const out: { ymd: string; slots: Slot[] }[] = [];
  for (let i = 0; i < days; i++) {
    const ymd = istYmd(new Date(q.now.getTime() + i * 1440 * MIN));
    const slots = slotsForDay({ ...q, ymd });
    if (slots.length) out.push({ ymd, slots });
  }
  return out;
}

export const DEFAULT_HOURS: OpeningHours[] = [
  { day: "mon", opens: "09:30", closes: "19:00" },
  { day: "tue", opens: "09:30", closes: "19:00" },
  { day: "wed", opens: "09:30", closes: "19:00" },
  { day: "thu", opens: "09:30", closes: "19:00" },
  { day: "fri", opens: "09:30", closes: "19:00" },
  { day: "sat", opens: "09:30", closes: "19:00" },
  { day: "sun", opens: "10:00", closes: "14:00", closed: true },
];
