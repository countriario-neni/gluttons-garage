import { cn } from "cn";
import { Gear } from "./Gear";

/** Branded stand-in for dishes without a real photo: checker corner, gear and the dish initial. */
export function DishPlaceholder({ name, className, small = false }: { name: string; className?: string; small?: boolean }) {
  const initial = name.trim().charAt(0).toUpperCase();
  return (
    <div aria-hidden="true" className={cn("relative grid place-items-center overflow-hidden bg-secondary", className)}>
      <div className="checker absolute top-0 right-0 h-1/2 w-1/2 opacity-10 [--checker:8px] [mask-image:linear-gradient(225deg,black_20%,transparent_70%)]" />
      <Gear className={cn("absolute text-line", small ? "-bottom-4 -left-4 size-14" : "-bottom-8 -left-8 size-32")} strokeWidth={3} />
      <span
        className={cn(
          "relative grid aspect-square place-items-center rounded-full border-2 border-orange bg-card font-[family-name:var(--font-wordmark)] text-primary",
          small ? "size-11 text-xl" : "size-20 text-4xl",
        )}
      >
        {initial}
      </span>
    </div>
  );
}
