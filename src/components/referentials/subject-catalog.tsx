"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { createSubject } from "@/lib/api/academics";
import type { Matiere } from "@/lib/types/academics";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { SUBJECT_CATALOG, SUBJECT_CATALOG_BY_CYCLE } from "@/lib/academics-subjects";

/**
 * Sélecteur de matières depuis le catalogue prédéfini : l'utilisateur coche les matières à créer
 * (coefficient commun appliqué, modifiable ensuite). Les matières déjà présentes sont grisées.
 */
export function SubjectCatalogPicker({
  existing,
  onDone,
  onCancel,
}: {
  existing: Matiere[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const existingLabels = new Set(existing.map((m) => m.label.trim().toLowerCase()));

  function toggle(label: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  async function handleAdd() {
    const toCreate = SUBJECT_CATALOG.filter((s) => selected.has(s) && !existingLabels.has(s.trim().toLowerCase()));
    if (toCreate.length === 0) {
      onCancel();
      return;
    }
    setSaving(true);
    try {
      for (const label of toCreate) {
        // Coefficient par défaut (1) : il se règle à l'affectation en classe et par évaluation.
        await createSubject(label, 1);
      }
      notifySuccess(`${toCreate.length} matière${toCreate.length > 1 ? "s créées" : " créée"}`);
      onDone();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Cochez les matières à créer. Celles déjà présentes sont grisées. Le coefficient se définit
        ensuite à l&apos;affectation en classe et par évaluation.
      </p>
      {SUBJECT_CATALOG_BY_CYCLE.map((group) => (
        <div key={group.cycle}>
          <p className="mb-1.5 text-sm font-semibold text-gray-700">{group.cycle}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {group.subjects.map((label) => {
              const already = existingLabels.has(label.trim().toLowerCase());
              return (
                <Checkbox
                  key={`${group.cycle}-${label}`}
                  label={already ? `${label} (déjà créée)` : label}
                  checked={already || selected.has(label)}
                  disabled={already || saving}
                  onChange={() => toggle(label)}
                />
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>Annuler</Button>
        <Button onClick={handleAdd} loading={saving} disabled={selected.size === 0}>Ajouter la sélection</Button>
      </div>
    </div>
  );
}
