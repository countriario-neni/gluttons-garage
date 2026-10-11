"use client";

import { useSyncExternalStore } from "react";
import { cafeNow } from "@/lib/time";

const MINUTE = 60_000;

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, MINUTE / 4);
  return () => clearInterval(id);
}
const minuteNow = () => Math.floor(Date.now() / MINUTE);
const onServer = () => null;

/**
 * Cafe wall-clock time (IST), refreshed each minute. Null during prerender and hydration,
 * so time-dependent UI (open badge, today's hours) never mismatches the static HTML.
 */
export function useCafeClock(): Date | null {
  const minute = useSyncExternalStore(subscribe, minuteNow, onServer);
  return minute === null ? null : cafeNow(new Date(minute * MINUTE));
}
