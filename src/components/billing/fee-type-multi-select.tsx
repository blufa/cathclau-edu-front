"use client";

import { useState } from "react";
import { FEE_TYPE_LABEL, type FeeType } from "@/lib/types/billing";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/input";

/**
 * Sélection des frais concernés par une règle de remise (réduction familiale, avantage personnel,
 * exonération) : un seul type, plusieurs à la fois, ou tous. `value` vide/null = tous les frais.
 */
export function FeeTypeMultiSelect({
  value, onChange,
}: {
  value: FeeType[] | null | undefined;
  onChange: (v: FeeType[]) => void;
}) {
  const selected = value ?? [];
  const [mode, setMode] = useState<"ALL" | "SPECIFIC">(selected.length === 0 ? "ALL" : "SPECIFIC");

  function toggle(type: FeeType) {
    onChange(selected.includes(type) ? selected.filter((t) => t !== type) : [...selected, type]);
  }

  return (
    <div className="space-y-2">
      <Label>Frais concernés</Label>
      <div className="rounded-lg border border-gray-200 p-2">
        <Checkbox
          label="Tous les frais"
          checked={mode === "ALL"}
          onChange={(e) => {
            const checked = e.target.checked;
            setMode(checked ? "ALL" : "SPECIFIC");
            if (checked) onChange([]);
          }}
        />
        {mode === "SPECIFIC" && (
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 pl-1">
            {(Object.entries(FEE_TYPE_LABEL) as [FeeType, string][]).map(([type, label]) => (
              <Checkbox key={type} label={label} checked={selected.includes(type)} onChange={() => toggle(type)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
