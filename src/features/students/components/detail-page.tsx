"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, BookOpen, FileText, GraduationCap, IdCard, Receipt, Users } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole, isSuperAdmin } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import {
  abandonEnrollment,
  cancelEnrollment,
  deleteEnrollment,
  transferEnrollmentClass,
  updatePlatformAccess,
} from "@/lib/api/enrollments";
import type { Enrollment, EnrollmentStatus } from "@/lib/types/student";
import type { Classe } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Modal } from "@/components/ui/modal";
import { Field, Label } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EnrollModal } from "@/features/enrollments/components/enroll-modal";
import { CollectFeeModal } from "@/features/billing/components/collect-fee-modal";
import { StudentInvoicesPanel } from "@/features/billing/components/student-invoices-panel";
import { CardSpotlight } from "@/components/ui/aceternity";
import { StudentAttendanceStats } from "./attendance-stats";
import { ParentsManager } from "./parents-manager";
import { DocumentsManager } from "./documents-manager";
import { CertificateAction } from "./certificate-action";
import { PurgeStudentAction } from "./purge-student-action";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { ApiError } from "@/lib/api/errors";
import { useStudentQuery } from "../hooks/use-students";

const STATUS_TONE: Record<EnrollmentStatus, "amber" | "green" | "red" | "indigo"> = {
  PENDING: "amber",
  VALIDATED: "green",
  CANCELLED: "red",
  ABANDONED: "indigo",
};
const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  PENDING: "En attente",
  VALIDATED: "Validée",
  CANCELLED: "Annulée",
  ABANDONED: "Abandon",
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
  const searchParams = useSearchParams();
  const id = Number(searchParams.get("id"));
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const canEnroll = hasRole(user, "SCHOOL_ADMIN", "SECRETARY", "DIRECTOR") || hasAnyPermission(user, ["inscription:create"]);
  const canDecide = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["inscription:validate"]);
  const canCollect = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "SECRETARY") || hasAnyPermission(user, ["paiement:create"]);

  const { data, isLoading: loading, error, refetch } = useStudentQuery(id);
  const [enrolling, setEnrolling] = useState(false);
  const [editing, setEditing] = useState<Enrollment | null>(null);
  const [collecting, setCollecting] = useState<{ classId: number | null } | null>(null);
  const [transferring, setTransferring] = useState<Enrollment | null>(null);

  const yearIds = useMemo(
    () => [...new Set((data?.enrollments ?? []).map((e) => e.academicYearId).filter((id): id is number => id != null))],
    [data?.enrollments],
  );
  const classesQuery = useQuery(
    () =>
      yearIds.length
        ? // allSettled : une année en échec (ex. année archivée/supprimée) ne doit pas faire perdre le
          // nom de classe de TOUTES les inscriptions — c'était la cause du « #<id> » affiché à la place
          // du nom de classe dès qu'une seule année posait problème (Promise.all rejette tout le lot).
          Promise.allSettled(yearIds.map((y) => listClasses(y)))
            .then((results) => results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])))
        : Promise.resolve([]),
    [yearIds.join(",")],
  );
  // Une seule inscription (non annulée) par année : sert à griser le bouton « Inscrire ».
  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const currentYearId = (yearsQuery.data ?? []).find((y) => y.current)?.id ?? null;
  const alreadyEnrolledThisYear = (data?.enrollments ?? []).some(
    (e) => e.academicYearId === currentYearId && e.status !== "CANCELLED",
  );
  // Inscription à afficher dans l'en-tête pour le badge « Accès plateforme » : celle de l'année
  // courante si validée, sinon la dernière inscription validée connue (élève d'une année antérieure).
  const currentEnrollment = (data?.enrollments ?? []).find(
    (e) => e.academicYearId === currentYearId && e.status === "VALIDATED",
  ) ?? [...(data?.enrollments ?? [])].reverse().find((e) => e.status === "VALIDATED");
  // Classe de référence pour l'onglet Factures (affiché en premier, §retour comptable refonte
  // inscription §5.7) : celle de l'inscription active, sinon la plus récente non annulée.
  const activeClassId = currentEnrollment?.classId
    ?? (data?.enrollments ?? []).find((e) => e.status !== "CANCELLED")?.classId;
  const classLabel = useMemo(
    () => new Map((classesQuery.data ?? []).map((c) => [c.id, c.label])),
    [classesQuery.data],
  );
  const yearLabel = useMemo(
    () => new Map((yearsQuery.data ?? []).map((y) => [y.id, y.label])),
    [yearsQuery.data],
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
  function handleAbandon(enrollmentId: number) {
    confirmAction({
      title: "Marquer comme abandon",
      message: "L'élève arrête les cours en cours d'année ? Il restera visible pour cette classe "
        + "(facturation, recouvrement) mais disparaîtra des listes d'appel et de saisie de notes.",
      confirmLabel: "Marquer comme abandon",
      onConfirm: async () => {
        try {
          await abandonEnrollment(enrollmentId);
          notifySuccess("Inscription marquée comme abandon");
          refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }
  function handleTogglePlatformAccess(enrollment: Enrollment) {
    const activating = !enrollment.platformAccessOptIn;
    confirmAction({
      title: activating ? "Activer l'accès plateforme" : "Désactiver l'accès plateforme",
      message: activating
        ? "Le parent pourra accéder au portail pour cette inscription, et le frais d'usage plateforme "
          + "sera ajouté à ses prochaines mensualités."
        : "Le parent perdra l'accès au portail pour cette inscription, et le frais d'usage plateforme "
          + "ne sera plus ajouté à ses prochaines mensualités.",
      confirmLabel: activating ? "Activer" : "Désactiver",
      onConfirm: async () => {
        try {
          await updatePlatformAccess(enrollment.id, activating);
          notifySuccess(activating ? "Accès plateforme activé" : "Accès plateforme désactivé");
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
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-brand-50 to-white p-5">
        <div className="flex items-center gap-4">
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
            {currentEnrollment && (
              <Badge tone={currentEnrollment.platformAccessOptIn ? "green" : "gray"} className="mt-1.5">
                {currentEnrollment.platformAccessOptIn ? "Accès plateforme activé" : "Accès plateforme non activé"}
              </Badge>
            )}
          </div>
        </div>
        {/* Zone dangereuse : réservée au SUPER_ADMIN (plateforme), invisible pour le personnel de
            l'école — suppression définitive (factures, paiements, inscriptions, classe…), distincte
            de l'archivage réversible accessible par ailleurs. */}
        {isSuperAdmin(user) && (
          <PurgeStudentAction
            studentId={student.id}
            studentNumber={student.studentNumber}
            studentName={`${student.firstName} ${student.lastName}`}
          />
        )}
      </div>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices" icon={Receipt}>Factures</TabsTrigger>
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

        {/* Factures — affiché en premier (§retour comptable, refonte inscription §5.7) : c'est ce que
            le comptable vient chercher en priorité sur la fiche d'un élève. */}
        <TabsPanel value="invoices">
          {tenantId == null ? (
            <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
              Réservé aux comptes d&apos;établissement.
            </p>
          ) : (
            <StudentInvoicesPanel studentId={id} tenantId={tenantId} classId={activeClassId ?? undefined} onCollected={refetch} />
          )}
        </TabsPanel>

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
                  <TH className="hidden sm:table-cell">Année</TH>
                  <TH className="hidden sm:table-cell">Type</TH>
                  <TH>Statut</TH>
                  <TH className="hidden sm:table-cell">Plateforme</TH>
                  <TH className="text-right">Actions</TH>
                </tr>
              </THead>
              <TBody>
                {enrollments.map((e) => (
                  <TR key={e.id}>
                    <TD>{classLabel.get(e.classId) ?? `#${e.classId}`}</TD>
                    <TD className="hidden sm:table-cell">
                      {e.academicYearId != null ? (yearLabel.get(e.academicYearId) ?? `#${e.academicYearId}`) : "—"}
                    </TD>
                    <TD className="hidden sm:table-cell">{e.type === "RE_ENROLLMENT" ? "Réinscription" : "Inscription"}</TD>
                    <TD>
                      <Badge tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                    </TD>
                    <TD className="hidden sm:table-cell">
                      {canEnroll && e.status !== "CANCELLED" ? (
                        <button
                          type="button"
                          onClick={() => handleTogglePlatformAccess(e)}
                          title={e.platformAccessOptIn ? "Cliquer pour désactiver" : "Cliquer pour activer"}
                        >
                          <Badge tone={e.platformAccessOptIn ? "green" : "gray"} className="cursor-pointer hover:opacity-80">
                            {e.platformAccessOptIn ? "Activé" : "Non activé"}
                          </Badge>
                        </button>
                      ) : (
                        <Badge tone={e.platformAccessOptIn ? "green" : "gray"}>
                          {e.platformAccessOptIn ? "Activé" : "Non activé"}
                        </Badge>
                      )}
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
                        {canDecide && e.status === "VALIDATED" && (
                          <Button size="sm" variant="ghost" onClick={() => setTransferring(e)}>
                            Transférer
                          </Button>
                        )}
                        {canDecide && e.status === "VALIDATED" && (
                          <Button size="sm" variant="ghost" className="text-amber-700" onClick={() => handleAbandon(e.id)}>
                            Marquer comme abandon
                          </Button>
                        )}
                        {canDecide && e.status !== "CANCELLED" && e.status !== "ABANDONED" && (
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

      {transferring && (
        <TransferClassModal
          enrollment={transferring}
          classOptions={(classesQuery.data ?? []).filter(
            (c) => c.academicYearId === transferring.academicYearId && c.id !== transferring.classId,
          )}
          onClose={() => setTransferring(null)}
          onTransferred={() => {
            setTransferring(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}

/**
 * Transfert d'une inscription validée vers une autre classe en cours d'année. Si les frais de
 * scolarité diffèrent entre les deux classes, les mensualités impayées de l'ancienne classe sont
 * annulées côté serveur et ce qui a déjà été payé est automatiquement reporté en crédit sur les
 * nouvelles mensualités — rien à faire ici, juste choisir la nouvelle classe.
 */
function TransferClassModal({ enrollment, classOptions, onClose, onTransferred }: {
  enrollment: Enrollment; classOptions: Classe[]; onClose: () => void; onTransferred: () => void;
}) {
  const [classId, setClassId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  // Renseigné quand le transfert échoue parce que la classe cible a atteint sa capacité maximale
  // (§6 cahier des charges) — propose de forcer plutôt que de bloquer purement et simplement.
  const [capacityWarning, setCapacityWarning] = useState<{ currentCount: number; maxCapacity: number } | null>(null);
  const options: SearchableOption[] = classOptions.map((c) => ({
    value: String(c.id), trigger: c.label, label: c.label, searchText: c.label,
  }));

  async function submit(overrideCapacity = false) {
    if (!classId) return;
    setSubmitting(true);
    try {
      await transferEnrollmentClass(enrollment.id, Number(classId), overrideCapacity);
      notifySuccess("Élève transféré vers la nouvelle classe");
      onTransferred();
    } catch (err) {
      if (err instanceof ApiError && err.problem?.raison === "CAPACITE_ATTEINTE") {
        setCapacityWarning({
          currentCount: err.problem.currentCount ?? 0,
          maxCapacity: err.problem.maxCapacity ?? 0,
        });
      } else {
        notifyError(err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Transférer vers une autre classe">
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Si la scolarité de la nouvelle classe a un tarif différent, les mensualités impayées de
          l&apos;ancienne classe seront annulées et ce qui a déjà été payé sera automatiquement
          reporté en crédit sur les nouvelles mensualités.
        </p>
        <Field>
          <Label>Nouvelle classe</Label>
          {options.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune autre classe disponible pour cette année scolaire.</p>
          ) : (
            <SearchableSelect value={classId} options={options}
              onChange={(v) => { setClassId(v); setCapacityWarning(null); }}
              triggerClassName="w-full justify-between px-3" />
          )}
        </Field>
        {capacityWarning && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Cette classe a atteint sa capacité maximale ({capacityWarning.currentCount}/{capacityWarning.maxCapacity}
            {" "}élèves). Vous pouvez forcer le transfert malgré tout, ou choisir une autre classe.
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Annuler</Button>
          {capacityWarning ? (
            <Button variant="danger" onClick={() => submit(true)} loading={submitting}>Forcer le transfert</Button>
          ) : (
            <Button onClick={() => submit(false)} disabled={!classId} loading={submitting}>Transférer</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
