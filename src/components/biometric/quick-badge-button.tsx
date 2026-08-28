"use client";

import { useState } from "react";
import { IdCard } from "lucide-react";
import { getStudentCard, issueStudentCard } from "@/lib/api/student-card";
import type { StudentCard } from "@/lib/types/student-card";
import { StudentCardPreview } from "@/features/students/components/student-card-preview";
import { Button } from "@/components/ui/button";
import { notifyError } from "@/lib/feedback";

/**
 * Émission/consultation de la carte élève (le vrai « Badge » — carte scolaire avec photo, QR sécurisé
 * et couleurs de l'école, identique à l'onglet Cartes scolaires) en un clic depuis une liste (classe,
 * élèves…) : plus besoin d'aller sur Cartes scolaires, chercher l'élève par son nom puis émettre. Sans
 * photo, la carte affiche les initiales — jamais bloquant.
 */
export function QuickBadgeButton({ studentId, studentName, studentNumber, photoUrl, classId, size = "sm" }: {
  studentId: number; studentName: string; studentNumber?: string | null; photoUrl?: string | null;
  classId?: number | null; size?: "sm" | "md";
}) {
  const [card, setCard] = useState<StudentCard | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function openBadge() {
    setLoading(true);
    try {
      const existing = await getStudentCard(studentId).catch(() => null);
      const c = existing ?? await issueStudentCard(studentId, { studentNumber, photoUrl, classId });
      setCard(c);
      setOpen(true);
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }

  return (
    <>
      <Button size={size} variant="ghost" leftSection={<IdCard className="h-4 w-4" />} onClick={openBadge} loading={loading}>
        Badge
      </Button>
      <StudentCardPreview card={card} studentName={studentName} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
