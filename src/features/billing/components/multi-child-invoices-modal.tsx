"use client";

import { Modal } from "@/components/ui/modal";
import { StudentInvoicesPanel } from "./student-invoices-panel";

/**
 * Encaissement de plusieurs enfants juste après une inscription groupée (§retour comptable) : un
 * raccourci pour éviter l'aller-retour par la liste des élèves, PAS un paiement combiné — chaque
 * enfant garde exactement le même écran "Factures" que sur sa propre fiche (transport, tranches,
 * remises...), encaissé et reçu indépendamment des autres. Voir {@link CollectFeeModal} (même contenu,
 * un seul enfant) ; contrairement à `MultiChildCollectModal`, qui fusionne tout en un seul paiement/
 * reçu — adapté à une fratrie qui règle ensemble, pas à ce cas.
 */
export function MultiChildInvoicesModal({
  students, tenantId, open, onClose,
}: {
  students: { id: number; name: string; classId: number | null }[];
  tenantId: number;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Encaissement — ${students.length} élève${students.length > 1 ? "s" : ""}`}
      className="max-w-4xl max-h-[90vh] overflow-y-auto"
    >
      {students.length === 0 ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Aucun élève à encaisser.</p>
      ) : (
        <div className="space-y-8">
          {students.map((student, i) => (
            <div key={student.id} className={i > 0 ? "border-t border-gray-100 pt-6" : ""}>
              <h3 className="mb-3 text-base font-semibold text-gray-900">{student.name}</h3>
              <StudentInvoicesPanel
                studentId={student.id}
                tenantId={tenantId}
                classId={student.classId ?? undefined}
                onCollected={() => {}}
              />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
