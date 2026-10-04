export interface AuditLogEntry {
  id: number;
  tenantId: number | null;
  utilisateurId: number | null;
  action: string;
  ressource: string;
  ressourceId: number | null;
  details: string | null;
  createdAt: string;
}

/** Actions visibles côté école (hors actions plateforme, jamais retournées par /audit-logs). */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  LOGIN: "Connexion",
  ROLE_ASSIGNED: "Rôle attribué",
  PERMISSIONS_MODIFIED: "Permissions modifiées",
  PAYMENT_SUCCEEDED: "Paiement réussi",
  PAYMENT_REFUNDED: "Paiement remboursé",
  STUDENT_CREATED: "Élève créé",
  STUDENT_ARCHIVED: "Élève archivé",
  ENROLLMENT_CREATED: "Inscription créée",
  ENROLLMENT_VALIDATED: "Inscription validée",
  ENROLLMENT_CANCELLED: "Inscription annulée",
  ENROLLMENT_ABANDONED: "Inscription abandonnée",
  INVOICE_GENERATED: "Facture générée",
  EXEMPTION_GRANTED: "Exonération accordée",
  CASHIER_SESSION_CLOSED: "Clôture de caisse",
  CASH_COLLECTED_WITHOUT_OPEN_SESSION: "Encaissement sans session ouverte",
  LESSON_VALIDATED_WITHOUT_CHECKIN: "Séance validée sans pointage",
  UNDECLARED_ATTENDANCE: "Présence sans inscription déclarée",
};

// Actions à mettre en évidence (§retour fondateurs, contrôle anti-fraude) : toujours le signal d'une
// anomalie potentielle, jamais une opération de routine — distinct visuellement dans le tableau.
export const AUDIT_FRAUD_ACTIONS = new Set([
  "CASHIER_SESSION_CLOSED",
  "CASH_COLLECTED_WITHOUT_OPEN_SESSION",
  "LESSON_VALIDATED_WITHOUT_CHECKIN",
  "UNDECLARED_ATTENDANCE",
]);
