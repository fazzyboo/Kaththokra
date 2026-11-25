import "server-only";

/*
  Dhaka time helpers (UTC+6, no DST). Day/month boundaries for dealer stats and ledgers.
*/

const OFFSET_MS = 6 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Start of the Dhaka calendar day containing `d`, as a UTC Date. */
export function dhakaDayStart(d = new Date()): Date {
  const local = d.getTime() + OFFSET_MS;
  return new Date(Math.floor(local / DAY_MS) * DAY_MS - OFFSET_MS);
}

/** Start of the Dhaka calendar month containing `d`, as a UTC Date. */
export function dhakaMonthStart(d = new Date()): Date {
  const local = new Date(d.getTime() + OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - OFFSET_MS);
}

/** "YYYY-MM" in Dhaka time. */
export function dhakaMonth(d = new Date()): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 7);
}

/** "YYYY-MM-DD" in Dhaka time. */
export function dhakaDate(d = new Date()): string {
  return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Next 07:00 Asia/Dhaka strictly after `d` (today's if it's still before 07:00 there). */
export function nextDhaka0700(d = new Date()): Date {
  const today7 = new Date(dhakaDayStart(d).getTime() + 7 * 60 * 60 * 1000);
  return d < today7 ? today7 : new Date(today7.getTime() + DAY_MS);
}

/** Hour of day (0–23) in Asia/Dhaka. */
export function dhakaHour(d = new Date()): number {
  return new Date(d.getTime() + OFFSET_MS).getUTCHours();
}

export { DAY_MS };
