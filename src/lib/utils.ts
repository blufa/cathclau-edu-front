import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combine class names with clsx and resolve Tailwind conflicts with tailwind-merge.
 * This is the canonical `cn` helper expected by every Aceternity UI component.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
