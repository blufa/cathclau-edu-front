"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useNetworkStore } from "@/lib/offline/network-store";
import {
  getTeacher,
  getTeacherClasses,
  getTeacherSchedule,
  getTeacherSubjects,
  updateTeacherAllowsConcurrentClasses,
} from "@/lib/api/staff";
import { listAcademicYears, listClasses, listRooms, listSubjects } from "@/lib/api/academics";
import { getPayslipPdfObjectUrl, listPayslips } from "@/lib/api/payroll";
import { PAYSLIP_STATUS_LABEL } from "@/lib/types/payroll";
import { getTeacherLatenessDetail, getTeacherLatenessReportPdfObjectUrl } from "@/lib/api/attendance";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { IdCard, ListChecks, CalendarDays, Banknote, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";
import { TeacherAvailabilitySection } from "@/components/staff/teacher-availability";
import { TeacherClassesSection } from "@/components/staff/teacher-classes";
import { TeacherSubjectsSection } from "@/components/staff/teacher-subjects";
import { TeacherLevelsSection } from "@/components/staff/teacher-levels";

const DAY_LABEL: Record<string, string> = {
  LUNDI: "Lundi",
  MARDI: "Mardi",
  MERCREDI: "Mercredi",
  JEUDI: "Jeudi",
  VENDREDI: "Vendredi",
  SAMEDI: "Samedi",
};

const EMPLOYMENT_LABEL: Record<string, string> = {
  PERMANENT: "Permanent",
  VACATAIRE: "Vacataire",
  CONTRACTUEL: "Contractuel",
};
const REMUNERATION_LABEL: Record<string, string> = {
  MENSUEL: "Mensuel",
  HORAIRE: "Horaire",
  FORFAIT: "Forfait",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthIso(): string {
  return todayIso().slice(0, 8) + "01";
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value || "—"}</dd>
    </div>
  );
}

export default function TeacherDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);

  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["enseignant:create", "enseignant:update"]);
  const canViewPayroll = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT") || hasAnyPermission(user, ["paie:manage"]);
  const canViewLatenessReport = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY") || hasAnyPermission(user, ["paie:manage"]);
  const teacherQuery = useQuery(() => getTeacher(id), [id]);
  const classesQuery = useQuery(() => getTeacherClasses(id), [id]);
  const subjectsQuery = useQuery(() => getTeacherSubjects(id), [id]);
  const payslipsQuery = useQuery(() => (canViewPayroll ? listPayslips({ teacherId: id }) : Promise.resolve([])), [id, canViewPayroll]);
  // Consultation hors-ligne (§Phase 2) : affiche le dernier emploi du temps connu de cet enseignant
  // pendant qu'un rafraîchissement réseau tourne en tâche de fond.
  const online = useNetworkStore((s) => s.online);
  const scheduleQuery = useCachedQuery(
    `teacher-schedule-detail:${id}`,
    async () => {
      const [slots, subjects, rooms] = await Promise.all([getTeacherSchedule(id), listSubjects(), listRooms()]);
      return { slots, subjects, rooms };
    },
    [id],
  );

  const subjectLabel = useMemo(
    () => new Map((scheduleQuery.data?.subjects ?? []).map((s) => [s.id, s.label])),
    [scheduleQuery.data],
  );
  const roomLabel = useMemo(
    () => new Map((scheduleQuery.data?.rooms ?? []).map((r) => [r.id, r.label])),
    [scheduleQuery.data],
  );

  // Résolution des classes (libellés) de la grille hebdomadaire — l'emploi du temps réfère toujours
  // à l'année scolaire courante en pratique.
  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const currentYearId = (yearsQuery.data ?? []).find((y) => y.current)?.id ?? (yearsQuery.data ?? [])[0]?.id ?? null;
  const yearClassesQuery = useQuery(() => (currentYearId ? listClasses(currentYearId) : Promise.resolve([])), [currentYearId]);
  const classLabel = useMemo(
    () => new Map((yearClassesQuery.data ?? []).map((c) => [c.id, c.label])),
    [yearClassesQuery.data],
  );

  // Enseignant exceptionnel (ex. EPS) pouvant couvrir plusieurs classes au même horaire — bascule
  // immédiate, indépendante du formulaire de modification (§emploi du temps). Surcharge locale
  // optimiste tant que non nulle, sinon reflète la dernière valeur connue du serveur.
  const [allowsConcurrentOverride, setAllowsConcurrentOverride] = useState<boolean | null>(null);
  const allowsConcurrent = allowsConcurrentOverride ?? teacherQuery.data?.allowsConcurrentClasses ?? false;

  async function onToggleAllowsConcurrent(checked: boolean) {
    setAllowsConcurrentOverride(checked);
    try {
      await updateTeacherAllowsConcurrentClasses(id, checked);
      notifySuccess(checked ? "Enseignant marqué comme exceptionnel" : "Enseignant remis en mode standard");
    } catch (e) {
      setAllowsConcurrentOverride(!checked);
      notifyError(e);
    }
  }

  // Récapitulatif retards/absences par matière (contestation de salaire) — période par défaut : mois en cours.
  const [latenessFrom, setLatenessFrom] = useState(firstOfMonthIso());
  const [latenessTo, setLatenessTo] = useState(todayIso());
  const latenessQuery = useQuery(
    () => (canViewLatenessReport ? getTeacherLatenessDetail(id, latenessFrom, latenessTo) : Promise.resolve([])),
    [id, latenessFrom, latenessTo, canViewLatenessReport],
  );
  const [latenessPdfLoading, setLatenessPdfLoading] = useState(false);
  async function downloadLatenessReport() {
    setLatenessPdfLoading(true);
    try {
      window.open(await getTeacherLatenessReportPdfObjectUrl(id, latenessFrom, latenessTo), "_blank");
    } catch (err) {
      notifyError(err);
    } finally {
      setLatenessPdfLoading(false);
    }
  }

  if (teacherQuery.loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  if (teacherQuery.error || !teacherQuery.data) {
    return (
      <div className="space-y-4">
        <Link href="/teachers" className="text-sm text-brand-600 hover:underline">
          ← Retour aux enseignants
        </Link>
        <p className="rounded-md bg-error-50 px-4 py-3 text-sm text-error-700">Enseignant introuvable.</p>
      </div>
    );
  }

  const t = teacherQuery.data;
  const classes = classesQuery.data ?? [];
  const subjects = subjectsQuery.data ?? [];
  const schedule = (scheduleQuery.data?.slots ?? []).slice().sort((a, b) => a.startTime.localeCompare(b.startTime));

  function printSheet() {
    const esc = (v: string) => v.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] ?? c));
    const dayOrder = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"];
    const byDay = new Map(dayOrder.map((d) => [d, schedule.filter((s) => s.day === d).slice().sort((a, b) => a.startTime.localeCompare(b.startTime))]));
    const cols = dayOrder.map((d) => {
      const cells = (byDay.get(d) ?? []).map((s) => {
        const title = s.subjectId != null ? esc(subjectLabel.get(s.subjectId) ?? `Matière #${s.subjectId}`) : esc(s.label ?? "Heure creuse");
        const cls = esc(classLabel.get(s.classId) ?? `Classe #${s.classId}`);
        const room = s.roomId ? esc(roomLabel.get(s.roomId) ?? `#${s.roomId}`) : "";
        return `<div class="slot"><div class="time">${s.startTime.slice(0, 5)} – ${s.endTime.slice(0, 5)}</div>`
          + `<div class="subj">${title}</div><div>${cls}</div>` + (room ? `<div class="room">Salle : ${room}</div>` : "") + `</div>`;
      }).join("") || `<span class="empty">—</span>`;
      return `<td>${cells}</td>`;
    }).join("");
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Fiche enseignant — ${esc(t.firstName)} ${esc(t.lastName)}</title>`
      + `<style>@page{size:landscape}body{font-family:system-ui,Arial,sans-serif;padding:24px;color:#0f172a}`
      + `h1{font-size:20px;margin:0 0 2px}.sub{color:#64748b;font-size:12px;margin-bottom:16px}`
      + `.info{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;font-size:12px}`
      + `.info div span{display:block;color:#64748b;font-size:10px;text-transform:uppercase}`
      + `table{width:100%;border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:8px;vertical-align:top;width:16.6%}`
      + `th{background:#f1f5f9;font-size:11px;text-transform:uppercase;letter-spacing:.04em}`
      + `.slot{margin-bottom:8px;padding:6px;background:#eff6ff;border-radius:6px}.time{font-weight:700;font-size:11px;color:#1d4ed8}`
      + `.subj{font-weight:600;font-size:12px}.room{color:#64748b;font-size:11px}.empty{color:#cbd5e1}`
      + `.list{margin:0 0 16px;font-size:12px}@media print{body{padding:0}}</style></head><body>`
      + `<h1>Fiche enseignant — ${esc(t.firstName)} ${esc(t.lastName)}</h1>`
      + `<div class="sub">${esc(t.staffNumber ?? "")} — ${new Date().toLocaleDateString("fr-FR")}</div>`
      + `<div class="info">`
      + `<div><span>Spécialité</span>${esc(t.specialization ?? "—")}</div>`
      + `<div><span>Téléphone</span>${esc(t.phone ?? "—")}</div>`
      + `<div><span>Email</span>${esc(t.email ?? "—")}</div>`
      + `<div><span>Date d'embauche</span>${esc(t.hireDate ?? "—")}</div>`
      + `</div>`
      + `<p class="list"><strong>Matières :</strong> ${subjects.length ? esc(subjects.map((s) => subjectLabel.get(s.subjectId) ?? `#${s.subjectId}`).join(", ")) : "—"}</p>`
      + `<table><thead><tr>${dayOrder.map((d) => `<th>${DAY_LABEL[d] ?? d}</th>`).join("")}</tr></thead><tbody><tr>${cols}</tr></tbody></table>`
      + `<script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open("", "_blank", "width=1100,height=800");
    if (!w) { notifyError("Autorisez les pop-ups pour imprimer / télécharger."); return; }
    w.document.write(html);
    w.document.close();
  }

  return (
    <div className="space-y-6">
      <Link href="/teachers" className="text-sm text-brand-600 hover:underline">
        ← Retour aux enseignants
      </Link>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-700">
            {t.firstName[0]}
            {t.lastName[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {t.firstName} {t.lastName}
            </h1>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-gray-500">{t.staffNumber}</span>
              <Badge tone={t.active ? "green" : "gray"}>{t.active ? "Actif" : "Inactif"}</Badge>
            </div>
          </div>
        </div>
        <Button variant="secondary" onClick={printSheet} disabled={schedule.length === 0}>
          Imprimer / Télécharger la fiche
        </Button>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info" icon={IdCard}>Informations</TabsTrigger>
          <TabsTrigger value="affectations" icon={ListChecks}>Affectations</TabsTrigger>
          <TabsTrigger value="schedule" icon={CalendarDays}>Emploi du temps</TabsTrigger>
          {canViewPayroll && <TabsTrigger value="payroll" icon={Banknote}>Paie</TabsTrigger>}
          {canViewLatenessReport && <TabsTrigger value="lateness" icon={ClipboardList}>Retards / Absences</TabsTrigger>}
        </TabsList>

        <TabsPanel value="info">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informations</CardTitle>
              </CardHeader>
              <CardBody>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Info label="Spécialité" value={t.specialization} />
                  <Info label="Téléphone" value={t.phone} />
                  <Info label="Email" value={t.email} />
                  <Info label="Date d'embauche" value={t.hireDate} />
                </dl>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dossier professionnel</CardTitle>
              </CardHeader>
              <CardBody>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Info label="Statut" value={EMPLOYMENT_LABEL[t.employmentStatus ?? ""] ?? t.employmentStatus} />
                  <Info label="Diplôme" value={t.diploma} />
                  <Info label="Type de rémunération" value={REMUNERATION_LABEL[t.remunerationType ?? ""] ?? t.remunerationType} />
                  <Info label="Taux / montant" value={t.remunerationRate ? `${t.remunerationRate} GNF` : null} />
                  <Info label="N° autorisation (SNEPUP)" value={t.teachingAuthorizationNumber} />
                  <Info label="N° CNSS" value={t.cnssNumber} />
                </dl>
                <div className="mt-4 rounded-xl border border-gray-200 p-3">
                  <div className="flex items-center gap-3">
                    {canWrite ? (
                      <Switch
                        checked={allowsConcurrent}
                        onChange={onToggleAllowsConcurrent}
                        ariaLabel="Enseignant exceptionnel (plusieurs classes en même temps)"
                      />
                    ) : (
                      <Badge tone={allowsConcurrent ? "amber" : "gray"}>{allowsConcurrent ? "Oui" : "Non"}</Badge>
                    )}
                    <span className="text-sm text-gray-700">Enseignant exceptionnel (ex. EPS)</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    À activer pour un enseignant qui peut couvrir plusieurs classes au même horaire
                    (ex. sport, rassemblement) — l&apos;emploi du temps ne bloquera plus les conflits d&apos;horaire
                    le concernant. Les conflits de salle et de classe restent toujours vérifiés.
                  </p>
                </div>
              </CardBody>
            </Card>
          </div>
        </TabsPanel>

        <TabsPanel value="affectations">
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Classes enseignées</CardTitle>
                </CardHeader>
                <CardBody>
                  <TeacherClassesSection teacherId={id} canWrite={canWrite} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Matières enseignées</CardTitle>
                </CardHeader>
                <CardBody>
                  <TeacherSubjectsSection teacherId={id} canWrite={canWrite} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Niveaux enseignés</CardTitle>
                </CardHeader>
                <CardBody>
                  <TeacherLevelsSection teacherId={id} canWrite={canWrite} />
                </CardBody>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Disponibilités</CardTitle>
                </CardHeader>
                <CardBody>
                  <TeacherAvailabilitySection teacherId={id} canWrite={canWrite} />
                </CardBody>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Classes (prof. principal)</CardTitle>
                </CardHeader>
                <CardBody>
                  {classes.length === 0 ? (
                    <p className="text-sm text-gray-400">Aucune classe.</p>
                  ) : (
                    <ul className="space-y-2">
                      {classes.map((c) => (
                        <li key={c.id} className="text-sm">
                          <Link href={`/classes/${c.id}`} className="font-medium text-brand-600 hover:underline">
                            {c.label}
                          </Link>
                          {c.levelLabel && <span className="text-gray-500"> · {c.levelLabel}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Matières enseignées (coefficients)</CardTitle>
                </CardHeader>
                <CardBody>
                  {subjects.length === 0 ? (
                    <p className="text-sm text-gray-400">Aucune matière affectée.</p>
                  ) : (
                    <ul className="space-y-2">
                      {subjects.map((s, i) => (
                        <li key={`${s.subjectId}-${i}`} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{subjectLabel.get(s.subjectId) ?? `Matière #${s.subjectId}`}</span>
                          <span className="text-gray-400">coef. {s.coefficient}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>
        </TabsPanel>

        <TabsPanel value="schedule">
          <Card>
            <CardHeader className="flex items-center gap-2">
              <CardTitle>Emploi du temps</CardTitle>
              {scheduleQuery.fromCache && !online && (
                <span className="rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700">
                  Données en cache — hors-ligne
                </span>
              )}
            </CardHeader>
            <CardBody className="p-0">
              {schedule.length === 0 ? (
                <p className="px-5 py-4 text-sm text-gray-400">Aucun créneau.</p>
              ) : (
                <Table>
                  <THead>
                    <tr>
                      <TH>Jour</TH>
                      <TH>Horaire</TH>
                      <TH>Matière</TH>
                      <TH>Classe</TH>
                      <TH className="hidden sm:table-cell">Salle</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {schedule.map((slot) => (
                      <TR key={slot.id}>
                        <TD>{DAY_LABEL[slot.day] ?? slot.day}</TD>
                        <TD>
                          {slot.startTime} – {slot.endTime}
                        </TD>
                        <TD>{slot.subjectId != null ? (subjectLabel.get(slot.subjectId) ?? `#${slot.subjectId}`) : (slot.label ?? "Heure creuse")}</TD>
                        <TD>
                          <Link href={`/classes/${slot.classId}`} className="text-brand-600 hover:underline">
                            {classLabel.get(slot.classId) ?? `#${slot.classId}`}
                          </Link>
                        </TD>
                        <TD className="hidden sm:table-cell">{slot.roomId ? (roomLabel.get(slot.roomId) ?? `#${slot.roomId}`) : "—"}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </TabsPanel>

        {canViewPayroll && (
          <TabsPanel value="payroll">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Fiches de paie</CardTitle>
                <Link href="/payroll" className="text-sm text-brand-600 hover:underline">Gérer la paie</Link>
              </CardHeader>
              <CardBody className="p-0">
                {payslipsQuery.loading ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : (payslipsQuery.data ?? []).length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-400">Aucune fiche de paie pour l&apos;instant.</p>
                ) : (
                  <Table>
                    <THead>
                      <tr>
                        <TH>Période</TH>
                        <TH>Salaire net</TH>
                        <TH>Statut</TH>
                        <TH className="text-right">Actions</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {(payslipsQuery.data ?? []).map((p) => (
                        <TR key={p.id}>
                          <TD className="font-medium">{p.periodLabel}</TD>
                          <TD>{formatGNF(p.netSalary)}</TD>
                          <TD>
                            <Badge tone={p.status === "PAID" ? "green" : p.status === "VALIDATED" ? "amber" : "gray"}>
                              {PAYSLIP_STATUS_LABEL[p.status]}
                            </Badge>
                          </TD>
                          <TD className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                try {
                                  window.open(await getPayslipPdfObjectUrl(p.id), "_blank");
                                } catch (err) {
                                  notifyError(err);
                                }
                              }}
                            >
                              PDF
                            </Button>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </CardBody>
            </Card>
          </TabsPanel>
        )}

        {canViewLatenessReport && (
          <TabsPanel value="lateness">
            <Card>
              <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle>Retards / Absences</CardTitle>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Du</label>
                    <DatePicker value={latenessFrom} onChange={setLatenessFrom} className="w-36" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Au</label>
                    <DatePicker value={latenessTo} onChange={setLatenessTo} className="w-36" />
                  </div>
                  <Button size="sm" variant="secondary" onClick={downloadLatenessReport} disabled={latenessPdfLoading}>
                    {latenessPdfLoading ? <Spinner className="h-4 w-4" /> : "PDF"}
                  </Button>
                </div>
              </CardHeader>
              <CardBody className="p-0">
                {latenessQuery.loading ? (
                  <div className="flex justify-center py-8"><Spinner /></div>
                ) : (latenessQuery.data ?? []).length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-400">Aucun retard ni départ anticipé sur la période.</p>
                ) : (
                  <Table>
                    <THead>
                      <tr>
                        <TH>Date</TH>
                        <TH>Matière</TH>
                        <TH>Classe</TH>
                        <TH>Retard</TH>
                        <TH>Départ anticipé</TH>
                      </tr>
                    </THead>
                    <TBody>
                      {(latenessQuery.data ?? []).map((r, i) => (
                        <TR key={`${r.date}-${r.subjectId}-${i}`}>
                          <TD>{r.date}</TD>
                          <TD>{r.subjectId != null ? (subjectLabel.get(r.subjectId) ?? `#${r.subjectId}`) : "—"}</TD>
                          <TD>{r.classId != null ? (classLabel.get(r.classId) ?? `#${r.classId}`) : "—"}</TD>
                          <TD>{r.lateMinutes > 0 ? `${r.lateMinutes} min` : "—"}</TD>
                          <TD>{r.earlyMinutes > 0 ? `${r.earlyMinutes} min` : "—"}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </CardBody>
            </Card>
          </TabsPanel>
        )}
      </Tabs>
    </div>
  );
}
