"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BookOpen, FileText, GraduationCap, IdCard, Users } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import {
  cancelEnrollment,
  deleteEnrollment,
} from "@/lib/api/enrollments";
import type { Enrollment, EnrollmentStatus } from "@/lib/types/student";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EnrollModal } from "@/features/enrollments/components/enroll-modal";
import { CollectFeeModal } from "@/features/billing/components/collect-fee-modal";
import { CardSpotlight } from "@/components/ui/aceternity";
import { StudentAttendanceStats } from "./attendance-stats";
import { ParentsManager } from "./parents-manager";
import { DocumentsManager } from "./documents-manager";
import { CertificateAction } from "./certificate-action";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { useStudentQuery } from "../hooks/use-students";

const STATUS_TONE: Record<EnrollmentStatus, "amber" | "green" | "red"> = {
  PENDING: "amber",
  VALIDATED: "green",
  CANCELLED: "red",
};
const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  PENDING: "En attente",
  VALIDATED: "Validée",
  CANCELLED: "Annulée",
};

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

export default function StudentDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const canEnroll = hasRole(user, "SCHOOL_ADMIN", "SECRETARY", "DIRECTOR");
  const canDecide = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");
  const canCollect = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "SECRETARY");

  const { data, isLoading: loading, error, refetch } = useStudentQuery(id);
  const [enrolling, setEnrolling] = useState(false);
  const [editing, setEditing] = useState<Enrollment | null>(null);
  const [collecting, setCollecting] = useState<{ classId: number | null } | null>(null);

  const yearIds = useMemo(
    () => [...new Set((data?.enrollments ?? []).map((e) => e.academicYearId))],
    [data?.enrollments],
  );
  const classesQuery = useQuery(
    () =>
      yearIds.length
        ? Promise.all(yearIds.map((y) => listClasses(y))).then((lists) => lists.flat())
        : Promise.resolve([]),
    [yearIds.join(",")],
  );
  // Une seule inscription (non annulée) par année : sert à griser le bouton « Inscrire ».
  const yearsQuery = useQuery(listAcademicYears, []);
  const currentYearId = (yearsQuery.data ?? []).find((y) => y.current)?.id ?? null;
  const alreadyEnrolledThisYear = (data?.enrollments ?? []).some(
    (e) => e.academicYearId === currentYearId && e.status !== "CANCELLED",
  );
  const classLabel = useMemo(
    () => new Map((classesQuery.data ?? []).map((c) => [c.id, c.label])),
    [classesQuery.data],
  );

  function handleCancel(enrollmentId: number) {
    confirmAction({
      title: "Annuler l'inscription",
      message: "Annuler cette inscription ?",
      confirmLabel: "Annuler l'inscription",
      onConfirm: async () => {
        try {
          await cancelEnrollment(enrollmentId);
          notifySuccess("Inscription annulée");
          refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }
  function handleDelete(enrollmentId: number) {
    confirmAction({
      title: "Supprimer l'inscription",
      message: "Supprimer définitivement cette inscription ?",
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteEnrollment(enrollmentId);
          notifySuccess("Inscription supprimée");
          refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/students" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
          <ArrowLeft className="h-4 w-4" /> Retour à la liste
        </Link>
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">Élève introuvable.</p>
      </div>
    );
  }

  const { student, enrollments } = data;

  return (
    <div className="space-y-6">
      <Link href="/students" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Retour à la liste
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-brand-50 to-white p-5">
        {student.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={student.photo}
            alt={`${student.firstName} ${student.lastName}`}
            className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow-md ring-2 ring-white"
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-bold text-white shadow-md">
            {student.firstName[0]}
            {student.lastName[0]}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {student.firstName} {student.lastName}
          </h1>
          <p className="font-mono text-sm text-slate-500">{student.studentNumber}</p>
        </div>
      </div>

      <Tabs defaultValue="infos">
        <TabsList>
          <TabsTrigger value="infos" icon={IdCard}>Infos</TabsTrigger>
          <TabsTrigger value="enrollments" icon={BookOpen}>
            Inscriptions
          </TabsTrigger>
          <TabsTrigger value="parents" icon={Users}>Parents</TabsTrigger>
          <TabsTrigger value="documents" icon={FileText}>Documents</TabsTrigger>
          <TabsTrigger value="schooling" icon={GraduationCap}>
            Scolarité
          </TabsTrigger>
        </TabsList>

        {/* Infos */}
        <TabsPanel value="infos">
          <div className="space-y-4">
            <Card>
              <CardBody>
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Identité</h3>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Info label="Sexe" value={student.gender === "FEMALE" ? "Féminin" : "Masculin"} />
                  <Info label="Date de naissance" value={student.birthDate} />
                  <Info label="Lieu de naissance" value={student.birthPlace} />
                  <Info label="Nationalité" value={student.nationality} />
                  <Info label="N° acte de naissance" value={student.birthCertificateNumber} />
                  <Info label="Groupe sanguin" value={student.bloodGroup} />
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Coordonnées</h3>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Info label="Quartier / commune" value={student.neighborhood} />
                  <Info label="Point de repère" value={student.landmark} />
                  <Info label="Adresse" value={student.address} />
                  <Info label="Téléphone" value={student.phone} />
                  <Info label="Email" value={student.email} />
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Scolarité antérieure</h3>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Info label="École précédente" value={student.originSchool} />
                  <Info label="Dernière classe" value={student.previousClass} />
                  <Info label="Redoublant" value={student.repeating == null ? null : student.repeating ? "Oui" : "Non"} />
                  <Info label="Motif de transfert" value={student.transferReason} />
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Santé</h3>
                <p className="whitespace-pre-line text-sm text-slate-600">{student.medicalNotes || "—"}</p>
              </CardBody>
            </Card>
          </div>
        </TabsPanel>

        {/* Inscriptions */}
        <TabsPanel value="enrollments">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">Historique des inscriptions</h2>
            {canEnroll && (
              <Button
                size="sm"
                onClick={() => setEnrolling(true)}
                disabled={alreadyEnrolledThisYear}
                title={alreadyEnrolledThisYear ? "Déjà inscrit pour l'année courante" : undefined}
              >
                Inscrire
              </Button>
            )}
          </div>
          {enrollments.length === 0 ? (
            <Card>
              <CardBody className="text-sm text-slate-400">Aucune inscription.</CardBody>
            </Card>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Classe</TH>
                  <TH>Année</TH>
                  <TH>Type</TH>
                  <TH>Statut</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {enrollments.map((e) => (
                  <TR key={e.id}>
                    <TD>{classLabel.get(e.classId) ?? `#${e.classId}`}</TD>
                    <TD>#{e.academicYearId}</TD>
                    <TD>{e.type === "RE_ENROLLMENT" ? "Réinscription" : "Inscription"}</TD>
                    <TD>
                      <Badge tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                    </TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-2">
                        {canCollect && e.status !== "CANCELLED" && (
                          <Button size="sm" onClick={() => setCollecting({ classId: e.classId })}>
                            Facture
                          </Button>
                        )}
                        {canEnroll && e.status === "PENDING" && (
                          <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>
                            Modifier
                          </Button>
                        )}
                        {canDecide && e.status !== "CANCELLED" && (
                          <Button size="sm" variant="ghost" onClick={() => handleCancel(e.id)}>
                            Annuler
                          </Button>
                        )}
                        {canDecide && (
                          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(e.id)}>
                            Suppr.
                          </Button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </TabsPanel>

        {/* Parents */}
        <TabsPanel value="parents">
          <ParentsManager studentId={student.id} canWrite={canEnroll} />
        </TabsPanel>

        {/* Documents */}
        <TabsPanel value="documents">
          <DocumentsManager studentId={student.id} canWrite={canEnroll} />
        </TabsPanel>

        {/* Scolarité — attendance summary + cross-module links */}
        <TabsPanel value="schooling">
          <Card className="mb-4">
            <CardBody>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Assiduité</h3>
              <StudentAttendanceStats studentId={id} />
            </CardBody>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { label: "Notes & évaluations", href: `/grading?student=${id}` },
              { label: "Bulletins", href: `/report-cards?student=${id}` },
              { label: "Factures de l'élève", href: `/invoices?student=${id}` },
            ].map((l) => (
              <CardSpotlight key={l.href} className="transition hover:-translate-y-0.5 hover:shadow-sm">
                <Link href={l.href} className="group block p-5">
                  <GraduationCap className="h-6 w-6 text-brand-600" strokeWidth={1.6} />
                  <p className="mt-3 text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                    {l.label}
                  </p>
                </Link>
              </CardSpotlight>
            ))}
          </div>

          {canEnroll && (
            <Card className="mt-4">
              <CardBody>
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Documents officiels</h3>
                <CertificateAction studentId={student.id} />
              </CardBody>
            </Card>
          )}
        </TabsPanel>
      </Tabs>

      <EnrollModal
        studentId={id}
        open={enrolling}
        onClose={() => setEnrolling(false)}
        onEnrolled={() => {
          refetch();
          // Move straight to the enrollment invoice so the fee can be collected right away.
          if (canCollect) setCollecting({ classId: enrollments.find((e) => e.status !== "CANCELLED")?.classId ?? null });
        }}
      />

      {editing && (
        <EnrollModal
          studentId={id}
          enrollment={editing}
          open={!!editing}
          onClose={() => setEditing(null)}
          onEnrolled={() => {
            setEditing(null);
            refetch();
          }}
        />
      )}

      {tenantId != null && (
        <CollectFeeModal
          studentId={id}
          tenantId={tenantId}
          classId={collecting?.classId ?? undefined}
          open={collecting != null}
          onClose={() => setCollecting(null)}
          onCollected={refetch}
        />
      )}
    </div>
  );
}
