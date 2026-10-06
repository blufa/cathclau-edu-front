import { formatGNF } from "@/lib/format";

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
  ACCOUNTANT_ANOMALY_DETECTED: "Écart statistique comptable détecté",
  ACCOUNTANT_ANOMALY_RESOLVED: "Écart statistique comptable résolu",
  SCHOOL_FEE_CREATED: "Frais scolaire créé",
  SCHOOL_FEE_DELETED: "Frais scolaire supprimé",
  INSTALLMENT_CREATED: "Échéance créée",
  INSTALLMENT_DELETED: "Échéance supprimée",
};

// Actions à mettre en évidence (§retour fondateurs, contrôle anti-fraude) : toujours le signal d'une
// anomalie potentielle, jamais une opération de routine — distinct visuellement dans le tableau.
export const AUDIT_FRAUD_ACTIONS = new Set([
  "CASHIER_SESSION_CLOSED",
  "CASH_COLLECTED_WITHOUT_OPEN_SESSION",
  "LESSON_VALIDATED_WITHOUT_CHECKIN",
  "UNDECLARED_ATTENDANCE",
  "ACCOUNTANT_ANOMALY_DETECTED",
  "SCHOOL_FEE_DELETED",
  "INSTALLMENT_DELETED",
]);

/** Nom technique de `ressource` (toujours le nom de la classe Java, voir AuditEventListener) traduit
 * pour un public non technique (§retour fondateurs : jamais de jargon brut à l'écran). */
export const AUDIT_RESOURCE_LABEL: Record<string, string> = {
  User: "Utilisateur",
  Role: "Rôle",
  Tenant: "École",
  Payment: "Paiement",
  Student: "Élève",
  Enrollment: "Inscription",
  Invoice: "Facture",
  Exemption: "Exonération",
  CashierSession: "Session de caisse",
  LessonEntry: "Séance",
  AccountantAnomalyAlert: "Alerte comptable",
  SchoolFee: "Frais scolaire",
  Installment: "Échéance",
};

/** Libellé de chaque clé pouvant apparaître dans `details` (format brut "clé=valeur;clé2=valeur2",
 * voir AuditEventListener côté serveur). */
const DETAIL_KEY_LABEL: Record<string, string> = {
  roleId: "Rôle", schoolName: "École", invoiceId: "Facture", amount: "Montant",
  studentNumber: "Matricule", studentId: "Élève", classId: "Classe", type: "Type",
  academicYearId: "Année scolaire", reference: "Référence", percentage: "Pourcentage",
  reason: "Motif", systemTotal: "Total système", physicalCount: "Comptant physique",
  discrepancy: "Écart", teacherId: "Enseignant", lessonDate: "Date de séance", date: "Date",
  metricValue: "Valeur", peerAverage: "Moyenne des pairs",
  label: "Libellé", feeId: "Frais", academicYear: "Année scolaire", dueDate: "Échéance",
};

const MONETARY_DETAIL_KEYS = new Set([
  "amount", "systemTotal", "physicalCount", "discrepancy", "metricValue", "peerAverage",
]);

/** Clés faisant référence à une AUTRE ressource par identifiant — affichées "Libellé #valeur"
 * plutôt que "Libellé : valeur", pour rester lisible sans prétendre être un montant/texte libre. */
const REFERENCE_DETAIL_KEYS = new Set([
  "invoiceId", "studentId", "classId", "teacherId", "academicYearId", "roleId", "feeId",
]);

/** Transforme le `details` technique ("invoiceId=null;amount=80000") en texte lisible
 * ("Montant : 80 000 GNF") — les valeurs nulles/absentes sont omises plutôt qu'affichées comme
 * "null" (§retour fondateurs : jamais de jargon brut à l'écran). */
export function formatAuditDetails(details: string | null): string {
  if (!details) return "—";
  const parts = details.split(";").flatMap((segment) => {
    const idx = segment.indexOf("=");
    if (idx === -1) return [];
    const key = segment.slice(0, idx);
    const value = segment.slice(idx + 1);
    if (value === "" || value === "null") return [];
    const label = DETAIL_KEY_LABEL[key] ?? key;
    if (MONETARY_DETAIL_KEYS.has(key)) return [`${label} : ${formatGNF(value)}`];
    if (key === "percentage") return [`${label} : ${value} %`];
    if (REFERENCE_DETAIL_KEYS.has(key)) return [`${label} #${value}`];
    return [`${label} : ${value}`];
  });
  return parts.length > 0 ? parts.join(" · ") : "—";
}
