"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { createLevel } from "@/lib/api/academics";
import type { Niveau } from "@/lib/types/academics";
import { notifyError, notifySuccess } from "@/lib/feedback";

/**
 * Catalogue des niveaux (classes d'âge/grades) du système guinéen, groupés par cycle d'enseignement.
 * Un « niveau » est un grade précis (Petite Section, 7ème, Terminale…) ; le « cycle » (Maternelle,
 * Primaire, Collège, Lycée…) est l'attribut qui le classe — PS/MS/GS ne sont PAS des cycles, ce sont
 * des niveaux du cycle MATERNELLE. Les classes concrètes (« 6ème A », « 7ème A »…) se créent ensuite
 * et se rattachent à un niveau. L'utilisateur coche les niveaux à créer plutôt que de les saisir un
 * par un. La Maternelle est composée de ses 3 sections réelles (Petite/Moyenne/Grande Section) plutôt
 * qu'un niveau générique unique — chacune est créée avec le cycle MATERNELLE, qui déclenche le badge
 * de retrait obligatoire. La Garderie n'appartient pas à la progression pédagogique de la Maternelle
 * (pas de PS/MS/GS) : elle a son propre cycle GARDERIE, qui déclenche la même sécurité de retrait. Le
 * secondaire est composé de deux cycles distincts (Collège 7ème-10ème, Lycée 11ème-Terminale), chacun
 * avec ses propres niveaux — pas un niveau générique unique « Secondaire ».
 */
export const LEVEL_CATALOG: { label: string; cycle: string }[] = [
  { label: "Garderie", cycle: "GARDERIE" },
  { label: "Petite Section", cycle: "MATERNELLE" },
  { label: "Moyenne Section", cycle: "MATERNELLE" },
  { label: "Grande Section", cycle: "MATERNELLE" },
  { label: "Cours d'Initiation (CI)", cycle: "PRIMAIRE" },
  { label: "Cours Préparatoire (CP)", cycle: "PRIMAIRE" },
  { label: "Cours Élémentaire 1 (CE1)", cycle: "PRIMAIRE" },
  { label: "Cours Élémentaire 2 (CE2)", cycle: "PRIMAIRE" },
  { label: "Cours Moyen 1 (CM1)", cycle: "PRIMAIRE" },
  { label: "Cours Moyen 2 (CM2)", cycle: "PRIMAIRE" },
  { label: "7ème", cycle: "COLLEGE" },
  { label: "8ème", cycle: "COLLEGE" },
  { label: "9ème", cycle: "COLLEGE" },
  { label: "10ème", cycle: "COLLEGE" },
  { label: "11ème", cycle: "LYCEE" },
  { label: "12ème", cycle: "LYCEE" },
  { label: "Terminale", cycle: "LYCEE" },
  { label: "Supérieur", cycle: "SUPERIEUR" },
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
