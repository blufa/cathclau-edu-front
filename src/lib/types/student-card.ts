/** Student-cards contracts mirrored from the backend studentcards module. */

export type CardStatus = "ACTIVE" | "EXPIRED" | "LOST" | "REPLACED";
export type CardOrientation = "LANDSCAPE" | "PORTRAIT";

export const CARD_STATUS_LABEL: Record<CardStatus, string> = {
  ACTIVE: "Active", EXPIRED: "Expirée", LOST: "Perdue", REPLACED: "Remplacée",
};

export interface CardTemplate {
  id: number;
  tenantId: number | null;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  backgroundUrl: string | null;
  orientation: CardOrientation | null;
  rectoConfig: string | null;
  versoConfig: string | null;
  isDefault: boolean | null;
  active: boolean | null;
}

export interface StudentCard {
  id: number;
  tenantId: number | null;
  studentId: number;
  cardTemplateId: number | null;
  academicYearId: number | null;
  classId: number | null;
  studentNumber: string | null;
  cardNumber: string | null;
  qrPayload: string | null;
  qrSignature: string | null;
  photoUrl: string | null;
  issueDate: string | null;
  expirationDate: string | null;
  status: CardStatus;
  pdfUrl: string | null;
  replacesCardId: number | null;
  createdAt: string | null;
}
