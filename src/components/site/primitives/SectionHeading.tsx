import { cn } from "cn";
import type { ReactNode } from "react";
import { Gear } from "./Gear";

type Props = {
  id?: string;
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  /** On dark (ink) sections. */
  inverted?: boolean;
  className?: string;
};

export function SectionHeading({ id, eyebrow, title, lede, align = "left", inverted = false, className }: Props) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <p
        className={cn(
          "inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em]",
          inverted ? "text-orange" : "text-primary",
        )}
      >
        <Gear className="size-4 text-orange" strokeWidth={6} />
        {eyebrow}
      </p>
      <h2
        id={id}
        className={cn(
          "mt-3 text-[2rem] leading-[1.1] font-bold text-balance sm:text-[2.75rem]",
          inverted ? "text-cream" : "text-primary",
        )}
      >
        {title}
      </h2>
      {lede && (
        <p className={cn("mt-4 text-lg leading-relaxed text-pretty", inverted ? "text-kitchen-soft" : "text-muted-foreground")}>
          {lede}
        </p>
      )}
    </div>
  );
}
