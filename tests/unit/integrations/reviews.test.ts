import { expect, it } from "vitest";
import { items } from "@/data/menu";
import { sampleReviews } from "@/integrations/reviews/sample";

it("has 6 first-name-only sample reviews about real menu dishes", () => {
  expect(sampleReviews).toHaveLength(6);
  const names = new Set(items.map((i) => i.name));
  for (const r of sampleReviews) {
    expect(r.isSample).toBe(true);
    expect([4, 5]).toContain(r.rating);
    expect(r.name).not.toMatch(/\s/);
    expect(names.has(r.dish)).toBe(true);
    expect(r.text.length).toBeLessThan(160);
  }
  expect(new Set(sampleReviews.map((r) => r.id)).size).toBe(6);
});
