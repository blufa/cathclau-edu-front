"use client";

import { useState } from "react";
import { Alert, Autocomplete, Button, Group, Select, NumberInput, SimpleGrid, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { ApiError } from "@/lib/api/errors";
import { createRoom } from "@/lib/api/academics";
import type { Classe, CreateClassInput, CreateRoomInput, Niveau, Salle } from "@/lib/types/academics";
import { Modal } from "@/components/ui/modal";
import { RoomForm } from "@/components/referentials/room-form";
import { LevelCatalogPicker } from "@/components/referentials/level-catalog";
import { SECTIONS, SERIES, composeClassLabel, gradeHasSeries, gradesForCycle } from "@/lib/academics-grades";
import { notifySuccess } from "@/lib/feedback";

interface ClassFormProps {
  initial?: Classe;
  academicYearId: number;
  levels: Niveau[];
  rooms: Salle[];
  submitLabel: string;
  onSubmit: (input: CreateClassInput) => Promise<void>;
  onCancel: () => void;
  /** Appelé après création inline d'une salle, pour rafraîchir la liste côté parent. */
  onRoomsChanged?: () => void;
  /** Appelé après création inline d'un niveau, pour rafraîchir la liste côté parent. */
  onLevelsChanged?: () => void;
}

interface FormValues {
  label: string;
  grade: string;
  series: string;
  section: string;
  levelId: string;
  roomId: string;
  maxCapacity: number | string;
}

export function ClassForm({
  initial,
  academicYearId,
  levels,
  rooms,
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

  const form = useForm<FormValues>({
    mode: "controlled",
    initialValues: {
      label: initial?.label ?? "",
      grade: "",
      series: "",
      section: "",
      levelId: initial?.levelId ? String(initial.levelId) : "",
      roomId: initial?.roomId ? String(initial.roomId) : "",
      maxCapacity: initial?.maxCapacity ?? "",
    },
    validate: {
      label: (v) => (v.trim() ? null : "Libellé requis"),
    },
  });

  // Grades proposés selon le cycle (niveau) ; le libellé se compose « grade [série] [section] ».
  const selectedCycle = allLevels.find((l) => String(l.id) === form.values.levelId);
  const gradeOptions = gradesForCycle(selectedCycle?.label);
  const showSeries = gradeHasSeries(form.values.grade);

  function setGrade(grade: string) {
    // Un grade sans série (ex. passage lycée → collège) : on efface la série.
    const series = gradeHasSeries(grade) ? form.values.series : "";
    form.setFieldValue("grade", grade);
    form.setFieldValue("series", series);
    form.setFieldValue("label", composeClassLabel(grade, form.values.section, series));
  }
  function setSeries(series: string) {
    form.setFieldValue("series", series);
    form.setFieldValue("label", composeClassLabel(form.values.grade, form.values.section, series));
  }
  function setSection(section: string) {
    form.setFieldValue("section", section);
    form.setFieldValue("label", composeClassLabel(form.values.grade, section, form.values.series));
  }

  async function handleSubmit(values: FormValues) {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        label: values.label,
        academicYearId,
        levelId: values.levelId ? Number(values.levelId) : null,
        roomId: values.roomId ? Number(values.roomId) : null,
        maxCapacity: values.maxCapacity === "" ? null : Number(values.maxCapacity),
        headTeacherId: initial?.headTeacherId ?? null, // désigné depuis le tableau matières/enseignants
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = err.fieldErrors;
        if (Object.keys(fieldErrors).length > 0) form.setErrors(fieldErrors);
        else setError(err.userMessage);
      } else {
        setError("Enregistrement impossible.");
      }
      setSubmitting(false);
    }
  }

  async function handleRoomCreate(input: CreateRoomInput) {
    const room = await createRoom(input);
    setCreatedRooms((prev) => [...prev, room]);
    form.setFieldValue("roomId", String(room.id));
    if (room.capacity != null) form.setFieldValue("maxCapacity", room.capacity);
    setRoomModal(false);
    notifySuccess("Salle créée");
    onRoomsChanged?.();
  }

  function handleLevelsCreated(created: Niveau[]) {
    setLevelModal(false);
    if (created.length === 0) return;
    setCreatedLevels((prev) => [...prev, ...created]);
    // On sélectionne le premier niveau créé pour la classe en cours.
    form.setFieldValue("levelId", String(created[0].id));
    onLevelsChanged?.();
  }

  const levelData = [{ value: "", label: "—" }, ...allLevels.map((l) => ({ value: String(l.id), label: l.label }))];
  const roomData = [{ value: "", label: "—" }, ...allRooms.map((r) => ({ value: String(r.id), label: r.label }))];

  return (
    <>
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <SimpleGrid cols={2}>
          <div>
            <Select
              label="Niveau (cycle)"
              placeholder="Primaire, Collège…"
              data={levelData}
              value={form.values.levelId}
              onChange={(value) => form.setFieldValue("levelId", value ?? "")}
            />
            <Button variant="subtle" size="compact-xs" className="mt-1" onClick={() => setLevelModal(true)}>
              ＋ Nouveau niveau
            </Button>
          </div>
          <div>
            <Select
              label="Salle"
              data={roomData}
              value={form.values.roomId}
              onChange={(value) => {
                const id = value ?? "";
                form.setFieldValue("roomId", id);
                // La capacité max de la classe reprend automatiquement la capacité de la salle choisie.
                const room = allRooms.find((r) => String(r.id) === id);
                if (room?.capacity != null) form.setFieldValue("maxCapacity", room.capacity);
              }}
            />
            <Button variant="subtle" size="compact-xs" className="mt-1" onClick={() => setRoomModal(true)}>
              ＋ Nouvelle salle
            </Button>
          </div>
        </SimpleGrid>

        <SimpleGrid cols={showSeries ? 3 : 2}>
          <Autocomplete
            label="Classe (grade)"
            placeholder={gradeOptions.length ? "Choisir un grade" : "ex. 7ème"}
            data={gradeOptions}
            maxDropdownHeight={300}
            value={form.values.grade}
            onChange={setGrade}
          />
          {showSeries && (
            <Select
              label="Série (option)"
              placeholder="SM, SS, SE"
              data={SERIES.map((s) => ({ value: s.code, label: `${s.code} — ${s.name}` }))}
              value={form.values.series || null}
              onChange={(v) => setSeries(v ?? "")}
              clearable
            />
          )}
          <Autocomplete
            label="Section"
            placeholder="A"
            data={SECTIONS}
            value={form.values.section}
            onChange={setSection}
          />
        </SimpleGrid>

        <TextInput
          label="Libellé de la classe"
          description="Composé automatiquement (grade + section), modifiable"
          withAsterisk
          {...form.getInputProps("label")}
        />

        <NumberInput label="Capacité max" min={0} allowDecimal={false} {...form.getInputProps("maxCapacity")} />
        <p className="text-xs text-gray-400">
          Le professeur principal se désigne depuis le tableau « Matières & enseignants » de la fiche classe.
        </p>

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onCancel} disabled={submitting}>
            Annuler
          </Button>
          <Button type="submit" loading={submitting}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
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
