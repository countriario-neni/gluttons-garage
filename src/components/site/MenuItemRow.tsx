import { memo } from "react";
import type { MenuItem } from "@/data/menu";
import { formatINR } from "@/domain/money";
import { imageForSrc } from "@/lib/images";
import { dietOf } from "@/lib/menu";
import { orderHref } from "./links";
import { DietMark } from "./primitives/DietMark";
import { DishPlaceholder } from "./primitives/DishPlaceholder";
import { Picture } from "./primitives/Picture";

const round = (n: number) => Math.round(n * 10) / 10;

/** One dish on /menu/: text-forward row with a square thumbnail (photo or branded placeholder). */
export const MenuItemRow = memo(function MenuItemRow({ item }: { item: MenuItem }) {
  const img = item.image ? imageForSrc(item.image) : undefined;
  const diet = dietOf(item);
  const n = item.nutrition;
  return (
    <article id={item.id} className="flex scroll-mt-72 gap-4 sm:scroll-mt-60 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {diet && <DietMark diet={diet} />}
          {item.tags.map((t) => (
            <span
              key={t}
              className={
                t === "Bestseller"
                  ? "rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground"
                  : "rounded-full border border-primary/30 px-2 py-0.5 text-xs font-bold text-primary"
              }
            >
              {t}
            </span>
          ))}
        </div>
        <h3 className="mt-2 text-lg leading-snug font-bold text-primary">{item.name}</h3>
        {item.description && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>}
        {n && (
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-bold text-foreground">{Math.round(n.kcal)} kcal</span> · Protein {round(n.protein)} g · Carbs{" "}
            {round(n.carbs)} g · Fat {round(n.fat)} g
          </p>
        )}
        <div className="mt-3 flex items-center gap-4">
          <span className="text-lg font-bold">{formatINR(item.price)}</span>
          <a
            href={orderHref}
            aria-label={`Order ${item.name}`}
            className="inline-flex h-11 items-center rounded-full border-2 border-primary px-4 text-sm font-bold text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            Order
          </a>
        </div>
      </div>
      <div className="size-24 shrink-0 overflow-hidden rounded-xl sm:size-28">
        {img ? (
          <Picture img={img} sizes="112px" className="size-full object-cover" />
        ) : (
          <DishPlaceholder name={item.name} small className="size-full" />
        )}
      </div>
    </article>
  );
});
