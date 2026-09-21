"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/auth-provider";
import { useSubscription } from "@/providers/subscription-provider";
import { ApiError } from "@/lib/api/errors";
import { qk } from "@/lib/query";
import type { CreateStudentInput, Enrollment, Student } from "@/lib/types/student";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudentForm } from "@/features/students/components/student-form";
import { AddParentForm } from "@/features/students/components/parents-manager";
import { EnrollModal } from "./enroll-modal";
import { CollectFeeModal } from "@/features/billing/components/collect-fee-modal";
import { OfflineEnrollFields } from "./offline-enroll-fields";
import { notifySuccess } from "@/lib/feedback";
import { submitStudentOfflineAware } from "@/lib/offline/submit-student-enrollment";
import { useEnrollmentQueueStore } from "@/lib/offline/enrollment-queue-store";
import { discardFailedEnrollmentEntry, retryFailedEnrollmentEntry } from "@/lib/offline/sync-engine";

/**
 * Processus complet « Inscrire » (créer l'élève → rattacher un parent → l'inscrire dans une classe →
 * encaisser les frais d'inscription) — vit ici (Inscriptions), pas sur la fiche Élèves : un élève ne
 * doit exister dans le logiciel qu'en passant par ce parcours, jamais créé « à vide » sans suite.
 * Composant autonome (déclenche son propre bouton + enchaîne ses propres modales) pour rester
 * réutilisable telle quelle, glissée dans n'importe quel écran.
 */
export function EnrollNewStudentWizard() {
  const { user } = useAuth();
  const { refresh: refreshSubscription } = useSubscription();
  const queryClient = useQueryClient();
  const enrollmentQueueItems = useEnrollmentQueueStore((s) => s.items);

  const [creating, setCreating] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  // Juste après la création : rattacher un parent AVANT l'inscription/encaissement — c'est à lui que
  // part le SMS de confirmation de paiement, il doit donc exister avant de proposer d'encaisser.
  // Étape non bloquante (« Plus tard ») : un élève peut être créé sans parent tout de suite si besoin.
  const [attachingParentFor, setAttachingParentFor] = useState<Student | null>(null);
  // Proposé juste après le rattachement du parent : inscrire immédiatement.
  const [enrollingNew, setEnrollingNew] = useState<Student | null>(null);
  // Enchaînement direct après l'inscription : montrer tout de suite les frais (inscription déjà
  // facturée automatiquement, mensualités générées automatiquement) prêts à encaisser, sans exiger
  // une étape manuelle de génération séparée.
  const [collectingFor, setCollectingFor] = useState<Enrollment | null>(null);
  // Élève créé hors-ligne (réseau indisponible, §students) : propose de choisir sa classe tout de
  // suite via le formulaire simplifié, sur l'entrée en file plutôt que sur un élève réel.
  const [offlineEnrollingEntryId, setOfflineEnrollingEntryId] = useState<string | null>(null);

  function openCreate() {
    setQuotaError(null);
    setCreating(true);
  }

  async function handleCreate(input: CreateStudentInput) {
    try {
      const attempt = await submitStudentOfflineAware(input);
      setCreating(false);
      setQuotaError(null);
      if (attempt.outcome === "queued") {
        notifySuccess("Élève enregistré hors-ligne — sera synchronisé automatiquement.");
        setOfflineEnrollingEntryId(attempt.entry.id);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: qk.students.all });
      notifySuccess("Élève créé");
      refreshSubscription();
      setAttachingParentFor(attempt.student);
    } catch (err) {
      // Quota guard (§students): 403 with {resource:"ELEVES", limite, consomme}.
      if (err instanceof ApiError && err.status === 403) {
        const p = err.problem as { limite?: number; consomme?: number } | undefined;
        const detail =
          p?.limite != null
            ? `Limite de votre plan atteinte (${p.consomme ?? "?"}/${p.limite} élèves). Passez à un plan supérieur.`
            : "Limite de votre plan atteinte. Passez à un plan supérieur.";
        setQuotaError(detail);
        return; // keep the form open so the message is visible
      }
      throw err; // let the form surface validation/other errors
    }
  }

  return (
    <>
      <Button onClick={openCreate} leftSection={<UserPlus className="h-4 w-4" />}>
        Inscrire
      </Button>

      {enrollmentQueueItems.length > 0 && (
        <Card>
          <CardBody>
            <h2 className="mb-3 text-sm font-semibold text-warning-700">
              Élèves en attente de synchronisation (hors-ligne)
            </h2>
            <ul className="divide-y divide-slate-100">
              {enrollmentQueueItems.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="text-slate-700">
                    {entry.studentInput.firstName} {entry.studentInput.lastName}
                    <span className="ml-2 font-mono text-xs text-slate-400">Matricule : en attente</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {entry.status === "failed" ? (
                      <>
                        <span className="text-xs text-error-600">{entry.lastError ?? "Échec"}</span>
                        <Button size="sm" variant="secondary" onClick={() => discardFailedEnrollmentEntry(entry.id)}>Ignorer</Button>
                        <Button size="sm" onClick={() => retryFailedEnrollmentEntry(entry.id)}>Réessayer</Button>
                      </>
                    ) : entry.enroll ? (
                      <Badge tone="blue">Classe choisie — en attente de connexion</Badge>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => setOfflineEnrollingEntryId(entry.id)}>
                        Choisir la classe
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvel élève" className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {quotaError && (
          <div className="mb-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700">
            {quotaError}{" "}
            <Link href="/subscription" className="font-semibold underline">
              Voir les plans
            </Link>
          </div>
        )}
        <StudentForm submitLabel="Créer" onSubmit={handleCreate} onCancel={() => setCreating(false)} />
      </Modal>

      <Modal
        open={!!attachingParentFor}
        onClose={() => {
          setEnrollingNew(attachingParentFor);
          setAttachingParentFor(null);
        }}
        title="Rattacher un parent"
      >
        {attachingParentFor && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Avant d&apos;inscrire {attachingParentFor.firstName} {attachingParentFor.lastName}, rattachez son
              parent ou tuteur — c&apos;est à lui que partira le SMS de confirmation lors de l&apos;encaissement.
            </p>
            <AddParentForm
              studentId={attachingParentFor.id}
              onCancel={() => {
                setEnrollingNew(attachingParentFor);
                setAttachingParentFor(null);
              }}
              onDone={() => {
                // Le parent rattaché (téléphone) fait partie des colonnes de la liste élèves — sans
                // cette invalidation, il fallait recharger la page pour le voir apparaître.
                void queryClient.invalidateQueries({ queryKey: qk.students.all });
                setEnrollingNew(attachingParentFor);
                setAttachingParentFor(null);
              }}
            />
            <div className="flex justify-end border-t border-slate-100 pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEnrollingNew(attachingParentFor);
                  setAttachingParentFor(null);
                }}
              >
                Plus tard — passer à l&apos;inscription
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {enrollingNew && (
        <EnrollModal
          studentId={enrollingNew.id}
          open={!!enrollingNew}
          onClose={() => setEnrollingNew(null)}
          onEnrolled={(enrollment) => {
            void queryClient.invalidateQueries({ queryKey: qk.students.all });
            setEnrollingNew(null);
            setCollectingFor(enrollment);
          }}
        />
      )}

      {collectingFor && user?.tenantId != null && (
        <CollectFeeModal
          studentId={collectingFor.studentId}
          classId={collectingFor.classId}
          tenantId={user.tenantId}
          open={!!collectingFor}
          onClose={() => setCollectingFor(null)}
          // Ne ferme pas la modale automatiquement : le reçu s'affiche dans la même fenêtre juste
          // après l'encaissement, l'utilisateur ferme lui-même une fois qu'il l'a visualisé/imprimé.
          onCollected={() => {}}
        />
      )}

      <Modal
        open={!!offlineEnrollingEntryId}
        onClose={() => setOfflineEnrollingEntryId(null)}
        title="Inscrire l'élève (hors-ligne)"
      >
        {offlineEnrollingEntryId && (
          <OfflineEnrollFields
            entryId={offlineEnrollingEntryId}
            onDone={() => setOfflineEnrollingEntryId(null)}
            onSkip={() => setOfflineEnrollingEntryId(null)}
          />
        )}
      </Modal>
    </>
  );
}
