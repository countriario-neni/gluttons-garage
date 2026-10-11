import { cn } from "cn";

/** Grid of table-number buttons 1..count. */
export function TableGrid({ count, selected, onPick }: { count: number; selected?: number | null; onPick: (t: number) => void }) {
  return (
    <ul className="grid grid-cols-5 gap-2 sm:gap-3">
      {Array.from({ length: count }, (_, i) => i + 1).map((t) => (
        <li key={t}>
          <button
            type="button"
            aria-label={`Table ${t}`}
            aria-pressed={selected === t}
            onClick={() => onPick(t)}
            className={cn(
              "grid aspect-square w-full min-h-11 place-items-center rounded-xl border-2 font-[family-name:var(--font-display)] text-xl font-bold transition-[background-color,border-color,color,transform] active:scale-95",
              selected === t
                ? "border-primary bg-primary text-primary-foreground shadow-card"
                : "border-border bg-card text-primary hover:border-primary",
            )}
          >
            {t}
          </button>
        </li>
      ))}
    </ul>
  );
}
