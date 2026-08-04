"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { createRoom } from "@/lib/api/academics";
import type { Classe, CreateClassInput, CreateRoomInput, Niveau, Salle } from "@/lib/types/academics";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RoomForm } from "@/components/referentials/room-form";
import { LevelCatalogPicker } from "@/components/referentials/level-catalog";
import { SECTIONS, SERIES, composeClassLabel, gradeHasSeries, gradesForCycle } from "@/lib/academics-grades";
import { notifySuccess } from "@/lib/feedback";

interface ClassFormProps {
  initial?: Classe;
  academicYearId: number;
  levels: Niveau[];
  rooms: Salle[];
  /** Classes de l'année en cours — sert à retirer du choix les salles déjà affectées à une autre classe. */
  classes: Classe[];
  submitLabel: string;
  onSubmit: (input: CreateClassInput) => Promise<void>;
  onCancel: () => void;
  /** Appelé après création inline d'une salle, pour rafraîchir la liste côté parent. */
  onRoomsChanged?: () => void;
  /** Appelé après création inline d'un niveau, pour rafraîchir la liste côté parent. */
  onLevelsChanged?: () => void;
}

const schema = z.object({
  label: z.string().trim().min(1, "Libellé requis"),
  grade: z.string(),
  series: z.string(),
  section: z.string(),
  levelId: z.string(),
  roomId: z.string(),
  maxCapacity: z.union([z.number(), z.literal("")]),
  classType: z.string(),
});
type FormValues = z.infer<typeof schema>;

export function ClassForm({
  initial,
  academicYearId,
  levels,
  rooms,
  classes,
  submitLabel,
  onSubmit,
  onCancel,
  onRoomsChanged,
  onLevelsChanged,
}: ClassFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [roomModal, setRoomModal] = useState(false);
  const [levelModal, setLevelModal] = useState(false);
  // Salles / niveaux créés à la volée depuis ce formulaire (fusionnés à la liste reçue du parent).
  const [createdRooms, setCreatedRooms] = useState<Salle[]>([]);
  const [createdLevels, setCreatedLevels] = useState<Niveau[]>([]);
  const allRooms = [...rooms, ...createdRooms.filter((c) => !rooms.some((r) => r.id === c.id))];
  const allLevels = [...levels, ...createdLevels.filter((c) => !levels.some((l) => l.id === c.id))];
  // Salles déjà affectées à une AUTRE classe : retirées du choix pour éviter une double affectation.
  const takenRoomIds = new Set(
    classes.filter((c) => c.roomId != null && c.id !== initial?.id).map((c) => c.roomId as number),
  );

  const { register, handleSubmit, watch, setValue, setError: setFieldError, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      label: initial?.label ?? "",
      grade: "",
      series: "",
      section: "",
      levelId: initial?.levelId ? String(initial.levelId) : "",
      roomId: initial?.roomId ? String(initial.roomId) : "",
      maxCapacity: initial?.maxCapacity ?? "",
      classType: initial?.classType ?? "NORMALE",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const values = watch();

  // Grades proposés selon le cycle (niveau) ; le libellé se compose « grade [série] [section] ».
  const selectedCycle = allLevels.find((l) => String(l.id) === values.levelId);
  const gradeOptions = gradesForCycle(selectedCycle?.label);
  const showSeries = gradeHasSeries(values.grade);

  function setGrade(grade: string) {
    // Un grade sans série (ex. passage lycée → collège) : on efface la série.
    const series = gradeHasSeries(grade) ? values.series : "";
    setValue("grade", grade);
    setValue("series", series);
    setValue("label", composeClassLabel(grade, values.section, series));
  }
  function setSeries(series: string) {
    setValue("series", series);
    setValue("label", composeClassLabel(values.grade, values.section, series));
  }
  function setSection(section: string) {
    setValue("section", section);
    setValue("label", composeClassLabel(values.grade, section, values.series));
  }

  async function handleFormSubmit(v: FormValues) {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        label: v.label,
        academicYearId,
        levelId: v.levelId ? Number(v.levelId) : null,
        roomId: v.roomId ? Number(v.roomId) : null,
        maxCapacity: v.maxCapacity === "" ? null : Number(v.maxCapacity),
        headTeacherId: initial?.headTeacherId ?? null, // désigné depuis le tableau matières/enseignants
        classType: v.classType as "NORMALE" | "EXAMEN",
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = err.fieldErrors;
        if (Object.keys(fieldErrors).length > 0) {
          for (const [field, message] of Object.entries(fieldErrors)) {
            setFieldError(field as keyof FormValues, { message });
          }
        } else {
          setError(err.userMessage);
        }
      } else {
        setError("Enregistrement impossible.");
      }
      setSubmitting(false);
    }
  }

  async function handleRoomCreate(input: CreateRoomInput) {
    const room = await createRoom(input);
    setCreatedRooms((prev) => [...prev, room]);
    setValue("roomId", String(room.id));
    if (room.capacity != null) setValue("maxCapacity", room.capacity);
    setRoomModal(false);
    notifySuccess("Salle créée");
    onRoomsChanged?.();
  }

  function handleLevelsCreated(created: Niveau[]) {
    setLevelModal(false);
    if (created.length === 0) return;
    setCreatedLevels((prev) => [...prev, ...created]);
    // On sélectionne le premier niveau créé pour la classe en cours.
    setValue("levelId", String(created[0].id));
    onLevelsChanged?.();
  }

  return (
    <>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-error-50 px-3.5 py-2.5 text-sm text-error-700">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Field>
              <Label>Niveau (cycle)</Label>
              <Select value={values.levelId} onChange={(e) => setValue("levelId", e.target.value)}>
                <option value="">—</option>
                {allLevels.map((l) => (<option key={l.id} value={String(l.id)}>{l.label}</option>))}
              </Select>
            </Field>
            <Button type="button" variant="ghost" size="sm" className="mt-1 h-auto px-0 text-xs" onClick={() => setLevelModal(true)}>
              ＋ Nouveau niveau
            </Button>
          </div>
          <div>
            <Field>
              <Label>Salle</Label>
              <Select
                value={values.roomId}
                onChange={(e) => {
                  const id = e.target.value;
                  setValue("roomId", id);
                  // La capacité max de la classe reprend automatiquement la capacité de la salle choisie.
                  const room = allRooms.find((r) => String(r.id) === id);
                  if (room?.capacity != null) setValue("maxCapacity", room.capacity);
                }}
              >
                <option value="">—</option>
                {allRooms
                  .filter((r) => !takenRoomIds.has(r.id) || String(r.id) === values.roomId)
                  .map((r) => (<option key={r.id} value={String(r.id)}>{r.label}</option>))}
              </Select>
            </Field>
            <Button type="button" variant="ghost" size="sm" className="mt-1 h-auto px-0 text-xs" onClick={() => setRoomModal(true)}>
              ＋ Nouvelle salle
            </Button>
          </div>
        </div>

        <div className={showSeries ? "grid grid-cols-3 gap-4" : "grid grid-cols-2 gap-4"}>
          <Field>
            <Label>Classe (grade)</Label>
            <Input
              list="class-grade-options"
              placeholder={gradeOptions.length ? "Choisir un grade" : "ex. 7ème"}
              value={values.grade}
              onChange={(e) => setGrade(e.target.value)}
            />
            <datalist id="class-grade-options">
              {gradeOptions.map((g) => (<option key={g} value={g} />))}
            </datalist>
          </Field>
          {showSeries && (
            <Field>
              <Label>Série (option)</Label>
              <Select value={values.series} onChange={(e) => setSeries(e.target.value)}>
                <option value="">—</option>
                {SERIES.map((s) => (<option key={s.code} value={s.code}>{s.code} — {s.name}</option>))}
              </Select>
            </Field>
          )}
          <Field>
            <Label>Section</Label>
            <Input list="class-section-options" placeholder="A" value={values.section} onChange={(e) => setSection(e.target.value)} />
            <datalist id="class-section-options">
              {SECTIONS.map((s) => (<option key={s} value={s} />))}
            </datalist>
          </Field>
        </div>

        <Field>
          <Label>Libellé de la classe <span className="text-error-500">*</span></Label>
          <p className="mb-1 text-xs text-gray-400">Composé automatiquement (grade + section), modifiable</p>
          <Input {...register("label")} aria-invalid={!!errors.label} />
          {errors.label && <p className="mt-1 text-xs text-error-600">{errors.label.message}</p>}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field>
            <Label>Capacité max</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={values.maxCapacity}
              onChange={(e) => setValue("maxCapacity", e.target.value === "" ? "" : Number(e.target.value))}
            />
          </Field>
          <Field>
            <Label>Typologie</Label>
            <p className="mb-1 text-xs text-gray-400">Détermine le tarif horaire de paie des enseignants</p>
            <Select value={values.classType} onChange={(e) => setValue("classType", e.target.value)}>
              <option value="NORMALE">Classe normale</option>
              <option value="EXAMEN">Classe d&apos;examen</option>
            </Select>
          </Field>
        </div>
        <p className="text-xs text-gray-400">
          Le professeur principal se désigne depuis le tableau « Matières & enseignants » de la fiche classe.
        </p>

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
            Annuler
          </Button>
          <Button type="submit" loading={submitting}>
            {submitLabel}
          </Button>
        </div>
      </form>

      <Modal open={roomModal} onClose={() => setRoomModal(false)} title="Nouvelle salle">
        {roomModal && <RoomForm onSubmit={handleRoomCreate} onCancel={() => setRoomModal(false)} />}
      </Modal>

      <Modal open={levelModal} onClose={() => setLevelModal(false)} title="Catalogue des niveaux">
        {levelModal && (
          <LevelCatalogPicker
            existing={allLevels}
            onDone={handleLevelsCreated}
            onCancel={() => setLevelModal(false)}
          />
        )}
      </Modal>
    </>
  );
}
