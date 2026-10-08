"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Label } from "@/components/ui/input";
import { purgeStudent } from "@/lib/api/students";
import { notifyError, notifySuccess } from "@/lib/feedback";

/**
 * Zone dangereuse réservée au SUPER_ADMIN (plateforme) : contrairement à "Supprimer" (archivage
 * réversible, déjà possible ailleurs), ceci supprime DÉFINITIVEMENT l'élève et tout ce qui le
 * référence (factures, paiements, inscriptions/réinscriptions, présences, notes…), voir
 * StudentPurgeService côté backend. Saisie du matricule exact exigée avant d'activer le bouton final
 * — pas de simple "Oui/Non" pour une action aussi irréversible.
 */
export function PurgeStudentAction({ studentId, studentNumber, studentName }: {
  studentId: number;
  studentNumber: string;
  studentName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  function close() {
    setOpen(false);
    setConfirmText("");
  }

  async function purge() {
    setLoading(true);
    try {
      const result = await purgeStudent(studentId);
      const totalRows = Object.values(result.deletedByTable).reduce((s, n) => s + n, 0);
      notifySuccess(
        `${studentName} et ${totalRows} ligne(s) liée(s) ont été supprimées définitivement.`
        + (result.warnings.length > 0 ? ` ${result.warnings.length} avertissement(s) — voir la console.` : ""),
      );
      if (result.warnings.length > 0) {
        console.warn("Purge élève — avertissements :", result.warnings);
      }
      router.push("/students");
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
      close();
    }
  }

  return (
    <>
      <Button variant="secondary" className="border-error-200 text-error-600 hover:bg-error-50" onClick={() => setOpen(true)}>
        <AlertTriangle className="h-4 w-4" /> Supprimer définitivement (SUPER_ADMIN)
      </Button>

      <Modal open={open} onClose={close} title="Supprimer définitivement cet élève">
        <div className="space-y-4">
          <p className="rounded-lg bg-error-50 px-3 py-2.5 text-sm text-error-700">
            Action irréversible : supprime {studentName} ainsi que toutes ses factures, paiements,
            inscriptions/réinscriptions, présences et notes. Si cet élève a une classe, il en
            disparaît aussi. À réserver aux cas où l&apos;élève n&apos;aurait jamais dû être créé
            (doublon, erreur de saisie) — pour un élève qui part simplement, utilisez plutôt
            &quot;Abandon&quot; ou l&apos;archivage, qui conservent l&apos;historique.
          </p>
          <Field>
            <Label>Pour confirmer, tapez le matricule exact : <span className="font-mono">{studentNumber}</span></Label>
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>Annuler</Button>
            <Button
              className="bg-error-600 hover:bg-error-700"
              disabled={confirmText !== studentNumber}
              loading={loading}
              onClick={purge}
            >
              Supprimer définitivement
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
