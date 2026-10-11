import type { Cafe } from "@/data/cafe";

type Hours = Cafe["hours"];

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const pad = (n: number) => String(n).padStart(2, "0");
const fmt24 = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const fmt12 = (hhmm: string): string => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
};
const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 + d.getMilliseconds() / 60000;

/** Takeaway slots ("HH:MM", local time) for the rest of today, within opening hours. */
export function takeawaySlots(now: Date, hours: Hours, slotMinutes = 15, prepMinutes = 20): string[] {
  const today = hours[now.getDay()];
  if (!today) return [];
  const open = toMin(today.open);
  const close = toMin(today.close);
  const earliest = Math.max(minutesOfDay(now), open) + prepMinutes;
  const first = Math.ceil(earliest / slotMinutes) * slotMinutes;
  const slots: string[] = [];
  for (let t = first; t <= close; t += slotMinutes) slots.push(fmt24(t));
  return slots;
}

export function openStatus(now: Date, hours: Hours): { open: boolean; label: string } {
  const today = hours[now.getDay()];
  const m = minutesOfDay(now);
  if (today && m >= toMin(today.open) && m < toMin(today.close)) {
    return { open: true, label: `Open · closes ${fmt12(today.close)}` };
  }
  const next = today && m < toMin(today.open) ? today : hours[(now.getDay() + 1) % 7];
  return { open: false, label: next ? `Closed · opens ${fmt12(next.open)}` : "Closed" };
}
