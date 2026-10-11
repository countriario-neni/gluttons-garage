import { cn } from "cn";

type Props = {
  /** "maroon" on light surfaces, "cream" on dark ones. */
  tone?: "maroon" | "cream";
  className?: string;
};

/**
 * Typographic redraw of the Gluttons Garage logo: "GLUTTONS" in a heavy flared retro serif,
 * "garage" in a small rounded lowercase sans tucked beneath, framed by Garage Orange ring arcs.
 * Size it with font-size on className (the lockup scales in em).
 */
export function Wordmark({ tone = "maroon", className }: Props) {
  return (
    <span
      className={cn(
        "relative inline-flex flex-col items-center leading-none select-none",
        tone === "maroon" ? "text-primary" : "text-cream",
        className,
      )}
    >
      <span className="font-[family-name:var(--font-wordmark)] text-[1em] tracking-[0.02em]">GLUTTONS</span>
      <span className="mt-[0.06em] flex items-center gap-[0.22em] self-end pr-[0.35em]">
        <span aria-hidden="true" className="h-[0.07em] w-[0.9em] rounded-full bg-orange" />
        <span className="font-[family-name:var(--font-wordmark-sub)] text-[0.5em] font-extrabold tracking-[0.04em] lowercase">
          garage
        </span>
        <span aria-hidden="true" className="size-[0.16em] rounded-full border-[0.05em] border-orange" />
      </span>
    </span>
  );
}
