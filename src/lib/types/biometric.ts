export type BiometricDeviceType = "FINGERPRINT" | "FACE" | "BOTH";
export type BiometricProtocol = "ZK" | "PUSH" | "HTTP";
export type DeviceStatus = "CONNECTED" | "DISCONNECTED" | "UNKNOWN";
export type BiometricSubjectType = "STUDENT" | "TEACHER";
export type BiometricType = "FINGERPRINT" | "FACE";
export type EnrollmentStatus = "PENDING" | "ENROLLED";
export type PunchDirection = "IN" | "OUT" | "UNKNOWN";

export const DEVICE_TYPE_LABEL: Record<BiometricDeviceType, string> = { FINGERPRINT: "Empreinte", FACE: "Visage", BOTH: "Empreinte + Visage" };
export const PROTOCOL_LABEL: Record<BiometricProtocol, string> = { ZK: "ZKTeco", PUSH: "Push API", HTTP: "HTTP API" };
export const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = { CONNECTED: "Connecté", DISCONNECTED: "Déconnecté", UNKNOWN: "Inconnu" };
export const SUBJECT_TYPE_LABEL: Record<BiometricSubjectType, string> = { STUDENT: "Élève", TEACHER: "Enseignant" };
export const BIOMETRIC_TYPE_LABEL: Record<BiometricType, string> = { FINGERPRINT: "Empreinte", FACE: "Visage" };
export const DIRECTION_LABEL: Record<PunchDirection, string> = { IN: "Entrée", OUT: "Sortie", UNKNOWN: "—" };

export interface BiometricDevice {
  id: number;
  name: string;
  deviceType: BiometricDeviceType;
  ipAddress: string | null;
  port: number | null;
  protocol: BiometricProtocol;
  location: string | null;
  active: boolean;
  realtimeSync: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  status: DeviceStatus;
  accuracyLevel: string | null;
  maskAllowed: boolean;
  temperatureCheck: boolean;
  temperatureThreshold: number | null;
  apiKey: string | null;
}

export interface BiometricEnrollment {
  id: number;
  deviceId: number;
  subjectType: BiometricSubjectType;
  subjectId: number;
  biometricType: BiometricType;
  externalUserId: string;
  status: EnrollmentStatus;
  enrolledAt: string | null;
}

export interface BiometricPunch {
  id: number;
  deviceId: number;
  externalUserId: string;
  subjectType: BiometricSubjectType | null;
  subjectId: number | null;
  punchTime: string;
  direction: PunchDirection;
  temperature: number | null;
}

export interface DeviceInput {
  name: string;
  deviceType: BiometricDeviceType;
  ipAddress?: string | null;
  port?: number | null;
  protocol: BiometricProtocol;
  location?: string | null;
  active?: boolean;
  realtimeSync?: boolean;
  syncIntervalMinutes?: number;
  temperatureCheck?: boolean;
  temperatureThreshold?: number | null;
}
