import { initiateGroupPayment, type GroupPaymentInput } from "@/lib/api/payment";
import { createStudent } from "@/lib/api/students";
import { enroll, reenroll, searchEnrollments } from "@/lib/api/enrollments";
import { createTeacher } from "@/lib/api/staff";
import { createParent, getStudentParents, linkParentToStudent, type Relationship } from "@/lib/api/parents";
import {
  recordEmployeeManualEntry,
  recordEmployeeManualExit,
  recordStudentManualEntry,
  recordStudentManualExit,
  recordTeacherManualEntry,
  recordTeacherManualExit,
  scanAttendance,
  type ScanSubjectType,
} from "@/lib/api/attendance";
import type { ScanDirection } from "@/lib/types/attendance";
import { ApiError, isNetworkError } from "@/lib/api/errors";
import type { CreateStudentInput, EnrollmentType } from "@/lib/types/student";
import type { CreateTeacherInput } from "@/lib/types/staff";
import type { ParentInput } from "@/lib/api/parents";
import { enterBulkGrades } from "@/lib/api/grading";
import {
  offlineDb,
  type QueuedAttendance,
  type QueuedAttendanceAction,
  type QueuedEnrollment,
  type QueuedGradeEntry,
  type QueuedGroupPayment,
  type QueuedParent,
  type QueuedTeacher,
} from "./db";
import { useNetworkStore } from "./network-store";
import { useSyncQueueStore } from "./sync-queue-store";
import { useEnrollmentQueueStore } from "./enrollment-queue-store";
import { useTeacherQueueStore } from "./teacher-queue-store";
import { useParentQueueStore } from "./parent-queue-store";
import { useAttendanceQueueStore } from "./attendance-queue-store";
import { useGradeQueueStore } from "./grade-queue-store";

async function refreshQueueSnapshot(): Promise<void> {
  const items = await offlineDb.paymentQueue.orderBy("createdAt").toArray();
  useSyncQueueStore.getState().setItems(items);
}

/** Enregistre un encaissement guichet localement (réseau indisponible) — l'id généré sert aussi de
 * clé d'idempotence envoyée au serveur lors de la synchronisation. */
export async function enqueuePayment(input: GroupPaymentInput): Promise<QueuedGroupPayment> {
  const id = crypto.randomUUID();
  const entry: QueuedGroupPayment = {
    id,
    input: { ...input, idempotencyKey: id },
    studentIds: [...new Set(input.shares.map((s) => s.studentId ?? input.studentId))],
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
  };
  await offlineDb.paymentQueue.add(entry);
  await refreshQueueSnapshot();
  return entry;
}

let syncing = false;

/** Rejoue les encaissements en attente dès que le réseau revient. Un échec réseau interrompt le cycle
 * (on retentera plus tard, sans pénaliser l'entrée) ; une vraie erreur métier marque l'entrée `failed`
 * pour intervention manuelle plutôt que de boucler indéfiniment ou de la faire disparaître en silence. */
export async function processQueue(): Promise<void> {
  if (syncing || !useNetworkStore.getState().online) return;
  syncing = true;
  useSyncQueueStore.getState().setSyncing(true);
  try {
    const pending = await offlineDb.paymentQueue.where("status").equals("pending").toArray();
    for (const entry of pending) {
      try {
        await initiateGroupPayment(entry.input);
        await offlineDb.paymentQueue.delete(entry.id);
      } catch (err) {
        if (isNetworkError(err)) {
          break; // connexion à nouveau instable : on s'arrête là, cette entrée reste "pending"
        }
        await offlineDb.paymentQueue.update(entry.id, {
          status: "failed",
          attempts: entry.attempts + 1,
          lastError: err instanceof Error ? err.message : "Erreur inconnue",
        });
      }
    }
  } finally {
    syncing = false;
    useSyncQueueStore.getState().setSyncing(false);
    await refreshQueueSnapshot();
  }
}

/** Remet une entrée en échec dans la file pour une nouvelle tentative (bouton "Réessayer" du bandeau). */
export async function retryFailedEntry(id: string): Promise<void> {
  await offlineDb.paymentQueue.update(id, { status: "pending" });
  await refreshQueueSnapshot();
  await processQueue();
}

/** Supprime définitivement une entrée en échec (l'agent a résolu le problème autrement, ex. au guichet). */
export async function discardFailedEntry(id: string): Promise<void> {
  await offlineDb.paymentQueue.delete(id);
  await refreshQueueSnapshot();
}

// ── Inscriptions élèves hors-ligne (§students, Phase 2) ─────────────────────────────────────────

async function refreshEnrollmentQueueSnapshot(): Promise<void> {
  const items = await offlineDb.enrollmentQueue.orderBy("createdAt").toArray();
  useEnrollmentQueueStore.getState().setItems(items);
}

/** Enregistre un élève créé hors-ligne (réseau indisponible) — l'id généré sert aussi de clé
 * d'idempotence envoyée au serveur. L'inscription (classe/année) peut être ajoutée plus tard via
 * {@link attachEnrollmentToQueuedStudent}, ou laissée vide (« Inscrire plus tard »). */
export async function enqueueStudent(input: CreateStudentInput): Promise<QueuedEnrollment> {
  const id = crypto.randomUUID();
  const entry: QueuedEnrollment = {
    id,
    studentInput: { ...input, idempotencyKey: id },
    enroll: null,
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
  };
  await offlineDb.enrollmentQueue.add(entry);
  await refreshEnrollmentQueueSnapshot();
  return entry;
}

/** Complète une entrée déjà en file avec la classe/année choisies (formulaire d'inscription hors-ligne
 * simplifié, voir offline-enroll-fields.tsx) — sans créer une seconde entrée. */
export async function attachEnrollmentToQueuedStudent(
  entryId: string,
  enrollInput: { classId: number; academicYearId: number; type: EnrollmentType },
): Promise<void> {
  await offlineDb.enrollmentQueue.update(entryId, { enroll: enrollInput });
  await refreshEnrollmentQueueSnapshot();
}

let enrollmentSyncing = false;

/**
 * Rejoue les élèves (+ inscriptions) en attente dès que le réseau revient. Pour chaque entrée :
 * 1. Crée l'élève via son idempotencyKey (renvoie l'élève déjà créé si cette étape a déjà réussi lors
 *    d'une tentative précédente dont la réponse aurait été perdue — voir EleveService.create, V143).
 * 2. Si une classe a été choisie, inscrit l'élève avec son id réel. Un 409 (`ConflictException` levée
 *    par `requireNoActiveEnrollment`, la SEULE cause possible sur cet appel) signifie que l'inscription
 *    a en réalité déjà réussi lors d'une tentative précédente : on la retrouve via `searchEnrollments`
 *    plutôt que de marquer l'entrée en échec à tort.
 * Un échec réseau interrompt le cycle (on retentera plus tard) ; une vraie erreur métier (quota 403 à
 * la création, ou tout autre conflit sur l'inscription) marque l'entrée `failed` pour intervention
 * manuelle plutôt que de boucler indéfiniment ou de la faire disparaître en silence.
 */
export async function processEnrollmentQueue(): Promise<void> {
  if (enrollmentSyncing || !useNetworkStore.getState().online) return;
  enrollmentSyncing = true;
  useEnrollmentQueueStore.getState().setSyncing(true);
  try {
    const pending = await offlineDb.enrollmentQueue.where("status").equals("pending").toArray();
    for (const entry of pending) {
      try {
        const student = await createStudent(entry.studentInput);
        if (entry.enroll) {
          const enrollInput = {
            studentId: student.id, classId: entry.enroll.classId,
            academicYearId: entry.enroll.academicYearId, type: entry.enroll.type,
          };
          try {
            await (entry.enroll.type === "RE_ENROLLMENT" ? reenroll(enrollInput) : enroll(enrollInput));
          } catch (enrollErr) {
            if (enrollErr instanceof ApiError && enrollErr.status === 409) {
              // Déjà inscrit (tentative précédente réussie, réponse perdue) : récupération, pas un échec.
              const existing = await searchEnrollments({
                studentId: student.id, academicYearId: entry.enroll.academicYearId,
              });
              if (existing.length === 0) throw enrollErr; // conflit réel, pas une récupération possible
            } else {
              throw enrollErr;
            }
          }
        }
        await offlineDb.enrollmentQueue.delete(entry.id);
      } catch (err) {
        if (isNetworkError(err)) {
          break; // connexion à nouveau instable : on s'arrête là, cette entrée reste "pending"
        }
        await offlineDb.enrollmentQueue.update(entry.id, {
          status: "failed",
          attempts: entry.attempts + 1,
          lastError: err instanceof Error ? err.message : "Erreur inconnue",
        });
      }
    }
  } finally {
    enrollmentSyncing = false;
    useEnrollmentQueueStore.getState().setSyncing(false);
    await refreshEnrollmentQueueSnapshot();
  }
}

/** Remet une entrée en échec dans la file pour une nouvelle tentative. */
export async function retryFailedEnrollmentEntry(id: string): Promise<void> {
  await offlineDb.enrollmentQueue.update(id, { status: "pending" });
  await refreshEnrollmentQueueSnapshot();
  await processEnrollmentQueue();
}

/** Supprime définitivement une entrée en échec. */
export async function discardFailedEnrollmentEntry(id: string): Promise<void> {
  await offlineDb.enrollmentQueue.delete(id);
  await refreshEnrollmentQueueSnapshot();
}

// ── Enseignants hors-ligne (§staff, Phase 3) ────────────────────────────────────────────────────

async function refreshTeacherQueueSnapshot(): Promise<void> {
  const items = await offlineDb.teacherQueue.orderBy("createdAt").toArray();
  useTeacherQueueStore.getState().setItems(items);
}

/** Enregistre un enseignant créé hors-ligne — l'id généré sert aussi de clé d'idempotence. Pas de
 * dépendance en aval (contrairement à l'inscription élève) : l'étape « Affectations » de
 * `TeacherForm` nécessite un id réel et reste à faire après synchronisation. */
export async function enqueueTeacher(input: CreateTeacherInput): Promise<QueuedTeacher> {
  const id = crypto.randomUUID();
  const entry: QueuedTeacher = {
    id,
    input: { ...input, idempotencyKey: id },
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
  };
  await offlineDb.teacherQueue.add(entry);
  await refreshTeacherQueueSnapshot();
  return entry;
}

let teacherSyncing = false;

/** Rejoue les enseignants en attente dès que le réseau revient — même logique que `processQueue`. */
export async function processTeacherQueue(): Promise<void> {
  if (teacherSyncing || !useNetworkStore.getState().online) return;
  teacherSyncing = true;
  useTeacherQueueStore.getState().setSyncing(true);
  try {
    const pending = await offlineDb.teacherQueue.where("status").equals("pending").toArray();
    for (const entry of pending) {
      try {
        await createTeacher(entry.input);
        await offlineDb.teacherQueue.delete(entry.id);
      } catch (err) {
        if (isNetworkError(err)) {
          break;
        }
        await offlineDb.teacherQueue.update(entry.id, {
          status: "failed",
          attempts: entry.attempts + 1,
          lastError: err instanceof Error ? err.message : "Erreur inconnue",
        });
      }
    }
  } finally {
    teacherSyncing = false;
    useTeacherQueueStore.getState().setSyncing(false);
    await refreshTeacherQueueSnapshot();
  }
}

/** Remet une entrée en échec dans la file pour une nouvelle tentative. */
export async function retryFailedTeacherEntry(id: string): Promise<void> {
  await offlineDb.teacherQueue.update(id, { status: "pending" });
  await refreshTeacherQueueSnapshot();
  await processTeacherQueue();
}

/** Supprime définitivement une entrée en échec. */
export async function discardFailedTeacherEntry(id: string): Promise<void> {
  await offlineDb.teacherQueue.delete(id);
  await refreshTeacherQueueSnapshot();
}

// ── Parents hors-ligne (§students, Phase 3) ─────────────────────────────────────────────────────

async function refreshParentQueueSnapshot(): Promise<void> {
  const items = await offlineDb.parentQueue.orderBy("createdAt").toArray();
  useParentQueueStore.getState().setItems(items);
}

/** Enregistre un NOUVEAU parent + son lien à un élève réel — l'id généré sert aussi de clé
 * d'idempotence pour la création du parent. */
export async function enqueueNewParent(
  input: ParentInput, studentId: number, relationship: Relationship,
): Promise<QueuedParent> {
  const id = crypto.randomUUID();
  const entry: QueuedParent = {
    id,
    parentInput: { ...input, idempotencyKey: id },
    existingParentId: null,
    studentId, relationship,
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
  };
  await offlineDb.parentQueue.add(entry);
  await refreshParentQueueSnapshot();
  return entry;
}

/** Enregistre le lien d'un parent EXISTANT réel à un élève réel (pas de création de parent). */
export async function enqueueExistingParentLink(
  parentId: number, studentId: number, relationship: Relationship,
): Promise<QueuedParent> {
  const entry: QueuedParent = {
    id: crypto.randomUUID(),
    parentInput: null,
    existingParentId: parentId,
    studentId, relationship,
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
  };
  await offlineDb.parentQueue.add(entry);
  await refreshParentQueueSnapshot();
  return entry;
}

let parentSyncing = false;

/**
 * Rejoue les parents (création éventuelle + lien) en attente dès que le réseau revient. Pour chaque
 * entrée : crée le parent si besoin (idempotent, comme élèves/enseignants) puis relie à l'élève —
 * `student_parents` n'a AUCUNE contrainte unique côté serveur (contrairement à l'inscription élève),
 * donc la déduplication du lien se fait ici, côté client, via `getStudentParents` avant d'appeler
 * `linkParentToStudent`, pour ne jamais créer de lien en double si cette étape avait déjà réussi lors
 * d'une tentative précédente dont la réponse aurait été perdue.
 */
export async function processParentQueue(): Promise<void> {
  if (parentSyncing || !useNetworkStore.getState().online) return;
  parentSyncing = true;
  useParentQueueStore.getState().setSyncing(true);
  try {
    const pending = await offlineDb.parentQueue.where("status").equals("pending").toArray();
    for (const entry of pending) {
      try {
        const parentId = entry.parentInput
          ? (await createParent(entry.parentInput)).id
          : (entry.existingParentId as number);
        const alreadyLinked = (await getStudentParents(entry.studentId)).some((p) => p.id === parentId);
        if (!alreadyLinked) {
          await linkParentToStudent(parentId, entry.studentId, entry.relationship);
        }
        await offlineDb.parentQueue.delete(entry.id);
      } catch (err) {
        if (isNetworkError(err)) {
          break;
        }
        await offlineDb.parentQueue.update(entry.id, {
          status: "failed",
          attempts: entry.attempts + 1,
          lastError: err instanceof Error ? err.message : "Erreur inconnue",
        });
      }
    }
  } finally {
    parentSyncing = false;
    useParentQueueStore.getState().setSyncing(false);
    await refreshParentQueueSnapshot();
  }
}

/** Remet une entrée en échec dans la file pour une nouvelle tentative. */
export async function retryFailedParentEntry(id: string): Promise<void> {
  await offlineDb.parentQueue.update(id, { status: "pending" });
  await refreshParentQueueSnapshot();
  await processParentQueue();
}

/** Supprime définitivement une entrée en échec. */
export async function discardFailedParentEntry(id: string): Promise<void> {
  await offlineDb.parentQueue.delete(id);
  await refreshParentQueueSnapshot();
}

// ── Présences hors-ligne (§attendance) : scan et saisie manuelle ───────────────────────────────

async function refreshAttendanceQueueSnapshot(): Promise<void> {
  const items = await offlineDb.attendanceQueue.orderBy("createdAt").toArray();
  useAttendanceQueueStore.getState().setItems(items);
}

/** Enregistre un scan (badge, entrée/sortie) hors-ligne — l'horodatage d'origine (id/createdAt) est
 * celui du geste, pas celui de la synchronisation ultérieure. Le retard/départ anticipé n'est calculé
 * que côté serveur (emploi du temps) : aucun retour immédiat riche en mode hors-ligne, juste la mise
 * en file. */
export async function enqueueAttendanceScan(
  subjectType: ScanSubjectType, subjectId: number, direction: ScanDirection,
): Promise<QueuedAttendance> {
  return enqueueAttendanceAction({ kind: "SCAN", subjectType, subjectId, direction });
}

/** Correction manuelle hors-ligne (badge oublié, chef de classe ou personnel) : entrée. */
export async function enqueueManualEntry(
  subjectType: ScanSubjectType, subjectId: number, date: string, time: string,
): Promise<QueuedAttendance> {
  return enqueueAttendanceAction({ kind: "MANUAL_ENTRY", subjectType, subjectId, date, time });
}

/** Correction manuelle hors-ligne (badge oublié) : sortie. */
export async function enqueueManualExit(
  subjectType: ScanSubjectType, subjectId: number, date: string, time: string,
): Promise<QueuedAttendance> {
  return enqueueAttendanceAction({ kind: "MANUAL_EXIT", subjectType, subjectId, date, time });
}

async function enqueueAttendanceAction(action: QueuedAttendanceAction): Promise<QueuedAttendance> {
  const entry: QueuedAttendance = {
    id: crypto.randomUUID(),
    action,
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
  };
  await offlineDb.attendanceQueue.add(entry);
  await refreshAttendanceQueueSnapshot();
  return entry;
}

async function replayAttendanceAction(action: QueuedAttendanceAction): Promise<void> {
  switch (action.kind) {
    case "SCAN":
      await scanAttendance({ subjectType: action.subjectType, subjectId: action.subjectId, direction: action.direction });
      return;
    case "MANUAL_ENTRY":
      if (action.subjectType === "TEACHER") await recordTeacherManualEntry(action.subjectId, action.date, action.time);
      else if (action.subjectType === "EMPLOYEE") await recordEmployeeManualEntry(action.subjectId, action.date, action.time);
      else await recordStudentManualEntry(action.subjectId, action.date, action.time);
      return;
    case "MANUAL_EXIT":
      if (action.subjectType === "TEACHER") await recordTeacherManualExit(action.subjectId, action.date, action.time);
      else if (action.subjectType === "EMPLOYEE") await recordEmployeeManualExit(action.subjectId, action.date, action.time);
      else await recordStudentManualExit(action.subjectId, action.date, action.time);
      return;
  }
}

let attendanceSyncing = false;

/** Rejoue les présences en attente dès que le réseau revient, dans l'ordre d'origine (important pour
 * une entrée suivie d'une sortie sur la même séance). Un échec réseau interrompt le cycle (on
 * retentera plus tard) ; une vraie erreur métier marque l'entrée `failed` pour intervention manuelle. */
export async function processAttendanceQueue(): Promise<void> {
  if (attendanceSyncing || !useNetworkStore.getState().online) return;
  attendanceSyncing = true;
  useAttendanceQueueStore.getState().setSyncing(true);
  try {
    const pending = await offlineDb.attendanceQueue.where("status").equals("pending").sortBy("createdAt");
    for (const entry of pending) {
      try {
        await replayAttendanceAction(entry.action);
        await offlineDb.attendanceQueue.delete(entry.id);
      } catch (err) {
        if (isNetworkError(err)) {
          break;
        }
        await offlineDb.attendanceQueue.update(entry.id, {
          status: "failed",
          attempts: entry.attempts + 1,
          lastError: err instanceof Error ? err.message : "Erreur inconnue",
        });
      }
    }
  } finally {
    attendanceSyncing = false;
    useAttendanceQueueStore.getState().setSyncing(false);
    await refreshAttendanceQueueSnapshot();
  }
}

/** Remet une entrée en échec dans la file pour une nouvelle tentative. */
export async function retryFailedAttendanceEntry(id: string): Promise<void> {
  await offlineDb.attendanceQueue.update(id, { status: "pending" });
  await refreshAttendanceQueueSnapshot();
  await processAttendanceQueue();
}

/** Supprime définitivement une entrée en échec. */
export async function discardFailedAttendanceEntry(id: string): Promise<void> {
  await offlineDb.attendanceQueue.delete(id);
  await refreshAttendanceQueueSnapshot();
}

// ── Notes hors-ligne (§grading) ─────────────────────────────────────────────────────────────────

async function refreshGradeQueueSnapshot(): Promise<void> {
  const items = await offlineDb.gradeQueue.orderBy("createdAt").toArray();
  useGradeQueueStore.getState().setItems(items);
}

/** Enregistre (ou remplace) la saisie de notes hors-ligne pour une évaluation — une nouvelle
 * sauvegarde hors-ligne pour la MÊME évaluation écrase la précédente au lieu de s'empiler, voir
 * QueuedGradeEntry dans db.ts. */
export async function enqueueGrades(
  assessmentId: number, grades: { studentId: number; value: number }[],
): Promise<QueuedGradeEntry> {
  const entry: QueuedGradeEntry = {
    assessmentId, grades,
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
  };
  await offlineDb.gradeQueue.put(entry);
  await refreshGradeQueueSnapshot();
  return entry;
}

let gradeSyncing = false;

/** Rejoue les notes en attente dès que le réseau revient — l'endpoint bulk est un UPSERT par élève
 * (GradeService.enterBulk, ignore silencieusement les notes déjà validées) : rejouer la même valeur
 * plusieurs fois est sans risque, contrairement aux paiements/inscriptions. Un échec réseau interrompt
 * le cycle (on retentera plus tard) ; une vraie erreur métier (période clôturée entre-temps, §422) marque
 * l'entrée `failed` pour intervention manuelle. */
export async function processGradeQueue(): Promise<void> {
  if (gradeSyncing || !useNetworkStore.getState().online) return;
  gradeSyncing = true;
  useGradeQueueStore.getState().setSyncing(true);
  try {
    const pending = await offlineDb.gradeQueue.where("status").equals("pending").toArray();
    for (const entry of pending) {
      try {
        await enterBulkGrades(entry.assessmentId, entry.grades);
        await offlineDb.gradeQueue.delete(entry.assessmentId);
      } catch (err) {
        if (isNetworkError(err)) {
          break; // connexion à nouveau instable : on s'arrête là, cette entrée reste "pending"
        }
        await offlineDb.gradeQueue.update(entry.assessmentId, {
          status: "failed",
          attempts: entry.attempts + 1,
          lastError: err instanceof Error ? err.message : "Erreur inconnue",
        });
      }
    }
  } finally {
    gradeSyncing = false;
    useGradeQueueStore.getState().setSyncing(false);
    await refreshGradeQueueSnapshot();
  }
}

/** Remet une entrée en échec dans la file pour une nouvelle tentative. */
export async function retryFailedGradeEntry(assessmentId: number): Promise<void> {
  await offlineDb.gradeQueue.update(assessmentId, { status: "pending" });
  await refreshGradeQueueSnapshot();
  await processGradeQueue();
}

/** Supprime définitivement une entrée en échec (l'agent a résolu le problème autrement). */
export async function discardFailedGradeEntry(assessmentId: number): Promise<void> {
  await offlineDb.gradeQueue.delete(assessmentId);
  await refreshGradeQueueSnapshot();
}

let wired = false;

/** Déclenche la synchronisation (paiements, inscriptions, enseignants, parents, présences, notes) au
 * retour du réseau et une fois au démarrage (file déjà non vide). */
export function wireSyncTriggers(): void {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("online", () => {
    void processQueue();
    void processEnrollmentQueue();
    void processTeacherQueue();
    void processParentQueue();
    void processAttendanceQueue();
    void processGradeQueue();
  });
  void refreshQueueSnapshot().then(() => {
    if (useNetworkStore.getState().online) void processQueue();
  });
  void refreshEnrollmentQueueSnapshot().then(() => {
    if (useNetworkStore.getState().online) void processEnrollmentQueue();
  });
  void refreshTeacherQueueSnapshot().then(() => {
    if (useNetworkStore.getState().online) void processTeacherQueue();
  });
  void refreshParentQueueSnapshot().then(() => {
    if (useNetworkStore.getState().online) void processParentQueue();
  });
  void refreshAttendanceQueueSnapshot().then(() => {
    if (useNetworkStore.getState().online) void processAttendanceQueue();
  });
  void refreshGradeQueueSnapshot().then(() => {
    if (useNetworkStore.getState().online) void processGradeQueue();
  });
}
