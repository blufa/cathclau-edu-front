import { api } from "@/lib/api/client";
import type {
  BiometricDevice,
  BiometricEnrollment,
  BiometricPunch,
  BiometricSubjectType,
  BiometricType,
  DeviceInput,
  PunchDirection,
} from "@/lib/types/biometric";

// ── Appareils ─────────────────────────────────────────────────────────────────
export function listDevices(): Promise<BiometricDevice[]> {
  return api.get<BiometricDevice[]>("/biometric/devices");
}
export function createDevice(input: DeviceInput): Promise<BiometricDevice> {
  return api.post<BiometricDevice>("/biometric/devices", input);
}
export function updateDevice(id: number, input: DeviceInput): Promise<BiometricDevice> {
  return api.put<BiometricDevice>(`/biometric/devices/${id}`, input);
}
export function deleteDevice(id: number): Promise<void> {
  return api.delete<void>(`/biometric/devices/${id}`);
}
export function testDeviceConnection(id: number): Promise<BiometricDevice> {
  return api.post<BiometricDevice>(`/biometric/devices/${id}/test-connection`);
}
export function syncDevice(id: number): Promise<BiometricDevice> {
  return api.post<BiometricDevice>(`/biometric/devices/${id}/sync`);
}

// ── Enrôlements ─────────────────────────────────────────────────────────────────
export function listEnrollments(deviceId?: number): Promise<BiometricEnrollment[]> {
  return api.get<BiometricEnrollment[]>("/biometric/enrollments", { query: { deviceId } });
}
export function enrollUser(input: {
  deviceId: number; subjectType: BiometricSubjectType; subjectId: number; biometricType: BiometricType; externalUserId: string;
}): Promise<BiometricEnrollment> {
  return api.post<BiometricEnrollment>("/biometric/enrollments", input);
}
export function deleteEnrollment(id: number): Promise<void> {
  return api.delete<void>(`/biometric/enrollments/${id}`);
}

// ── Pointages ───────────────────────────────────────────────────────────────────
export function listPunches(params?: { deviceId?: number }): Promise<BiometricPunch[]> {
  return api.get<BiometricPunch[]>("/biometric/punches", { query: { deviceId: params?.deviceId } });
}

// ── Badges (QR) — la génération enrôle automatiquement la personne ──────────────
export interface BadgeResult {
  qrPayload: string; externalUserId: string; subjectType: BiometricSubjectType; subjectId: number; enrollmentId: number;
}
export function generateBadge(subjectType: BiometricSubjectType, subjectId: number): Promise<BadgeResult> {
  return api.post<BadgeResult>("/biometric/badges", { subjectType, subjectId });
}

/** Enregistre un pointage (utilisé par le pointage caméra : téléphone/ordinateur). */
export function recordPunch(deviceId: number, input: {
  externalUserId: string; punchTime?: string | null; direction: PunchDirection; temperature?: number | null; rawPayload?: string | null;
}): Promise<BiometricPunch> {
  return api.post<BiometricPunch>(`/biometric/devices/${deviceId}/punches`, input);
}

/** Ingestion en lot de pointages (sync d'un terminal biométrique). */
export function recordPunchBatch(deviceId: number, input: Array<{
  externalUserId: string; punchTime?: string | null; direction: PunchDirection; temperature?: number | null; rawPayload?: string | null;
}>): Promise<BiometricPunch[]> {
  return api.post<BiometricPunch[]>(`/biometric/devices/${deviceId}/punches/batch`, input);
}
