const IST_OFFSET_MIN = 330;

/**
 * A Date whose local fields (getDay/getHours/...) read as wall-clock time in Visakhapatnam (IST),
 * whatever the visitor's timezone. Feed it to openStatus / takeawaySlots.
 */
export function cafeNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + (IST_OFFSET_MIN + now.getTimezoneOffset()) * 60_000);
}
