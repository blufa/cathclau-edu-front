/** Student contracts mirrored from the backend students module. */

export type Gender = "MALE" | "FEMALE";
export type EnrollmentStatus = "PENDING" | "VALIDATED" | "CANCELLED" | "ABANDONED";
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
  /** Le parent a accepté que l'élève soit connecté à la plateforme (frais annexe ajouté aux
   * mensualités si oui, jamais sinon). */
  platformAccessOptIn: boolean;
  /** Ce parent règle mois par mois plutôt que par tranche groupée — les tranches multi-mois de sa
   * classe sont alors facturées en autant de factures séparées d'un mois. */
  monthlyPaymentOptIn: boolean;
}

/** Body for POST /enrollments and /enrollments/re-enrollment. */
export interface EnrollInput {
  studentId: number;
  classId: number;
  academicYearId: number;
  type: EnrollmentType;
  platformAccessOptIn?: boolean;
  monthlyPaymentOptIn?: boolean;
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
  /** Lien direct vers une fiche Teacher/Employee, SANS compte de connexion — pour le personnel qui ne
   * veut/ne peut pas en avoir un (ex. pas de smartphone Android). */
  linkedStaffType?: "TEACHER" | "EMPLOYEE" | null;
  linkedStaffId?: number | null;
  /** Réglage comptable : ce parent, s'il est membre du personnel, prend en charge lui-même les frais
   * de ses enfants — aucune retenue automatique sur son salaire. Sans effet sur un parent non-personnel. */
  excludeFromAutoDeduction?: boolean;
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
  /** Clé d'idempotence (mode hors-ligne, lib/offline/) : rejouer avec la même clé après une coupure
   * réseau renvoie l'élève déjà créé côté serveur au lieu d'en créer un second. */
  idempotencyKey?: string;
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
