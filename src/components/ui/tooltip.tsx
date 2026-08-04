import { cn } from "@/lib/utils";

/** Info-bulle CSS pure (survol), utilisée surtout par la sidebar repliée (icônes seules). */
export function Tooltip({
  label,
  children,
  position = "right",
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  position?: "right" | "top";
}) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-theme-md transition-opacity delay-150 group-hover:opacity-100",
          position === "right" && "left-full top-1/2 ml-2 -translate-y-1/2",
          position === "top" && "bottom-full left-1/2 mb-2 -translate-x-1/2",
        )}
      >
        {label}
      </span>
    </span>
  );
}
