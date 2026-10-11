import { cn } from "cn";

/** Black-and-cream checkerboard strip, after the cafe floor. Decorative section divider. */
export function Checkerband({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("checker h-6 w-full [--checker:12px]", className)} />;
}
