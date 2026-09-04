"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, AlertTriangle, X } from "lucide-react";
import { useNetworkStore, wireNetworkListeners } from "@/lib/offline/network-store";
import { useSyncQueueStore } from "@/lib/offline/sync-queue-store";
import { useEnrollmentQueueStore } from "@/lib/offline/enrollment-queue-store";
import { useTeacherQueueStore } from "@/lib/offline/teacher-queue-store";
import { useParentQueueStore } from "@/lib/offline/parent-queue-store";
import {
  wireSyncTriggers, processQueue, retryFailedEntry, discardFailedEntry,
  processEnrollmentQueue, retryFailedEnrollmentEntry, discardFailedEnrollmentEntry,
  processTeacherQueue, retryFailedTeacherEntry, discardFailedTeacherEntry,
  processParentQueue, retryFailedParentEntry, discardFailedParentEntry,
} from "@/lib/offline/sync-engine";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatGNF } from "@/lib/format";
import { RELATIONSHIP_LABEL } from "@/lib/api/parents";

/**
 * Bandeau global d'état hors-ligne — monté une fois dans la coquille applicative (voir
 * app-shell.tsx). Invisible en ligne avec les quatre files vides ; sinon reflète l'état réel :
 * hors-ligne (encaissements guichet, inscriptions élèves, enseignants, parents toujours possibles, en
 * file), synchronisation en cours, ou entrées en échec nécessitant une intervention manuelle (voir
 * sync-engine.ts). Agrège quatre files indépendantes sous un même compteur, avec le détail par type
 * dans la modale d'échecs.
 */
export function OfflineBanner() {
  const online = useNetworkStore((s) => s.online);
  const paymentItems = useSyncQueueStore((s) => s.items);
  const paymentSyncing = useSyncQueueStore((s) => s.syncing);
  const enrollmentItems = useEnrollmentQueueStore((s) => s.items);
  const enrollmentSyncing = useEnrollmentQueueStore((s) => s.syncing);
  const teacherItems = useTeacherQueueStore((s) => s.items);
  const teacherSyncing = useTeacherQueueStore((s) => s.syncing);
  const parentItems = useParentQueueStore((s) => s.items);
  const parentSyncing = useParentQueueStore((s) => s.syncing);
  const [showFailed, setShowFailed] = useState(false);

  useEffect(() => {
    wireNetworkListeners();
    wireSyncTriggers();
  }, []);

  const syncing = paymentSyncing || enrollmentSyncing || teacherSyncing || parentSyncing;
  const pendingPayments = paymentItems.filter((i) => i.status === "pending");
  const failedPayments = paymentItems.filter((i) => i.status === "failed");
  const pendingEnrollments = enrollmentItems.filter((i) => i.status === "pending");
  const failedEnrollments = enrollmentItems.filter((i) => i.status === "failed");
  const pendingTeachers = teacherItems.filter((i) => i.status === "pending");
  const failedTeachers = teacherItems.filter((i) => i.status === "failed");
  const pendingParents = parentItems.filter((i) => i.status === "pending");
  const failedParents = parentItems.filter((i) => i.status === "failed");
  const pendingTotal = pendingPayments.length + pendingEnrollments.length + pendingTeachers.length + pendingParents.length;
  const failedTotal = failedPayments.length + failedEnrollments.length + failedTeachers.length + failedParents.length;
  const totalItems = paymentItems.length + enrollmentItems.length + teacherItems.length + parentItems.length;

  if (online && totalItems === 0) return null;

  function retryAll() {
    void processQueue();
    void processEnrollmentQueue();
    void processTeacherQueue();
    void processParentQueue();
  }

  return (
    <>
      <div
        className={
          "mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium " +
          (!online
            ? "border-warning-200 bg-warning-50 text-warning-800"
            : failedTotal > 0
              ? "border-error-200 bg-error-50 text-error-800"
              : "border-info-200 bg-info-50 text-info-800")
        }
      >
        <div className="flex items-center gap-2">
          {!online ? (
            <>
              <WifiOff className="h-4 w-4" />
              <span>
                Hors-ligne — encaissements en espèces, inscriptions d&apos;élèves, enseignants et
                parents continuent de fonctionner
                {pendingTotal > 0 ? ` (${pendingTotal} en attente de synchronisation)` : ""}.
              </span>
            </>
          ) : syncing || pendingTotal > 0 ? (
            <>
              <RefreshCw className={"h-4 w-4" + (syncing ? " animate-spin" : "")} />
              <span>Synchronisation — {pendingTotal} en attente.</span>
            </>
          ) : null}
          {failedTotal > 0 && (
            <>
              <AlertTriangle className="h-4 w-4" />
              <button type="button" className="underline" onClick={() => setShowFailed(true)}>
                {failedTotal} en échec — voir le détail
              </button>
            </>
          )}
        </div>
        {online && pendingTotal > 0 && (
          <Button size="sm" variant="secondary" onClick={retryAll} loading={syncing}>
            Réessayer maintenant
          </Button>
        )}
      </div>

      <Modal open={showFailed} onClose={() => setShowFailed(false)} title="Éléments en échec">
        <div className="space-y-3">
          {failedTotal === 0 ? (
            <p className="text-sm text-slate-500">Rien en échec.</p>
          ) : (
            <>
              {failedPayments.map((entry) => (
                <div key={`payment-${entry.id}`} className="rounded-lg border border-error-100 bg-error-50/40 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-700">Paiement · {entry.input.coverageLabel}</span>
                    <span className="text-slate-600">
                      {formatGNF(entry.input.shares.reduce((s, x) => s + x.amount, 0))}
                    </span>
                  </div>
                  {entry.lastError && <p className="mt-1 text-xs text-error-600">{entry.lastError}</p>}
                  <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" leftSection={<X className="h-3.5 w-3.5" />}
                      onClick={() => void discardFailedEntry(entry.id)}>
                      Ignorer
                    </Button>
                    <Button size="sm" onClick={() => void retryFailedEntry(entry.id)}>Réessayer</Button>
                  </div>
                </div>
              ))}
              {failedEnrollments.map((entry) => (
                <div key={`enrollment-${entry.id}`} className="rounded-lg border border-error-100 bg-error-50/40 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-700">
                      Élève · {entry.studentInput.firstName} {entry.studentInput.lastName}
                    </span>
                  </div>
                  {entry.lastError && <p className="mt-1 text-xs text-error-600">{entry.lastError}</p>}
                  <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" leftSection={<X className="h-3.5 w-3.5" />}
                      onClick={() => void discardFailedEnrollmentEntry(entry.id)}>
                      Ignorer
                    </Button>
                    <Button size="sm" onClick={() => void retryFailedEnrollmentEntry(entry.id)}>Réessayer</Button>
                  </div>
                </div>
              ))}
              {failedTeachers.map((entry) => (
                <div key={`teacher-${entry.id}`} className="rounded-lg border border-error-100 bg-error-50/40 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-700">
                      Enseignant · {entry.input.firstName} {entry.input.lastName}
                    </span>
                  </div>
                  {entry.lastError && <p className="mt-1 text-xs text-error-600">{entry.lastError}</p>}
                  <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" leftSection={<X className="h-3.5 w-3.5" />}
                      onClick={() => void discardFailedTeacherEntry(entry.id)}>
                      Ignorer
                    </Button>
                    <Button size="sm" onClick={() => void retryFailedTeacherEntry(entry.id)}>Réessayer</Button>
                  </div>
                </div>
              ))}
              {failedParents.map((entry) => (
                <div key={`parent-${entry.id}`} className="rounded-lg border border-error-100 bg-error-50/40 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-700">
                      Parent · {entry.parentInput ? `${entry.parentInput.firstName} ${entry.parentInput.lastName}` : `#${entry.existingParentId}`}
                      {" "}({RELATIONSHIP_LABEL[entry.relationship]})
                    </span>
                  </div>
                  {entry.lastError && <p className="mt-1 text-xs text-error-600">{entry.lastError}</p>}
                  <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" leftSection={<X className="h-3.5 w-3.5" />}
                      onClick={() => void discardFailedParentEntry(entry.id)}>
                      Ignorer
                    </Button>
                    <Button size="sm" onClick={() => void retryFailedParentEntry(entry.id)}>Réessayer</Button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
