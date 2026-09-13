"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input, Label, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
  // Grades marqués « classe d'examen » (ex. CM2, 10ème/BEPC, Terminale) — tarif horaire de paie
  // dédié pour les enseignants qui y interviennent (§paie). S'applique à toutes les sections/séries
  // générées pour ce grade (ex. « Terminale SM A » ET « Terminale SM B »).
  const [examGrades, setExamGrades] = useState<Set<string>>(new Set());
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

  // Salles déjà affectées à une classe existante : jamais proposées ici (toutes les classes créées par
  // cet assistant sont nouvelles, donc aucune exception "modifier sa propre classe" ne s'applique —
  // celle-ci vit dans ClassForm, pour l'édition d'une classe déjà existante).
  const takenRoomIds = new Set(existingClasses.filter((c) => c.roomId != null).map((c) => c.roomId as number));
  const availableRooms = rooms.filter((r) => !takenRoomIds.has(r.id));

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

  // Attribue les salles disponibles (jamais déjà affectées à une autre classe) aux classes, dans
  // l'ordre (une salle par classe).
  function autoAssignRooms() {
    const map: Record<string, string> = {};
    toCreate.forEach((c, i) => {
      const room = availableRooms[i];
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
          classType: examGrades.has(c.grade) ? "EXAMEN" : "NORMALE",
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
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Choisissez le cycle, les grades puis les sections. L&apos;assistant crée toutes les classes
        correspondantes (ex. « CP1 A », « CP1 B »…).
      </p>

      <Field>
        <Label>Cycle (niveau) <span className="text-error-500">*</span></Label>
        <Select
          value={cycleId}
          onChange={(e) => {
            setCycleId(e.target.value);
            setGrades(new Set());
          }}
        >
          <option value="">Choisir un cycle</option>
          {levels.map((l) => (<option key={l.id} value={String(l.id)}>{l.label}</option>))}
        </Select>
      </Field>

      {cycle && (
        <>
          <div>
            <p className="mb-1.5 text-sm font-semibold text-gray-700">Grades</p>
            {catalogGrades.length > 0 ? (
              <div className="space-y-2">
                {gradeGroups.map((grp) => (
                  <div key={grp.group}>
                    {gradeGroups.length > 1 && (
                      <p className="mb-1 text-xs font-semibold text-gray-400">{grp.group}</p>
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
              </div>
            ) : (
              <p className="text-xs text-gray-400">Aucun grade prédéfini pour ce cycle — saisissez-les ci-dessous.</p>
            )}
            <Field>
              <Label className="mt-2">Autres grades (séparés par des virgules)</Label>
              <Input
                placeholder="ex. CP, CE, CM"
                value={customGrades}
                onChange={(e) => setCustomGrades(e.target.value)}
                disabled={saving}
              />
            </Field>
          </div>

          {chosenGrades.length > 0 && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-gray-700">Classes d&apos;examen</p>
              <p className="mb-1.5 text-xs text-gray-400">
                Cochez les grades concernés (ex. CM2, 10ème/BEPC, Terminale) — détermine le tarif
                horaire de paie des enseignants qui y interviennent, s&apos;applique à toutes les
                sections/séries générées pour ce grade.
              </p>
              <div className="flex flex-wrap gap-3">
                {chosenGrades.map((g) => (
                  <Checkbox
                    key={g}
                    label={g}
                    checked={examGrades.has(g)}
                    disabled={saving}
                    onChange={() => toggle(examGrades, setExamGrades, g)}
                  />
                ))}
              </div>
            </div>
          )}

          {anySeriesGrade && (
            <div>
              <p className="mb-1.5 text-sm font-semibold text-gray-700">Séries (options lycée)</p>
              <div className="flex flex-wrap gap-4">
                {SERIES.map((s) => (
                  <Checkbox
                    key={s.code}
                    label={`${s.code} — ${s.name}`}
                    checked={series.has(s.code)}
                    disabled={saving}
                    onChange={() => toggle(series, setSeries, s.code)}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-400">Appliquées uniquement aux grades de lycée (ex. « Terminale SM A »).</p>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-sm font-semibold text-gray-700">Sections</p>
            <div className="flex flex-wrap gap-3">
              {SECTIONS.map((s) => (
                <Checkbox
                  key={s}
                  label={s}
                  checked={sections.has(s)}
                  disabled={saving}
                  onChange={() => toggle(sections, setSections, s)}
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-400">Sans section cochée : une seule classe par grade (libellé = grade).</p>
          </div>

          {toCreate.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">
                  Salles ({toCreate.length} classe{toCreate.length > 1 ? "s" : ""}
                  {skipped > 0 && `, ${skipped} déjà existante${skipped > 1 ? "s" : ""} ignorée${skipped > 1 ? "s" : ""}`})
                </p>
                {availableRooms.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={autoAssignRooms} disabled={saving}>
                    Attribuer automatiquement
                  </Button>
                )}
              </div>
              {rooms.length === 0 ? (
                <p className="text-xs text-gray-400">
                  Aucune salle enregistrée — créez d&apos;abord des salles (Référentiels → Salles) pour
                  les affecter ici. Les classes peuvent aussi être créées sans salle.
                </p>
              ) : (
                <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                  {availableRooms.length === 0 && (
                    <p className="text-xs text-gray-400">
                      Toutes les salles enregistrées sont déjà affectées à une classe existante — créez
                      d&apos;autres salles pour en attribuer ici, ou laissez ces classes sans salle.
                    </p>
                  )}
                  {toCreate.map((c) => (
                    <div key={c.label} className="flex flex-nowrap items-center gap-2">
                      <span className="min-w-[110px] shrink-0 text-sm text-gray-700">{c.label}</span>
                      <Select
                        value={roomByLabel[c.label] ?? ""}
                        onChange={(e) => setRoomByLabel((prev) => ({ ...prev, [c.label]: e.target.value }))}
                        disabled={saving}
                        className="flex-1"
                      >
                        <option value="">— Aucune —</option>
                        {availableRooms.map((r) => (
                          <option key={r.id} value={String(r.id)}>{r.capacity != null ? `${r.label} (${r.capacity} pl.)` : r.label}</option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {toCreate.length > 0 && (
            <div className="rounded-md border border-gray-200 p-3">
              <Checkbox
                label="Affecter automatiquement les matières du programme"
                checked={assignProgram}
                disabled={saving}
                onChange={(e) => setAssignProgram(e.target.checked)}
              />
              {assignProgram && (
                <p className="mt-1 text-xs text-gray-400">
                  {subjects.length === 0
                    ? "Aucune matière enregistrée — créez-les d'abord (Référentiels → Matières)."
                    : programmeCount > 0
                      ? `≈ ${programmeCount} matière${programmeCount > 1 ? "s" : ""} du programme rattachée${programmeCount > 1 ? "s" : ""} à chaque classe (enseignant à définir ensuite).`
                      : "Aucune matière du programme ne correspond aux matières enregistrées pour ce cycle."}
                </p>
              )}
            </div>
          )}
        </>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Annuler
        </Button>
        <Button onClick={handleCreate} loading={saving} disabled={toCreate.length === 0}>
          Créer {toCreate.length > 0 ? `(${toCreate.length})` : ""}
        </Button>
      </div>
    </div>
  );
}
