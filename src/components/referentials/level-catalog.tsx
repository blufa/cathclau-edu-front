"use client";

import { useState } from "react";
import { Button, Checkbox, Group, Stack, Text } from "@mantine/core";
import { createLevel } from "@/lib/api/academics";
import type { Niveau } from "@/lib/types/academics";
import { notifyError, notifySuccess } from "@/lib/feedback";

/**
 * Catalogue des niveaux (cycles) du système guinéen. Un « niveau » désigne le cycle d'enseignement ;
 * les classes concrètes (« 6ème A », « 7ème A »…) se créent ensuite et se rattachent à un niveau.
 * L'utilisateur coche les cycles à créer plutôt que de les saisir un par un.
 */
export const LEVEL_CATALOG: string[] = ["Maternelle", "Primaire", "Secondaire", "Supérieur"];

/**
 * Sélecteur de niveaux depuis le catalogue prédéfini. Crée les cycles cochés non encore présents
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
    // On ne crée que les cycles non encore présents, dans l'ordre du catalogue (progression cohérente).
    const toCreate = LEVEL_CATALOG.filter((l) => selected.has(l) && !existingLabels.has(l.trim().toLowerCase()));
    if (toCreate.length === 0) {
      onCancel();
      return;
    }
    let order = existing.reduce((m, l) => Math.max(m, l.sortOrder), 0) + 1;
    setSaving(true);
    try {
      const created: Niveau[] = [];
      for (const label of toCreate) {
        created.push(await createLevel(label, order++));
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
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Cochez les cycles à créer. Ceux déjà présents sont grisés. Les classes (« 6ème A », « 7ème A »…)
        se créent ensuite et se rattachent à un niveau.
      </Text>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {LEVEL_CATALOG.map((label) => {
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
      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel} disabled={saving}>
          Annuler
        </Button>
        <Button onClick={handleAdd} loading={saving} disabled={selected.size === 0}>
          Ajouter la sélection
        </Button>
      </Group>
    </Stack>
  );
}
