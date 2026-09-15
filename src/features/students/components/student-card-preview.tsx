"use client";

import { Modal } from "@/components/ui/modal";
import type { CardTemplate, StudentCard } from "@/lib/types/student-card";
import { IdBadge, type IdBadgeField } from "@/components/cards/id-badge";
import { buildIdentityQr } from "@/lib/identity-qr";
import { resolveBadgeColors } from "@/lib/badge-colors";

/** In-app visual preview of a student card (badge élève), using the school branding + real QR code. */
export function StudentCardPreview({
  card, studentName, className, open, onClose, templates,
}: {
  card: StudentCard | null;
  studentName?: string | null;
  className?: string | null;
  open: boolean;
  onClose: () => void;
  /** Modèles de badge du tenant (tous types confondus) — sert à résoudre les couleurs du modèle élève
   * par défaut ; passé par la page parente qui les a déjà chargés. */
  templates?: CardTemplate[];
}) {
  const fields: IdBadgeField[] = card
    ? [
        { label: "Matricule", value: card.studentNumber ?? "—", mono: true },
        { label: "N° carte", value: card.cardNumber ?? "—", mono: true },
      ]
    : [];
  const colors = resolveBadgeColors(templates, "STUDENT");

  // QR lisible : type + nom + matricule. Le scanner de présence lit directement le type pour
  // chercher dans la bonne liste (plus de format technique « LACA|tenant|… », ni de risque de
  // confondre un élève et un enseignant/employé partageant le même matricule).
  const qrData = card
    ? buildIdentityQr({ type: "STUDENT", fullName: studentName, matricule: card.studentNumber })
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
          primaryColor={colors.primaryColor}
          secondaryColor={colors.secondaryColor}
        />
      )}
    </Modal>
  );
}
