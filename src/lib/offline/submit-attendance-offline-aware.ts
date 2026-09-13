import {
  recordEmployeeManualEntry,
  recordEmployeeManualExit,
  recordStudentManualEntry,
  recordStudentManualExit,
  recordTeacherManualEntry,
  recordTeacherManualExit,
  scanAttendance,
  type ScanResult,
  type ScanSubjectType,
} from "@/lib/api/attendance";
import { isNetworkError } from "@/lib/api/errors";
import type { ScanDirection } from "@/lib/types/attendance";
import type { TeacherCheckin } from "@/lib/types/attendance";
import type { StudentCheckin } from "@/lib/types/attendance";
import type { EmployeeAttendance } from "@/lib/types/attendance";
import { useNetworkStore } from "./network-store";
import { enqueueAttendanceScan, enqueueManualEntry, enqueueManualExit } from "./sync-engine";
import type { QueuedAttendance } from "./db";

export type AttendanceAttempt<T> =
  | { outcome: "online"; result: T }
  | { outcome: "queued"; entry: QueuedAttendance };

/**
 * Point d'entrée unique pour un scan de présence (badge, entrée/sortie) : tente l'appel réel en
 * premier, ne bascule sur la file d'attente locale que si l'appel échoue pour une raison réseau —
 * une vraie erreur métier (créneau introuvable, badge invalide) remonte normalement, jamais mise en
 * file. En mode hors-ligne, aucun retour riche (retard/durée) n'est disponible : seul le fait que le
 * scan a bien été enregistré localement est garanti.
 */
export async function submitScanOfflineAware(
  subjectType: ScanSubjectType, subjectId: number, direction: ScanDirection,
): Promise<AttendanceAttempt<ScanResult>> {
  if (useNetworkStore.getState().online) {
    try {
      const result = await scanAttendance({ subjectType, subjectId, direction });
      return { outcome: "online", result };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }
  return { outcome: "queued", entry: await enqueueAttendanceScan(subjectType, subjectId, direction) };
}

/** Point d'entrée unique pour une correction manuelle d'entrée (badge oublié). */
export async function submitManualEntryOfflineAware(
  subjectType: ScanSubjectType, subjectId: number, date: string, time: string,
): Promise<AttendanceAttempt<TeacherCheckin | StudentCheckin | EmployeeAttendance>> {
  if (useNetworkStore.getState().online) {
    try {
      const result = subjectType === "TEACHER"
        ? await recordTeacherManualEntry(subjectId, date, time)
        : subjectType === "EMPLOYEE"
          ? await recordEmployeeManualEntry(subjectId, date, time)
          : await recordStudentManualEntry(subjectId, date, time);
      return { outcome: "online", result };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }
  return { outcome: "queued", entry: await enqueueManualEntry(subjectType, subjectId, date, time) };
}

/** Point d'entrée unique pour une correction manuelle de sortie (badge oublié). */
export async function submitManualExitOfflineAware(
  subjectType: ScanSubjectType, subjectId: number, date: string, time: string,
): Promise<AttendanceAttempt<TeacherCheckin | StudentCheckin | EmployeeAttendance>> {
  if (useNetworkStore.getState().online) {
    try {
      const result = subjectType === "TEACHER"
        ? await recordTeacherManualExit(subjectId, date, time)
        : subjectType === "EMPLOYEE"
          ? await recordEmployeeManualExit(subjectId, date, time)
          : await recordStudentManualExit(subjectId, date, time);
      return { outcome: "online", result };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }
  return { outcome: "queued", entry: await enqueueManualExit(subjectType, subjectId, date, time) };
}
