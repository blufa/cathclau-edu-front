/** Student contracts mirrored from the backend students module. */

export type Gender = "MALE" | "FEMALE";
export type EnrollmentStatus = "PENDING" | "VALIDATED" | "CANCELLED";
export type Relationship = "FATHER" | "MOTHER" | "GUARDIAN";
export type EnrollmentType = "NEW" | "RE_ENROLLMENT";

export interface Student {
  id: number;
  tenantId: number;
  userId: number | null;
  studentNumber: string;
  photo: string | null;
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate: string | null;
  birthPlace: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  nationality: string | null;
  originSchool: string | null;
  birthCertificateNumber: string | null;
  bloodGroup: string | null;
  neighborhood: string | null;
  landmark: string | null;
  previousClass: string | null;
  repeating: boolean | null;
  transferReason: string | null;
  medicalNotes: string | null;
  createdAt: string | null;
  deletedAt: string | null;
}

export interface Enrollment {
  id: number;
  studentId: number;
  classId: number;
  academicYearId: number;
  type: EnrollmentType;
  status: EnrollmentStatus;
  enrolledAt: string | null;
}

/** Body for POST /enrollments and /enrollments/re-enrollment. */
export interface EnrollInput {
  studentId: number;
  classId: number;
  academicYearId: number;
  type: EnrollmentType;
}

export interface EnrollmentSearchParams {
  studentId?: number;
  classId?: number;
  academicYearId?: number;
  status?: EnrollmentStatus;
}

export interface Parent {
  id: number;
  tenantId: number;
  userId: number | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  occupation: string | null;
  address: string | null;
  photo: string | null;
  primaryGuardian?: boolean;
}

export interface StudentDocument {
  id: number;
  studentId: number;
  documentType: string;
  fileUrl: string;
}

/** Aggregate returned by GET /students/{id}. */
export interface StudentDetail {
  student: Student;
  enrollments: Enrollment[];
  parents: Parent[];
  documents: StudentDocument[];
}

/** Body for POST /students — tenantId is resolved server-side from the JWT. */
export interface CreateStudentInput {
  userId?: number | null;
  studentNumber?: string | null;
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate?: string | null;
  birthPlace?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  nationality?: string | null;
  originSchool?: string | null;
  photo?: string | null;
  birthCertificateNumber?: string | null;
  bloodGroup?: string | null;
  neighborhood?: string | null;
  landmark?: string | null;
  previousClass?: string | null;
  repeating?: boolean | null;
  transferReason?: string | null;
  medicalNotes?: string | null;
  /** Créer un accès au portail élève : la connexion se fait par le matricule + ce mot de passe. */
  createLogin?: boolean;
  loginPassword?: string;
}

/** Body for PUT /students/{id}. */
export type UpdateStudentInput = Omit<CreateStudentInput, "userId">;

/** Ligne du guichet d'accueil (§billing) : élève + classe courante + parent principal (ou premier lié). */
export interface StudentSummary {
  student: Student;
  classId: number | null;
  principalParentName: string | null;
  principalParentPhone: string | null;
}

export interface StudentSearchParams {
  classId?: number;
  enrollmentStatus?: EnrollmentStatus;
  /** Filtre les élèves sans inscription active (présents dans le système mais non inscrits). */
  notEnrolled?: boolean;
  gender?: Gender;
  search?: string;
  page?: number;
  size?: number;
  sort?: string;
}
