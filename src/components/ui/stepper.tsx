"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperStep {
  label: string;
}

/** Indicateur d'étapes horizontal (remplace Mantine `Stepper`) pour les formulaires multi-étapes. */
export function Stepper({
  steps,
  active,
  onStepClick,
}: {
  steps: StepperStep[];
  active: number;
  onStepClick?: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {steps.map((step, i) => {
        const state = i < active ? "done" : i === active ? "current" : "upcoming";
        return (
          <div key={step.label} className="flex items-center">
            <button
              type="button"
              onClick={() => onStepClick?.(i)}
              disabled={!onStepClick}
              className="flex items-center gap-2 rounded-full py-1 pr-1 disabled:cursor-default"
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  state === "done" && "bg-brand-600 text-white",
                  state === "current" && "bg-brand-100 text-brand-700 ring-2 ring-brand-500",
                  state === "upcoming" && "bg-gray-100 text-gray-400",
                )}
              >
                {state === "done" ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={cn("whitespace-nowrap text-sm font-medium", state === "upcoming" ? "text-gray-400" : "text-gray-700")}>
                {step.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className={cn("mx-2 h-px w-6 shrink-0 sm:w-10", i < active ? "bg-brand-400" : "bg-gray-200")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
