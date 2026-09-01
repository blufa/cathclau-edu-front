import Dexie, { type Table } from "dexie";
import type { GroupPaymentInput } from "@/lib/api/payment";
import type { CreateStudentInput, EnrollmentType } from "@/lib/types/student";
import type { CreateTeacherInput } from "@/lib/types/staff";
import type { ParentInput, Relationship } from "@/lib/api/parents";

export type QueuedPaymentStatus = "pending" | "failed";

export interface QueuedGroupPayment {
  /** UUID généré côté client — sert aussi de clé d'idempotence envoyée au serveur. */
  id: string;
  input: GroupPaymentInput;
  /** Tous les élèves couverts (fratrie) — permet de retrouver les paiements en attente d'un élève
   * donné depuis sa fiche, sans parcourir toute la file. */
  studentIds: number[];
  createdAt: string;
  status: QueuedPaymentStatus;
  attempts: number;
  lastError?: string;
}

export interface ReadCacheEntry {
  /** Clé arbitraire choisie par l'appelant (ex. "teacher-schedule:5") — voir use-cached-query.ts. */
  key: string;
  payload: unknown;
  updatedAt: string;
}

export type QueuedEnrollmentStatus = "pending" | "failed";

export interface QueuedEnrollment {
  /** UUID généré côté client — sert aussi de clé d'idempotence envoyée au serveur pour l'élève. */
  id: string;
  studentInput: CreateStudentInput;
  /** Classe/année choisies pour l'inscription — null si laissée pour plus tard (« Inscrire plus tard »,
   * voir offline-enroll-fields.tsx) ; l'élève reste alors seul dans le bundle jusqu'à ce qu'un agent
   * complète l'inscription manuellement une fois synchronisé. */
  enroll: { classId: number; academicYearId: number; type: EnrollmentType } | null;
  createdAt: string;
  status: QueuedEnrollmentStatus;
  attempts: number;
  lastError?: string;
}

export type QueuedTeacherStatus = "pending" | "failed";

export interface QueuedTeacher {
  /** UUID généré côté client — sert aussi de clé d'idempotence envoyée au serveur. */
  id: string;
  input: CreateTeacherInput;
  createdAt: string;
  status: QueuedTeacherStatus;
  attempts: number;
  lastError?: string;
}

export type QueuedParentStatus = "pending" | "failed";

export interface QueuedParent {
  /** UUID généré côté client — sert aussi de clé d'idempotence si un nouveau parent doit être créé. */
  id: string;
  /** null = lier un parent EXISTANT réel (existingParentId renseigné) plutôt qu'en créer un nouveau. */
  parentInput: ParentInput | null;
  existingParentId: number | null;
  /** Toujours réel : ParentsManager n'opère jamais sur un élève encore provisoire (voir Contexte du plan). */
  studentId: number;
  relationship: Relationship;
  createdAt: string;
  status: QueuedParentStatus;
  attempts: number;
  lastError?: string;
}

class LacaOfflineDb extends Dexie {
  paymentQueue!: Table<QueuedGroupPayment, string>;
  /** Dernières données lues avec succès pour les écrans de consultation (emploi du temps, référentiels
   * année/classe…) — affichées immédiatement au chargement pendant qu'un rafraîchissement réseau tente
   * de les mettre à jour en tâche de fond (voir use-cached-query.ts). Jamais utilisée pour de l'écriture. */
  readCache!: Table<ReadCacheEntry, string>;
  /** Élèves créés hors-ligne (+ inscription optionnelle) en attente de synchronisation — §students. */
  enrollmentQueue!: Table<QueuedEnrollment, string>;
  /** Enseignants créés hors-ligne en attente de synchronisation — §staff. */
  teacherQueue!: Table<QueuedTeacher, string>;
  /** Parents créés/liés hors-ligne en attente de synchronisation — §students. */
  parentQueue!: Table<QueuedParent, string>;

  constructor() {
    super("laca-offline");
    this.version(1).stores({
      paymentQueue: "id, status, createdAt, *studentIds",
    });
    this.version(2).stores({
      paymentQueue: "id, status, createdAt, *studentIds",
      readCache: "key",
    });
    this.version(3).stores({
      paymentQueue: "id, status, createdAt, *studentIds",
      readCache: "key",
      enrollmentQueue: "id, status, createdAt",
    });
    this.version(4).stores({
      paymentQueue: "id, status, createdAt, *studentIds",
      readCache: "key",
      enrollmentQueue: "id, status, createdAt",
      teacherQueue: "id, status, createdAt",
      parentQueue: "id, status, createdAt, studentId",
    });
  }
}

/** Base IndexedDB locale — file d'attente des encaissements guichet enregistrés hors-ligne (§payments,
 * PLAN-OFFLINE-DPE.md). Capacité largement suffisante pour une école entière, contrairement à
 * localStorage (réservé aux tokens/préférences UI, voir lib/auth/tokens.ts et store/sidebar-store.ts). */
export const offlineDb = new LacaOfflineDb();
