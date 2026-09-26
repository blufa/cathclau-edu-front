"use client";

import { Modal } from "@/components/ui/modal";
import { StudentInvoicesPanel } from "./student-invoices-panel";

/**
 * Ouvre les factures de l'élève dans une modale pour les encaisser au guichet — enveloppe fine autour
 * de {@link StudentInvoicesPanel} (le contenu réutilisé tel quel dans l'onglet "Factures" de la fiche
 * élève, §retour comptable refonte inscription §5.7).
 */
export function CollectFeeModal({
  studentId, tenantId, classId, open, onClose, onCollected,
}: {
  studentId: number;
  tenantId: number;
  /** Classe de l'élève — permet de générer les mensualités à partir du frais MENSUALITE de la classe. */
  classId?: number;
  open: boolean;
  onClose: () => void;
  onCollected: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Facture & encaissement">
      <StudentInvoicesPanel studentId={studentId} tenantId={tenantId} classId={classId} onCollected={onCollected} />
    </Modal>
  );
}
