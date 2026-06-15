"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import { enroll, reenroll } from "@/lib/api/enrollments";
import { ApiError } from "@/lib/api/errors";
import type { EnrollmentType } from "@/lib/types/student";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";

interface EnrollModalProps {
  studentId: number;
  open: boolean;
  onClose: () => void;
  onEnrolled: () => void;
}

export function EnrollModal({ studentId, open, onClose, onEnrolled }: EnrollModalProps) {
  const yearsQuery = useQuery(listAcademicYears, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);

  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [classId, setClassId] = useState("");
  const [type, setType] = useState<EnrollmentType>("NEW");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const defaultYearId = years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const yearId = selectedYearId ?? defaultYearId;

  const classesQuery = useQuery(
    () => (yearId ? listClasses(yearId) : Promise.resolve([])),
    [yearId],
  );
  const classes = classesQuery.data ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!yearId || !classId) {
      setError("Sélectionnez une année et une classe.");
      return;
    }
    setSubmitting(true);
    const input = { studentId, classId: Number(classId), academicYearId: yearId, type };
    try {
      await (type === "RE_ENROLLMENT" ? reenroll(input) : enroll(input));
      setClassId("");
      onEnrolled();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : "Inscription impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Inscrire l'élève">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <Field>
          <Label htmlFor="year">Année scolaire</Label>
          <Select
            id="year"
            value={yearId ?? ""}
            onChange={(e) => {
              setSelectedYearId(e.target.value ? Number(e.target.value) : null);
              setClassId("");
            }}
          >
            {years.length === 0 && <option value="">—</option>}
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
                {y.current ? " (courante)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field>
          <Label htmlFor="class">Classe</Label>
          <Select id="class" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">— Sélectionner —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
                {c.maxCapacity != null ? ` (${c.headcount ?? 0}/${c.maxCapacity})` : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field>
          <Label htmlFor="type">Type</Label>
          <Select id="type" value={type} onChange={(e) => setType(e.target.value as EnrollmentType)}>
            <option value="NEW">Inscription</option>
            <option value="RE_ENROLLMENT">Réinscription</option>
          </Select>
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button type="submit" loading={submitting}>
            Inscrire
          </Button>
        </div>
      </form>
    </Modal>
  );
}
