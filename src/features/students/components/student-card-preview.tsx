"use client";

import { Modal } from "@/components/ui/modal";
import { CARD_STATUS_LABEL, type StudentCard } from "@/lib/types/student-card";
import { IdBadge, type IdBadgeField } from "@/components/cards/id-badge";
import { useBranding } from "@/providers/branding-provider";
import { buildIdentityQr } from "@/lib/identity-qr";

/** In-app visual preview of a student card (badge élève), using the school branding + real QR code. */
export function StudentCardPreview({
  card, studentName, className, open, onClose,
}: {
  card: StudentCard | null;
  studentName?: string | null;
  className?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const fields: IdBadgeField[] = card
    ? [
        { label: "Matricule", value: card.studentNumber ?? "—", mono: true },
        { label: "N° carte", value: card.cardNumber ?? "—", mono: true },
        { label: "Émission", value: card.issueDate ?? "—" },
        { label: "Expiration", value: card.expirationDate ?? "—" },
        { label: "Statut", value: CARD_STATUS_LABEL[card.status] },
      ]
    : [];

  // QR lisible : école + nom + matricule. Le scanner de présence en extrait le matricule pour
  // retrouver l'élève (plus de format technique « LACA|tenant|… »).
  const schoolName = useBranding().branding?.schoolName ?? null;
  const qrData = card
    ? buildIdentityQr({ schoolName, fullName: studentName, matricule: card.studentNumber })
    : null;

  return (
    <Modal open={open} onClose={onClose} title="Badge élève">
      {!card ? (
        <p className="py-8 text-center text-sm text-slate-400">Aucune carte.</p>
      ) : (
        <IdBadge
          kind="Carte scolaire"
          fullName={studentName?.trim() || `Élève ${card.studentNumber ?? ""}`.trim()}
          subtitle={className ?? undefined}
          photoUrl={card.photoUrl}
          fields={fields}
          qrData={qrData}
          footerNote="QR sécurisé — vérifiable par scan à l'entrée de l'établissement."
        />
      )}
    </Modal>
  );
}
