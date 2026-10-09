"use client";

import { Modal } from "@/components/ui/modal";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { getStudent } from "@/lib/api/students";
import { getClass, listAcademicYears } from "@/lib/api/academics";
import { useBranding } from "@/providers/branding-provider";
import type { CardTemplate, StudentCard } from "@/lib/types/student-card";
import { IdBadge, type IdBadgeField } from "@/components/cards/id-badge";
import { buildIdentityQr } from "@/lib/identity-qr";
import { resolveBadgeColors } from "@/lib/badge-colors";
import { formatDate } from "@/lib/format";

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
  const branding = useBranding().branding;
  // Date de naissance + adresse : pas portées par StudentCard, on va les chercher sur la fiche élève
  // complète — uniquement quand la carte est affichée, pour ne pas alourdir les listes qui émettent
  // le badge en un clic.
  const studentQuery = useQuery(() => (card ? getStudent(card.studentId) : Promise.resolve(null)), [card?.studentId]);
  const student = studentQuery.data?.student;
  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const academicYearLabel = card?.academicYearId
    ? (yearsQuery.data ?? []).find((y) => y.id === card.academicYearId)?.label ?? null
    : null;
  // Repli si l'appelant n'a pas déjà résolu `className` (ex. QuickBadgeButton, qui n'a que l'id de
  // classe) : on la résout nous-mêmes depuis `card.classId`, pour que la classe s'affiche quel que
  // soit l'écran d'où le badge est ouvert.
  const resolvedClassQuery = useQuery(
    () => (!className && card?.classId ? getClass(card.classId) : Promise.resolve(null)),
    [className, card?.classId],
  );
  const classLabel = className ?? resolvedClassQuery.data?.label ?? null;

  const fields: IdBadgeField[] = card
    ? [
        { label: "Classe", value: classLabel ?? "—" },
        { label: "Né le", value: formatDate(student?.birthDate) },
        { label: "Adresse", value: student?.address ?? "—" },
        { label: "Tél.", value: branding?.phone ?? "—" },
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
          kind="Badge élève"
          fullName={studentName?.trim() || `Élève ${card.studentNumber ?? ""}`.trim()}
          firstName={student?.firstName}
          lastName={student?.lastName}
          photoUrl={card.photoUrl}
          fields={fields}
          idNumber={card.studentNumber}
          validUntil={card.expirationDate ? formatDate(card.expirationDate) : null}
          academicYearLabel={academicYearLabel}
          qrData={qrData}
          footerNote="QR sécurisé — vérifiable par scan à l'entrée de l'établissement."
          primaryColor={colors.primaryColor}
          secondaryColor={colors.secondaryColor}
          orientation={colors.orientation}
        />
      )}
    </Modal>
  );
}
