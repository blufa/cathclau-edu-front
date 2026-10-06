"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FilePreview } from "@/components/ui/file-preview";
import { listPaymentsByStudent, getReceiptPdfObjectUrl } from "@/lib/api/payment";
import { mergePdfsForPrint } from "@/lib/print-node";
import { notifyError, notifyInfo } from "@/lib/feedback";
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
  students: { id: number; name: string; classId: number | null; className?: string | null }[];
  tenantId: number;
  open: boolean;
  onClose: () => void;
}) {
  const [printingAll, setPrintingAll] = useState(false);
  const [mergedPreview, setMergedPreview] = useState<string | null>(null);

  /**
   * Un seul clic imprime le reçu le plus récent de CHAQUE enfant déjà encaissé dans cette fenêtre
   * (§retour comptable : "il encaisse chaque enfant puis clique une seule fois sur imprimer"). Les
   * reçus sont d'abord FUSIONNÉS en un seul vrai PDF (voir mergePdfsForPrint — plusieurs iframes
   * empilées avec un saut de page CSS a été essayé d'abord mais rognait les reçus, chaque iframe
   * ayant une hauteur fixe qui ne correspond pas à une page papier), puis ouverts dans le même
   * aperçu que pour un reçu unique (FilePreview, `autoPrint`) : retour terrain, même sur UN SEUL
   * reçu, imprimer un PDF caché via window.print() sur le document principal le rognait aussi sur le
   * web — seule l'impression de l'iframe VISIBLE elle-même (iframe.contentWindow.print(), géré dans
   * FilePreview) est fiable là-bas.
   */
  async function printAllReceipts() {
    setPrintingAll(true);
    try {
      const latestPayments = await Promise.all(students.map(async (s) => {
        const payments = await listPaymentsByStudent(s.id);
        const succeeded = payments.filter((p) => p.status === "SUCCEEDED");
        return succeeded.sort((a, b) => b.id - a.id)[0] ?? null;
      }));
      const toPrint = latestPayments.filter((p): p is NonNullable<typeof p> => p != null);
      if (toPrint.length === 0) {
        notifyInfo("Aucun reçu à imprimer — encaissez au moins un enfant d'abord.");
        return;
      }
      const urls = await Promise.all(toPrint.map((p) => getReceiptPdfObjectUrl(p.id)));
      const mergedUrl = await mergePdfsForPrint(urls);
      urls.forEach((u) => URL.revokeObjectURL(u));
      setMergedPreview(mergedUrl);
    } catch (err) {
      notifyError(err);
    } finally {
      setPrintingAll(false);
    }
  }

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={`Encaissement — ${students.length} élève${students.length > 1 ? "s" : ""}`}
      className="max-w-[95vw] max-h-[90vh] overflow-y-auto"
    >
      {students.length === 0 ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Aucun élève à encaisser.</p>
      ) : (
        <>
        <div className="mb-4 flex justify-end">
          <Button variant="secondary" size="sm" leftSection={<Printer className="h-4 w-4" />}
            onClick={printAllReceipts} loading={printingAll}>
            Imprimer tous les reçus
          </Button>
        </div>
        {/* Deux colonnes sur grand écran : avec 5-6 enfants inscrits d'un coup, un seul long
            défilement vertical serait impraticable — pleinement indépendant, l'ordre d'affichage
            n'a pas d'importance. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {students.map((student) => (
            <div key={student.id} className="rounded-xl border border-gray-100 p-4">
              <h3 className="mb-3 flex items-baseline gap-2 text-base font-semibold text-gray-900">
                {student.name}
                {student.className && <span className="text-sm font-normal text-gray-400">· {student.className}</span>}
              </h3>
              <StudentInvoicesPanel
                studentId={student.id}
                tenantId={tenantId}
                classId={student.classId ?? undefined}
                onCollected={() => {}}
              />
            </div>
          ))}
        </div>
        </>
      )}
    </Modal>
    <FilePreview
      url={mergedPreview}
      title="Tous les reçus"
      open={mergedPreview != null}
      onClose={() => setMergedPreview(null)}
      autoPrint
    />
    </>
  );
}
