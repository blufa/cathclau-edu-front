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
}

/** Body for PUT /students/{id}. */
export type UpdateStudentInput = Omit<CreateStudentInput, "userId">;

export interface StudentSearchParams {
  classId?: number;
  enrollmentStatus?: EnrollmentStatus;
  gender?: Gender;
  search?: string;
  page?: number;
  size?: number;
  sort?: string;
}
