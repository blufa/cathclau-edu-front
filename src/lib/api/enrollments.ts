import { api } from "@/lib/api/client";
import type { Enrollment, EnrollInput, EnrollmentSearchParams } from "@/lib/types/student";

export function searchEnrollments(params: EnrollmentSearchParams): Promise<Enrollment[]> {
  return api.get<Enrollment[]>("/enrollments", {
    query: {
      studentId: params.studentId,
      classId: params.classId,
      academicYearId: params.academicYearId,
      status: params.status,
    },
  });
}

export function enroll(input: EnrollInput): Promise<Enrollment> {
  return api.post<Enrollment>("/enrollments", input);
}

export function reenroll(input: EnrollInput): Promise<Enrollment> {
  return api.post<Enrollment>("/enrollments/re-enrollment", input);
}

/** Modify a pending enrollment (class / academic year / type). */
export function updateEnrollment(id: number, input: EnrollInput): Promise<Enrollment> {
  return api.put<Enrollment>(`/enrollments/${id}`, input);
}

export function validateEnrollment(id: number): Promise<Enrollment> {
  return api.patch<Enrollment>(`/enrollments/${id}/validate`);
}

export function cancelEnrollment(id: number): Promise<Enrollment> {
  return api.patch<Enrollment>(`/enrollments/${id}/cancel`);
}

/** Marque une inscription validée comme abandonnée (élève parti en cours d'année) — distinct de
 * l'annulation : les factures déjà émises restent dues et continuent de compter dans le taux de
 * recouvrement de la classe. */
export function abandonEnrollment(id: number): Promise<Enrollment> {
  return api.patch<Enrollment>(`/enrollments/${id}/abandon`);
}

/** Transfère une inscription validée vers une autre classe en cours d'année (ex. erreur d'orientation
 * corrigée après-coup). Si les frais de scolarité diffèrent entre les deux classes, les mensualités
 * impayées de l'ancienne classe sont annulées et tout ce qui a déjà été payé dessus est reporté en
 * crédit sur les nouvelles mensualités générées pour la nouvelle classe — sans notification de
 * paiement trompeuse pour le parent. */
export function transferEnrollmentClass(id: number, newClassId: number): Promise<Enrollment> {
  return api.patch<Enrollment>(`/enrollments/${id}/transfer-class`, { newClassId });
}

export function deleteEnrollment(id: number): Promise<void> {
  return api.delete<void>(`/enrollments/${id}`);
}

/** Modifie après coup le choix d'accès à la plateforme (le parent peut changer d'avis en cours d'année). */
export function updatePlatformAccess(id: number, optIn: boolean): Promise<Enrollment> {
  return api.patch<Enrollment>(`/enrollments/${id}/platform-access`, { optIn });
}
