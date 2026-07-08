"use client";

import { useState } from "react";
import { Button, Checkbox, Group, Stack, Text } from "@mantine/core";
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
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Cochez les matières à créer. Celles déjà présentes sont grisées. Le coefficient se définit
        ensuite à l&apos;affectation en classe et par évaluation.
      </Text>
      {SUBJECT_CATALOG_BY_CYCLE.map((group) => (
        <div key={group.cycle}>
          <Text fw={600} size="sm" mb={6}>
            {group.cycle}
          </Text>
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
