import Link from "next/link";
import type { MenuItem } from "@/data/menu";
import { formatINR } from "@/domain/money";
import { imageForSrc } from "@/lib/images";
import { dietOf } from "@/lib/menu";
import { DietMark } from "./primitives/DietMark";
import { DishPlaceholder } from "./primitives/DishPlaceholder";
import { Picture } from "./primitives/Picture";

/** Rail card for the home page: photo (or branded placeholder), name, price; links to the dish on /menu/. */
export function DishCard({ item }: { item: MenuItem }) {
  const img = item.image ? imageForSrc(item.image) : undefined;
  const diet = dietOf(item);
  return (
    <Link
      href={`/menu/#${item.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-card transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {img ? (
          <Picture
            img={img}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 78vw"
            className="size-full object-cover object-[50%_70%] transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <DishPlaceholder name={item.name} className="size-full" />
        )}
        {item.tags.includes("Bestseller") && (
          <span className="absolute top-3 left-3 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground shadow-card">
            Bestseller
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="text-xl leading-snug font-bold text-primary">{item.name}</h3>
        {item.description && <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>}
        <div className="mt-auto flex items-center justify-between pt-3">
          {diet ? <DietMark diet={diet} /> : <span />}
          <span className="text-lg font-bold">{formatINR(item.price)}</span>
        </div>
      </div>
    </Link>
  );
}
