"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field, Label, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { abandonEnrollment } from "@/lib/api/enrollments";
import { DEPARTURE_REASON_LABEL, type DepartureReason, type Enrollment } from "@/lib/types/student";
import { notifyError, notifySuccess } from "@/lib/feedback";

interface DeclareDepartureModalProps {
  enrollment: Enrollment | null;
  onClose: () => void;
  onDeclared: () => void;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Départ d'un élève (transfert vers une autre école, abandon, exclusion...) — exclut l'élève des
 * listes actives et de la prochaine facturation, annule ses factures encore dues de l'année, sans
 * jamais toucher à son historique déjà encaissé (voir abandonEnrollment). */
export function DeclareDepartureModal({ enrollment, onClose, onDeclared }: DeclareDepartureModalProps) {
  const [departureDate, setDepartureDate] = useState(today());
  const [reason, setReason] = useState<DepartureReason>("TRANSFERT");
  const [destinationSchool, setDestinationSchool] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!enrollment) return null;

  async function handleConfirm() {
    if (!enrollment) return;
    setSubmitting(true);
    try {
      await abandonEnrollment(enrollment.id, {
        departureDate,
        reason,
        destinationSchool: reason === "TRANSFERT" ? destinationSchool || null : null,
      });
      notifySuccess("Départ enregistré");
      onDeclared();
    } catch (err) {
      notifyError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Déclarer un départ">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          L&apos;élève disparaîtra des listes d&apos;appel et de saisie de notes, et n&apos;aura plus de
          nouvelles factures. Son historique (notes, paiements déjà encaissés) reste consultable.
        </p>
        <Field>
          <Label>Date du départ</Label>
          <DatePicker value={departureDate} onChange={setDepartureDate} maxDate={new Date()} />
        </Field>
        <Field>
          <Label>Raison</Label>
          <Select value={reason} onChange={(e) => setReason(e.target.value as DepartureReason)}>
            {Object.entries(DEPARTURE_REASON_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
        {reason === "TRANSFERT" && (
          <Field>
            <Label>École de destination <span className="font-normal text-slate-400">(optionnel)</span></Label>
            <Input value={destinationSchool} onChange={(e) => setDestinationSchool(e.target.value)} />
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="button" onClick={handleConfirm} disabled={submitting}>
            Déclarer le départ
          </Button>
        </div>
      </div>
    </Modal>
  );
}
