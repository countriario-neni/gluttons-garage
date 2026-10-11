import { describe, it, expect } from "vitest";
import { takeawaySlots, openStatus } from "@/domain/slots";
import { cafe } from "@/data/cafe";

const h = cafe.hours;
const tue = (hh: number, mm = 0) => new Date(2026, 9, 13, hh, mm); // Tue 13 Oct 2026
const mon = (hh: number, mm = 0) => new Date(2026, 9, 12, hh, mm);

describe("takeawaySlots", () => {
  it("first slot >= now + 20min rounded up to 15", () => {
    expect(takeawaySlots(tue(12, 3), h)[0]).toBe("12:30"); // 12:23 -> 12:30
    expect(takeawaySlots(tue(12, 10), h)[0]).toBe("12:30"); // exactly 12:30
    expect(takeawaySlots(tue(12, 11), h)[0]).toBe("12:45");
  });
  it("last slot <= close (Tue 22:00)", () => {
    const s = takeawaySlots(tue(12, 0), h);
    expect(s[s.length - 1]).toBe("22:00");
  });
  it("Monday last slot <= 20:30", () => {
    const s = takeawaySlots(mon(12, 0), h);
    expect(s[s.length - 1]).toBe("20:30");
  });
  it("no slots at 21:50 Tue", () => expect(takeawaySlots(tue(21, 50), h)).toEqual([]));
  it("before opening starts from open + prep", () => {
    expect(takeawaySlots(tue(6, 0), h)[0]).toBe("08:30");
  });
  it("after close, none", () => expect(takeawaySlots(tue(23, 0), h)).toEqual([]));
  it("slots are 15 min apart", () => {
    expect(takeawaySlots(tue(20, 0), h)).toEqual(["20:30", "20:45", "21:00", "21:15", "21:30", "21:45", "22:00"]);
  });
});

describe("openStatus", () => {
  it("open", () => expect(openStatus(tue(12), h)).toEqual({ open: true, label: "Open · closes 10:00 PM" }));
  it("Monday closes 8:30 PM", () => expect(openStatus(mon(12), h).label).toBe("Open · closes 8:30 PM"));
  it("closed after close shows the next day opening", () => {
    expect(openStatus(tue(22, 0), h)).toEqual({ open: false, label: "Closed · opens 8:00 AM" });
    expect(openStatus(mon(21, 0), h)).toEqual({ open: false, label: "Closed · opens 8:00 AM" });
  });
  it("closed before open shows today opening", () => expect(openStatus(tue(7, 0), h)).toEqual({ open: false, label: "Closed · opens 8:00 AM" }));
});
