"use client";

import { useMemo, useState } from "react";
import { Button, Checkbox, Group, Select, Stack, Text, TextInput } from "@mantine/core";
import { assignClassSubject, createClass } from "@/lib/api/academics";
import type { Classe, Matiere, Niveau, Salle } from "@/lib/types/academics";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { SECTIONS, SERIES, composeClassLabel, gradeGroupsForCycle, gradeHasSeries, gradesForCycle } from "@/lib/academics-grades";
import { normalizeLabel, subjectsForCycle } from "@/lib/academics-subjects";

/**
 * Assistant : cycle → grade(s) → section(s) → crée toutes les classes correspondantes en une fois
 * (ex. « CP1 A », « CP1 B », « CE1 A »…), rattachées au cycle choisi et à l'année en cours.
 */
export function ClassAssistant({
  academicYearId,
  levels,
  rooms,
  subjects,
  existingClasses,
  onCreated,
  onCancel,
}: {
  academicYearId: number;
  levels: Niveau[];
  rooms: Salle[];
  subjects: Matiere[];
  existingClasses: Classe[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [cycleId, setCycleId] = useState<string>("");
  const [grades, setGrades] = useState<Set<string>>(new Set());
  const [customGrades, setCustomGrades] = useState("");
  const [series, setSeries] = useState<Set<string>>(new Set());
  const [sections, setSections] = useState<Set<string>>(new Set(["A"]));
  // Salle affectée à chaque classe générée (clé = libellé de la classe → id de salle).
  const [roomByLabel, setRoomByLabel] = useState<Record<string, string>>({});
  // Affecter automatiquement les matières du programme (selon le sous-cycle du grade).
  const [assignProgram, setAssignProgram] = useState(true);
  const [saving, setSaving] = useState(false);

  const cycle = levels.find((l) => String(l.id) === cycleId) ?? null;
  const catalogGrades = useMemo(() => gradesForCycle(cycle?.label), [cycle]);
  const gradeGroups = useMemo(() => gradeGroupsForCycle(cycle?.label), [cycle]);

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, value: string) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  // Grades retenus : catalogue coché + grades libres saisis, dans l'ordre catalogue puis libre.
  const chosenGrades = useMemo(() => {
    const custom = customGrades.split(",").map((g) => g.trim()).filter(Boolean);
    const fromCatalog = catalogGrades.filter((g) => grades.has(g));
    return [...fromCatalog, ...custom.filter((c) => !fromCatalog.includes(c))];
  }, [catalogGrades, grades, customGrades]);

  const chosenSections = SECTIONS.filter((s) => sections.has(s));
  const chosenSeries = SERIES.filter((s) => series.has(s.code)).map((s) => s.code);
  // Les séries (options lycée) ne s'appliquent qu'aux grades concernés (11ème…Terminale).
  const anySeriesGrade = chosenGrades.some(gradeHasSeries);

  // Classes à générer : grade × [série] × section (ex. « Terminale SM A »). On garde le grade
  // pour résoudre le programme (matières) de chaque classe.
  const planned = useMemo(() => {
    if (chosenGrades.length === 0) return [];
    const secs = chosenSections.length > 0 ? chosenSections : [""];
    return chosenGrades.flatMap((g) => {
      const seriesList = gradeHasSeries(g) && chosenSeries.length > 0 ? chosenSeries : [""];
      return seriesList.flatMap((serie) => secs.map((s) => ({ label: composeClassLabel(g, s, serie), grade: g })));
    });
  }, [chosenGrades, chosenSeries, chosenSections]);

  const existingLabels = new Set(existingClasses.map((c) => c.label.trim().toLowerCase()));
  const toCreate = planned.filter((c) => !existingLabels.has(c.label.toLowerCase()));
  const skipped = planned.length - toCreate.length;

  // Résout les matières (existantes) du programme d'un grade via son sous-cycle (Collège/Lycée…).
  function programmeSubjectIds(grade: string): number[] {
    const group = gradeGroups.find((gr) => gr.grades.includes(grade));
    const groupName = group?.group ?? cycle?.label ?? "";
    const wanted = new Set(subjectsForCycle(groupName).map(normalizeLabel));
    return subjects.filter((s) => wanted.has(normalizeLabel(s.label))).map((s) => s.id);
  }
  // Nombre de matières qui seront rattachées (aperçu, basé sur les grades choisis).
  const programmeCount = assignProgram
    ? new Set(chosenGrades.flatMap((g) => programmeSubjectIds(g))).size
    : 0;

  const roomData = [
    { value: "", label: "— Aucune —" },
    ...rooms.map((r) => ({ value: String(r.id), label: r.capacity != null ? `${r.label} (${r.capacity} pl.)` : r.label })),
  ];

  // Attribue les salles disponibles aux classes, dans l'ordre (une salle par classe).
  function autoAssignRooms() {
    const map: Record<string, string> = {};
    toCreate.forEach((c, i) => {
      const room = rooms[i];
      if (room) map[c.label] = String(room.id);
    });
    setRoomByLabel(map);
  }

  async function handleCreate() {
    if (!cycle || toCreate.length === 0) return;
    setSaving(true);
    try {
      for (const c of toCreate) {
        const roomId = roomByLabel[c.label] ? Number(roomByLabel[c.label]) : null;
        const room = roomId != null ? rooms.find((r) => r.id === roomId) : null;
        const created = await createClass({
          levelId: cycle.id,
          academicYearId,
          label: c.label,
          roomId,
          // La capacité reprend celle de la salle affectée (le cas échéant).
          maxCapacity: room?.capacity ?? null,
        });
        // Programme : rattache les matières standard du sous-cycle (sans enseignant, coefficient défaut).
        if (assignProgram && created?.id) {
          for (const subjectId of programmeSubjectIds(c.grade)) {
            await assignClassSubject(created.id, subjectId);
          }
        }
      }
      notifySuccess(`${toCreate.length} classe${toCreate.length > 1 ? "s créées" : " créée"}`);
      onCreated();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Choisissez le cycle, les grades puis les sections. L&apos;assistant crée toutes les classes
        correspondantes (ex. « CP1 A », « CP1 B »…).
      </Text>

      <Select
        label="Cycle (niveau)"
        withAsterisk
        placeholder="Choisir un cycle"
        data={levels.map((l) => ({ value: String(l.id), label: l.label }))}
        value={cycleId}
        onChange={(v) => {
          setCycleId(v ?? "");
          setGrades(new Set());
        }}
      />

      {cycle && (
        <>
          <div>
            <Text fw={600} size="sm" mb={6}>
              Grades
            </Text>
            {catalogGrades.length > 0 ? (
              <Stack gap="xs">
                {gradeGroups.map((grp) => (
                  <div key={grp.group}>
                    {gradeGroups.length > 1 && (
                      <Text size="xs" c="dimmed" fw={600} mb={4}>
                        {grp.group}
                      </Text>
                    )}
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {grp.grades.map((g) => (
                        <Checkbox
                          key={g}
                          label={g}
                          checked={grades.has(g)}
                          disabled={saving}
                          onChange={() => toggle(grades, setGrades, g)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </Stack>
            ) : (
              <Text size="xs" c="dimmed">
                Aucun grade prédéfini pour ce cycle — saisissez-les ci-dessous.
              </Text>
            )}
            <TextInput
              className="mt-2"
              label="Autres grades (séparés par des virgules)"
              placeholder="ex. CP, CE, CM"
              value={customGrades}
              onChange={(e) => setCustomGrades(e.currentTarget.value)}
              disabled={saving}
            />
          </div>

          {anySeriesGrade && (
            <div>
              <Text fw={600} size="sm" mb={6}>
                Séries (options lycée)
              </Text>
              <Group gap="md">
                {SERIES.map((s) => (
                  <Checkbox
                    key={s.code}
                    label={`${s.code} — ${s.name}`}
                    checked={series.has(s.code)}
                    disabled={saving}
                    onChange={() => toggle(series, setSeries, s.code)}
                  />
                ))}
              </Group>
              <Text size="xs" c="dimmed" mt={4}>
                Appliquées uniquement aux grades de lycée (ex. « Terminale SM A »).
              </Text>
            </div>
          )}

          <div>
            <Text fw={600} size="sm" mb={6}>
              Sections
            </Text>
            <Group gap="sm">
              {SECTIONS.map((s) => (
                <Checkbox
                  key={s}
                  label={s}
                  checked={sections.has(s)}
                  disabled={saving}
                  onChange={() => toggle(sections, setSections, s)}
                />
              ))}
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              Sans section cochée : une seule classe par grade (libellé = grade).
            </Text>
          </div>

          {toCreate.length > 0 && (
            <div>
              <Group justify="space-between" align="center" mb={6}>
                <Text fw={600} size="sm">
                  Salles ({toCreate.length} classe{toCreate.length > 1 ? "s" : ""}
                  {skipped > 0 && `, ${skipped} déjà existante${skipped > 1 ? "s" : ""} ignorée${skipped > 1 ? "s" : ""}`})
                </Text>
                {rooms.length > 0 && (
                  <Button variant="subtle" size="compact-xs" onClick={autoAssignRooms} disabled={saving}>
                    Attribuer automatiquement
                  </Button>
                )}
              </Group>
              {rooms.length === 0 ? (
                <Text size="xs" c="dimmed">
                  Aucune salle enregistrée — créez d&apos;abord des salles (Référentiels → Salles) pour
                  les affecter ici. Les classes peuvent aussi être créées sans salle.
                </Text>
              ) : (
                <Stack gap={6} className="max-h-64 overflow-y-auto pr-1">
                  {toCreate.map((c) => (
                    <Group key={c.label} gap="sm" wrap="nowrap">
                      <Text size="sm" className="min-w-[110px] shrink-0">
                        {c.label}
                      </Text>
                      <Select
                        placeholder="— Aucune —"
                        data={roomData}
                        value={roomByLabel[c.label] ?? ""}
                        onChange={(v) => setRoomByLabel((prev) => ({ ...prev, [c.label]: v ?? "" }))}
                        disabled={saving}
                        size="xs"
                        className="flex-1"
                        searchable
                      />
                    </Group>
                  ))}
                </Stack>
              )}
            </div>
          )}

          {toCreate.length > 0 && (
            <div className="rounded-md border border-gray-200 p-3">
              <Checkbox
                label="Affecter automatiquement les matières du programme"
                checked={assignProgram}
                disabled={saving}
                onChange={(e) => setAssignProgram(e.currentTarget.checked)}
              />
              {assignProgram && (
                <Text size="xs" c="dimmed" mt={4}>
                  {subjects.length === 0
                    ? "Aucune matière enregistrée — créez-les d'abord (Référentiels → Matières)."
                    : programmeCount > 0
                      ? `≈ ${programmeCount} matière${programmeCount > 1 ? "s" : ""} du programme rattachée${programmeCount > 1 ? "s" : ""} à chaque classe (enseignant à définir ensuite).`
                      : "Aucune matière du programme ne correspond aux matières enregistrées pour ce cycle."}
                </Text>
              )}
            </div>
          )}
        </>
      )}

      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel} disabled={saving}>
          Annuler
        </Button>
        <Button onClick={handleCreate} loading={saving} disabled={toCreate.length === 0}>
          Créer {toCreate.length > 0 ? `(${toCreate.length})` : ""}
        </Button>
      </Group>
    </Stack>
  );
}
