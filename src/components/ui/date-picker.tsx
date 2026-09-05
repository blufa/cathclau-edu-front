"use client";

import Flatpickr from "react-flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function fromISO(v?: string): Date | string {
  if (!v) return "";
  const d = new Date(`${v}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : d;
}

interface DatePickerProps {
  /** Valeur au format ISO (`YYYY-MM-DD`). Affichage jj/mm/aaaa. */
  value?: string;
  onChange?: (value: string) => void;
  maxDate?: Date;
  minDate?: Date;
  clearable?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** Sélecteur de date Tailwind (flatpickr) — remplace Mantine `DatePickerInput`, même sémantique ISO. */
export function DatePicker({ value, onChange, maxDate, minDate, clearable, placeholder = "jj/mm/aaaa", disabled, className }: DatePickerProps) {
  return (
    <div className="relative">
      <Flatpickr
        value={fromISO(value)}
        options={{ dateFormat: "d/m/Y", maxDate, minDate, disableMobile: true }}
        onChange={(dates: Date[]) => onChange?.(dates[0] ? toISO(dates[0]) : "")}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          "h-11 w-full rounded-lg border border-gray-300 bg-white pl-4 pr-10 text-sm text-gray-800 shadow-theme-xs outline-none transition placeholder:text-gray-400",
          "hover:border-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10",
          "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400",
          className,
        )}
      />
      <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      {clearable && value && !disabled && (
        <button
          type="button"
          onClick={() => onChange?.("")}
          className="absolute right-9 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
          aria-label="Effacer la date"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
