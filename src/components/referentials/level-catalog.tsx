"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { createLevel } from "@/lib/api/academics";
import type { Niveau } from "@/lib/types/academics";
import { notifyError, notifySuccess } from "@/lib/feedback";

/**
 * Catalogue des niveaux : exactement 3 valeurs fixes (Maternelle, Primaire, Secondaire), pour rester
 * simple pour un personnel non technique. Secondaire fusionne Collège et Lycée. La Garderie fusionne
 * dans Maternelle et le Supérieur n'est plus un niveau du catalogue. La précision pédagogique fine
 * (Petite Section, CP1, 7ème, Terminale…) n'est plus portée par le niveau mais par la classe
 * elle-même (champ `grade`, voir `src/lib/academics-grades.ts` et `class-form.tsx`).
 *
 * Le niveau "Secondaire" est créé avec `cycle=COLLEGE` par convention (pas de valeur SECONDAIRE
 * dédiée dans l'enum backend `SchoolCycle`, qui reste à 6 valeurs pour les périodes/le catalogue
 * MEPUA — seule la distinction Collège/Lycée nécessaire à ces usages est désormais dérivée du
 * `grade` de la classe, plus du niveau).
 */
export const LEVEL_CATALOG: { label: string; cycle: string }[] = [
  { label: "Maternelle", cycle: "MATERNELLE" },
  { label: "Primaire", cycle: "PRIMAIRE" },
  { label: "Secondaire", cycle: "COLLEGE" },
];

/**
 * Sélecteur de niveaux depuis le catalogue prédéfini. Crée les niveaux cochés non encore présents
 * (ordre séquentiel cohérent) et renvoie les niveaux créés via {@code onDone}.
 */
export function LevelCatalogPicker({
  existing,
  onDone,
  onCancel,
}: {
  existing: Niveau[];
  onDone: (created: Niveau[]) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const existingLabels = new Set(existing.map((l) => l.label.trim().toLowerCase()));

  function toggle(label: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  async function handleAdd() {
    // On ne crée que les niveaux non encore présents, dans l'ordre du catalogue (progression cohérente).
    const toCreate = LEVEL_CATALOG.filter((l) => selected.has(l.label) && !existingLabels.has(l.label.trim().toLowerCase()));
    if (toCreate.length === 0) {
      onCancel();
      return;
    }
    let order = existing.reduce((m, l) => Math.max(m, l.sortOrder), 0) + 1;
    setSaving(true);
    try {
      const created: Niveau[] = [];
      for (const { label, cycle } of toCreate) {
        created.push(await createLevel(label, order++, cycle));
      }
      notifySuccess(`${created.length} niveau${created.length > 1 ? "x" : ""} créé${created.length > 1 ? "s" : ""}`);
      onDone(created);
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Cochez les niveaux à créer. Ceux déjà présents sont grisés. Les classes (« 6ème A », « 7ème A »…)
        se créent ensuite et se rattachent à un niveau.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {LEVEL_CATALOG.map(({ label }) => {
          const already = existingLabels.has(label.trim().toLowerCase());
          return (
            <Checkbox
              key={label}
              label={already ? `${label} (déjà créé)` : label}
              checked={already || selected.has(label)}
              disabled={already || saving}
              onChange={() => toggle(label)}
            />
          );
        })}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>Annuler</Button>
        <Button onClick={handleAdd} loading={saving} disabled={selected.size === 0}>Ajouter la sélection</Button>
      </div>
    </div>
  );
}
