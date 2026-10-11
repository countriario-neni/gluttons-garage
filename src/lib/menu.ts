import type { MenuItem } from "@/data/menu";

export type Diet = "veg" | "egg" | "non-veg";

/** Diet mark as printed on the menu; null when the menu doesn't say. Meat wins over egg. */
export function dietOf(item: Pick<MenuItem, "veg" | "egg">): Diet | null {
  if (item.veg === false) return "non-veg";
  if (item.egg === true) return "egg";
  if (item.veg === true) return "veg";
  return null;
}

export const dietLabel: Record<Diet, string> = { veg: "Veg", egg: "Contains egg", "non-veg": "Non-veg" };

/** Case-insensitive match of every search word against name + description; optional veg-only. */
export function filterMenu<T extends MenuItem>(items: T[], { query = "", vegOnly = false }: { query?: string; vegOnly?: boolean }): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((i) => {
    if (vegOnly && dietOf(i) !== "veg") return false;
    if (!words.length) return true;
    const hay = `${i.name} ${i.description ?? ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Bestsellers and pictured dishes: photographed bestsellers, then other photos, then remaining bestsellers. */
export function guestFavourites<T extends MenuItem>(items: T[]): T[] {
  const best = (i: T) => i.tags.includes("Bestseller");
  return [
    ...items.filter((i) => i.image && best(i)),
    ...items.filter((i) => i.image && !best(i)),
    ...items.filter((i) => !i.image && best(i)),
  ];
}
