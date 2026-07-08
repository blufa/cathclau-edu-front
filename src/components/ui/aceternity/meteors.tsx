import { cn } from "@/lib/utils";

/** Deterministic pseudo-random in [0,1) from an integer seed (keeps render pure + SSR-stable). */
function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Aceternity UI — Meteors.
 * Decorative shooting-star streaks; place inside a relative, overflow-hidden container.
 * Positions/timings are derived deterministically from each index so render stays pure.
 */
export function Meteors({ number = 16, className }: { number?: number; className?: string }) {
  const meteors = Array.from({ length: number }, (_, idx) => ({
    left: `${Math.floor(seeded(idx) * 100)}%`,
    animationDelay: `${(seeded(idx + 100) * 2).toFixed(2)}s`,
    animationDuration: `${(seeded(idx + 200) * 4 + 4).toFixed(2)}s`,
  }));

  return (
    <>
      {meteors.map((m, idx) => (
        <span
          key={idx}
          className={cn(
            "pointer-events-none absolute top-0 left-1/2 h-0.5 w-0.5 rotate-[215deg] rounded-full bg-brand-400 shadow-[0_0_0_1px_#ffffff10]",
            "before:absolute before:top-1/2 before:h-px before:w-[50px] before:-translate-y-1/2 before:bg-gradient-to-r before:from-brand-400 before:to-transparent before:content-['']",
            "animate-meteor",
            className,
          )}
          style={m}
        />
      ))}
    </>
  );
}
